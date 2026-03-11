# HANDOFF — LiveRequest

**Date:** 2026-03-10
**Branch:** feat/setlist-management
**Phase:** Compound complete. Setlist management feature ready for merge to main + deploy.

## Current State

Setlist Management feature is complete on `feat/setlist-management`. The performer can now toggle songs visible/hidden from a "Setlist" tab on the dashboard during a gig. All P1/P2 review fixes applied (RLS bug, simplified optimistic UI, inFlight disabled state). 3 P3s deferred. Ready to merge to main and deploy before Thursday's gig at Japanese Friendship Garden.

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm | `docs/brainstorms/2026-03-10-setlist-management-brainstorm.md` |
| Plan | `docs/plans/2026-03-10-feat-setlist-management-dashboard-plan.md` |
| Solution | `docs/solutions/setlist-management-review-fixes.md` |
| Review Context | `compound-engineering.local.md` |

## Review Fixes Applied

| Todo | Priority | Status |
|------|----------|--------|
| 027 — RLS hides inactive songs from dashboard | P1 | Complete — service client for songs query |
| 021 — Toggle silently swallows inFlight taps | P1 | Complete — disabled state + visual feedback |
| 022 — Over-engineered optimistic UI | P2 | Complete — simplified to revert-on-error (44 lines removed) |
| 023 — List route uses service client | P2 | Rejected — service client required (RLS blocks inactive for anon) |

## Open P3s (Not Blocking Merge)

| Todo | Issue |
|------|-------|
| 024 | `select("*")` could use explicit columns |
| 025 | Hardcoded slug in `revalidatePath` |
| 026 | Toggle response could return updated record |

## Deferred Items

- Dynamic slug management (hardcoded `/r/alejandro` in `revalidatePath` — breaks at second venue)
- Supabase Realtime on guest page (guests must refresh to see toggle changes)
- Separate Supabase prod project (shared dev/prod still)
- Open P3 todos (024, 025, 026)

## Three Questions

1. **Hardest decision?** Using `createServiceClient()` on a server page for admin reads. The "RLS defense-in-depth" convention means RLS protects public access, but admin views are the exception — they must explicitly bypass it.
2. **What was rejected?** New RLS policy for authenticated reads (auth model mismatch — JWT cookies, not Supabase Auth), per-song heal timers (over-engineering for single-performer), switching list route to anon client (would break self-heal refetch).
3. **Least confident about?** Whether simplified revert-on-error handles partial API success (DB updated, network drops). Drift resolves on next page load — acceptable for 25-song single-performer, not for multi-performer or Realtime setlist.

## Prompt for Next Session

```
Read HANDOFF.md for context. This is LiveRequest, a live musician song request app.
Branch feat/setlist-management has setlist management complete with all review fixes.
Merge to main and deploy with `npx vercel --prod` before Thursday's gig.
After deploy, verify setlist toggle works on live URL.
```
