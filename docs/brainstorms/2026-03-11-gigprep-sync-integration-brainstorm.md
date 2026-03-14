# GigPrep ↔ LiveRequest M2M Sync Integration — Brainstorm

**Date:** 2026-03-11
**Status:** Complete
**Prior art:** `docs/brainstorms/2026-03-10-setlist-management-brainstorm.md` (Section 3, "Layer 4")

## Context

The setlist management brainstorm scoped a future GigPrep integration as "Layer 4." Code for this integration was written today in a separate session across both repos (GigPrep + LiveRequest) but skipped the compound loop. This brainstorm retroactively captures the design decisions, validates the existing code, and identifies fixes needed before committing.

**GigPrep** is a Python CLI tool (Claude Haiku-powered) for setlist generation and gig preparation. It needs to:
1. **Push** a setlist to LiveRequest (activate songs by title+artist match)
2. **Pull** played songs from LiveRequest after a gig (for archiving)

The LiveRequest side is two API endpoints + a shared auth module, all currently untracked.

## What We're Building

Two machine-to-machine API endpoints authenticated via API key:

- **`POST /api/songs/sync`** — Accepts `{ songs: [{ title, artist }] }`, matches against the song catalog by normalized title+artist, activates matched songs. Returns categorized results: `matched`, `already_active`, `unmatched`, `ambiguous`.
- **`GET /api/songs/played`** — Returns played songs for the active gig, grouped by song+timestamp with request counts. Includes gig metadata (id, venue, date).
- **`lib/sync-auth.ts`** — API key validation using `X-API-Key` header with timing-safe comparison.

The GigPrep Python client (`src/gigprep/liverequest.py`) already exists and mirrors these endpoints.

## Why This Approach

- **API key auth (not JWT cookies)** — M2M traffic doesn't have a browser session. API key via header is the standard pattern (matches Lead Responder ↔ PF-Intel Layer 1 from the cross-project review).
- **Title+artist matching (not ID-based)** — GigPrep and LiveRequest have separate databases. Matching by normalized title+artist is the only shared identifier. Ambiguous matches are returned for manual resolution.
- **Additive sync model** — The sync endpoint only activates matched songs. It does NOT deactivate songs missing from the push. This is safer — a bad push can't wipe the setlist. Manual toggle from the dashboard handles deactivation.

## Key Decisions

1. **Sync model: Additive** — Only activate, never deactivate. Dashboard toggle handles the rest.
2. **Remove `revalidatePath("/r/alejandro")`** — The sync route is `force-dynamic` and the guest page fetches dynamically. The revalidation is a no-op that hardcodes a slug. Delete it. Verify guest page caching during work phase.
3. **Fix timing-safe comparison** — SHA-256 hash both sides before `timingSafeEqual` to prevent length-oracle attack. ~3 lines changed in `sync-auth.ts`.
4. **Leave `jsonNoStore` duplicated** — 4-line helper in 2 files. YAGNI — extract if a third M2M route appears.
5. **Played endpoint: flexible** — Use case is "not sure yet" on GigPrep side (post-gig archival vs. live polling). Keep the endpoint simple and stateless — it works for both.

## What We're NOT Building

- No new song creation via sync (unmatched songs are reported, not inserted)
- No rate limiting (M2M between own services, API key is sufficient for now)
- No webhook/push notifications (GigPrep pulls when it needs data)
- No multi-performer scoping (single performer, same as rest of app)
- No `jsonNoStore` extraction (leave duplicated)

## Existing Code Assessment

The untracked files are ~95% ready. Two fixes needed:

| Issue | File | Fix | Lines |
|-------|------|-----|-------|
| Hardcoded slug | `app/api/songs/sync/route.ts:174` | Delete `revalidatePath` call | -2 lines |
| Length oracle | `lib/sync-auth.ts:15-17` | SHA-256 hash before compare | ~3 lines changed |

Everything else — input validation, error handling, service client usage, response shapes — follows existing conventions and matches the GigPrep client.

## Open Questions

None — all resolved during brainstorm dialogue.

## Feed-Forward

- **Hardest decision:** Sync model (additive vs. replace). Additive won because a bad push can't wipe the setlist, and the dashboard toggle already handles deactivation.
- **Rejected alternatives:** Replace sync model (too risky for a single-endpoint push), dynamic slug lookup for revalidation (over-engineering — just remove the no-op call), extracting jsonNoStore (YAGNI).
- **Least confident:** Whether removing `revalidatePath` has any side effects. The guest page appears fully dynamic, but should be verified during the work phase by checking the `/r/[slug]/page.tsx` caching config.
