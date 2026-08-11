# Brainstorm: Codebase Audit Remediation

**Date:** 2026-04-07
**Trigger:** Comprehensive 6-agent codebase audit (security, performance, architecture, patterns, data integrity, simplicity)
**Findings:** 3 P1, 10 P2, 12 P3

## Context

LiveRequest is deployed and working at liverequest.vercel.app. Cycles 1 (requests + vibes) and 2 (musician intelligence) are shipped. Before starting Cycle 3 (The Gift), a full codebase audit was run using 6 specialized review agents. This brainstorm scopes which findings to fix now vs. defer.

## Prior Lessons That Apply

| Lesson | Source | How It Applies |
|--------|--------|----------------|
| RLS is the real security boundary, not route middleware | Diagnostic fix doc | Vibe endpoint bypasses RLS via service client — exact anti-pattern |
| Service client for admin views, anon for guest views | Setlist management doc | Vibe endpoint should use anon client to let RLS enforce `vibe IS NULL` |
| Batch fixes by cascade then blast radius | GigLead pipeline doc | Fix order should prioritize what unblocks the most other fixes |
| Match complexity to concurrency | Setlist management doc | Don't over-engineer fixes for a single-performer app |

## The 3 P1 Findings

### P1-1: set_position race condition (log-song)
- **What:** Two rapid taps can produce duplicate `set_position` values in `song_logs`. READ then INSERT with no atomicity.
- **Why it matters:** Corrupts setlist ordering on every gig where performer logs songs quickly.
- **Fix approach:** Supabase RPC function that does `INSERT ... SELECT COALESCE(MAX(set_position), 0) + 1` atomically. Or add `UNIQUE(session_id, set_position)` constraint + retry.
- **Preferred:** RPC function — single atomic statement, no retry logic needed.

### P1-2: Vibe endpoint bypasses RLS + no auth
- **What:** `/api/gig/vibe` uses `createServiceClient()` (bypasses all RLS) with zero authorization. Any POST with a valid UUID can overwrite any request's vibe, unlimited times.
- **Why it matters:** Guests (or bots) can spam/overwrite vibes. The RLS policy `vibe IS NULL` check is completely bypassed.
- **Fix approach:** Swap `createServiceClient()` for `createAnonClient()` in the route. The RLS layer already enforces everything needed: `vibe IS NULL` check (prevents re-setting), column-level `GRANT UPDATE (vibe)` (prevents touching other columns), and `WITH CHECK (vibe in (...))` (validates values). No additional "gig-active scope check" needed — this is simpler than it first appeared.
- **Prior lesson directly applies:** "Service client for admin views, anon for guest views" (setlist management doc).

### P1-3: Verify COOKIE_SECRET never committed to git
- **What:** Real secret exists in `.env` on disk. If it ever entered git history, JWT auth is forgeable.
- **Fix approach:** Run `git log --all --diff-filter=A -- .env` to verify. If clean, document the check. If leaked, rotate on Vercel.
- **This is a 30-second verification, not a code change.**

## P2 Findings — Scope Decision

10 P2 findings. Need to decide: fix all in this cycle, or split?

### Fix this cycle (high impact, reasonable effort):
| # | Finding | Effort | Rationale |
|---|---------|--------|-----------|
| 4 | N+1 query on Realtime INSERT | Low | ~5 lines. Fires every request during a gig. Pass existing `allSongs` as prop to `RequestQueue`, look up in-memory. |
| 5 | Redundant gig verification query | Low | 3 routes, same pattern. Saves 100-300ms per tap. |
| 7 | Submit-debrief TOCTOU race | Trivial | Add `.eq("status", "post_set")` — copy existing pattern. |
| 9 | Guest page ISR defeated by cookies() | Medium | Use new `createAnonClient()` (no cookies). Affects all guests simultaneously. |

