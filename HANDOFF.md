# HANDOFF — LiveRequest

**Date:** 2026-03-29
**Branch:** `main`
**Phase:** Deployed to production. Ready for manual testing + Cycle 3.

## Current State

Cycle 2 (Musician Intelligence) is merged to main and deployed. The Deploy & Ship agent team (Mar 29) handled:
1. Supabase migration applied (both 20260301 and 20260313 migrations)
2. New tables created: venues, performance_sessions, song_logs (all with RLS enabled)
3. feat/cycle2-musician-intelligence merged to main (fast-forward, no conflicts)
4. Pushed to GitHub → Vercel auto-deployed (Ready, 26s build)
5. All 5 env vars confirmed: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, PERFORMER_PASSWORD, COOKIE_SECRET
6. Smoke test passed: 200 OK on root, /api/venues/list returns 401 (auth required, correct)

Production URL: https://liverequest.vercel.app

## What Was Built (Cycle 2)

| Category | Files |
|----------|-------|
| Migration | `supabase/migrations/20260313000000_add_musician_intelligence.sql` |
| Schema | `supabase/schema.sql` (updated) |
| Types | `lib/supabase/database.types.ts`, `lib/supabase/types.ts` |
| API Routes (8) | `app/api/venues/{list,create}`, `app/api/session/{create,go-live,end-set,submit-debrief,log-song,undo-log}` |
| Dashboard | `app/performer/dashboard/page.tsx` (state machine) |
| Components (4) | `components/{pre-set-form,post-set-form,song-log-fab,dashboard-tabs}.tsx` |

## Not Yet Done

- ~~Migration not applied to Supabase~~ DONE (Mar 29)
- ~~Not deployed to Vercel~~ DONE (Mar 29)
- No automated tests (project has zero test infrastructure)
- FAB timing not yet tested with real guitar + timer (the verify_first risk)
- GigPrep sync branch not merged (song tags won't be populated yet — optional)
- No Codex code review performed yet

## Deferred Items

- Dynamic slug management (hardcoded `/r/alejandro`)
- Supabase Realtime on guest page
- Separate dev/prod Supabase project
- Open P3s from setlist management (024, 025, 026)

## Feed-Forward

- **Hardest decision:** Combining FAB + bottom sheet + song picker + 3 inputs into a single component rather than separate files. Kept it in one `song-log-fab.tsx` because the state flows sequentially (pick song → log inputs → submit). Splitting would add prop-drilling overhead for a tightly coupled flow.
- **Rejected alternatives:** Separate `song-log-sheet.tsx` and `last-log-chip.tsx` files (plan originally called for 3 components, consolidated to 1 for simplicity).
- **Least confident:** Whether the bottom sheet song picker works fast enough in a dark venue on a phone. Must test with guitar + timer. Fallback: show only unplayed songs → add top-3 suggestions → drop to 2 inputs.

## Prompt for Next Session

```
Read HANDOFF.md for context. This is LiveRequest, a live musician song request app.
Cycle 2 (musician intelligence) is deployed to production at liverequest.vercel.app.
Supabase migration applied, all env vars set.
Next steps:
1. Test the full flow on production (pre-set → go live → log songs → end set → debrief)
2. Test FAB timing with guitar + timer (the verify_first risk)
3. Send to Codex for code review before starting Cycle 3
```