### Defer to future cycle (higher effort or lower urgency):
| # | Finding | Reason to Defer |
|---|---------|-----------------|
| 6 | No rate limiting on /api/auth | Needs Vercel KV or upstash/ratelimit dependency. Separate concern. |
| 8 | Hard DELETE in undo-log | Reclassified: soft-delete convention applies to guest requests, not performer's own undo. Hard delete is correct here. |
| 10 | Client-side-only request limit | RLS has a check already. Full fix needs RLS policy update. |
| 11 | Missing CSP header | Important but requires careful tuning per feature. Better as a standalone task. |
| 12 | No performer_id in JWT | Not exploitable until multi-performer. Blocks future cycle, not this one. |
| 13 | localStorage crash in private browsing | Edge case, needs careful testing across browsers. |

## P3 Findings — Quick Wins Only

From the 12 P3s, include only trivial fixes (< 5 min each):
- Fix `VibeType` → `Vibe` in CLAUDE.md
- Delete dead `EnergyLevel`/`RepertoireType` types (12 lines)
- Remove `JSON.parse(JSON.stringify())` in submit-debrief (1 line)
- Add `useMemo` to SongLogFab set creation (2 lines)
- Wrap `window.location.origin` in `useMemo` (3 lines)

Defer: component extraction (ToggleSwitch, SegmentedControl), API boilerplate DRY, naming convention alignment, database.types.ts regeneration, ON DELETE inconsistency, hardcoded slug, undo-log hard delete (reclassified — correct behavior for performer undo).

## Scope Summary

| Category | In Scope | Deferred |
|----------|----------|----------|
| P1 | 3 (all) | 0 |
| P2 | 4 | 6 |
| P3 | 5 (quick wins) | 7 |
| **Total** | **12 fixes** | **13 deferred** |

### What's changing:
- 1 new Supabase RPC function (set_position atomicity) — requires migration
- 1 new `createAnonClient()` in `lib/supabase/server.ts` (2 call sites: guest page + vibe endpoint)
- ~9 surgical edits to existing files (no new files beyond the migration)

### What must NOT change:
- Guest request flow (song-card.tsx insert path)
- Performer auth flow (JWT cookie auth)
- Realtime subscription structure (channel names, event handling)
- Dashboard state machine (pre_set → live → post_set → complete)
- Any visual/UI behavior

## Resolved Questions

1. **RPC for set_position (decided).** RPC function wins. It's a single atomic `INSERT ... SELECT MAX+1` — no retry logic, no conflict handling. Supabase JS `.rpc()` makes calling it clean. The UNIQUE constraint alternative requires handling insert conflicts, which `supabase-js` doesn't surface cleanly.
2. **New `createAnonClient()` (decided).** Add a new function to `lib/supabase/server.ts` that uses the anon key without touching cookies. `createClient()` has cookies baked in and can't be reused. Two call sites: guest page (restores ISR) and vibe endpoint (restores RLS enforcement).
3. **Keep hard DELETE in undo-log (decided — reclassified).** The soft-delete convention in CLAUDE.md applies to *guest requests* (`played_at` timestamp), not internal performer logs. Undo-log deletes the performer's most recent entry seconds after a mistake — there's no audit trail value in "I accidentally logged the wrong song." This finding is reclassified from P2 to P3-deferred. No migration needed.

## Feed-Forward

- **Hardest decision:** Reclassifying the undo-log hard DELETE (#8) as correct behavior. The soft-delete convention applies to guest-facing data, not a performer's immediate mistake correction. Dropping it from scope kept the cycle focused on real issues.
- **Rejected alternatives:** (1) "Fix everything in one mega-cycle" — rejected because rate limiting needs a new dependency, CSP needs per-feature tuning, JWT identity is a multi-performer prerequisite. (2) UNIQUE constraint for set_position — rejected in favor of RPC for cleaner atomicity without retry logic.
- **Least confident:** Whether `createAnonClient()` on the guest page actually restores ISR caching in Next.js 16. The `cookies()` call is the known opt-out, but there could be other dynamic signals (e.g., `params` being a Promise). Need to verify with a build + cache header check after the change.
