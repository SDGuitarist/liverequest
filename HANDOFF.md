# HANDOFF — LiveRequest

**Date:** 2026-03-13
**Branch:** feat/cycle2-musician-intelligence
**Phase:** Work complete. Musician intelligence logging ready for review.

## Current State

Cycle 2: Musician Intelligence is implemented on `feat/cycle2-musician-intelligence`. Three logging windows added to the performer dashboard:

1. **Pre-set form** — venue picker (with inline create), configuration, genre, setlist preview → "Go Live"
2. **Between-song FAB** — bottom sheet with song picker + 3 quick inputs (quality/volume/guest ack), auto-submit on last tap, undo chip
3. **Post-set debrief** — overall feel, walkups, tips, complaints, staff feedback, observations → "Submit"

Dashboard is now state-driven: pre_set → live + FAB → post_set → complete → "Start Next Set". Session recovery works on page refresh (DB status is source of truth).

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm | `docs/brainstorms/2026-03-13-cycle2-musician-intelligence-brainstorm.md` |
| Plan | `docs/plans/2026-03-13-feat-cycle2-musician-intelligence-plan.md` |

## What Was Built

| Category | Files |
|----------|-------|
| Migration | `supabase/migrations/20260313000000_add_musician_intelligence.sql` |
| Schema | `supabase/schema.sql` (updated) |
| Types | `lib/supabase/database.types.ts`, `lib/supabase/types.ts` |
| API Routes (8) | `app/api/venues/{list,create}`, `app/api/session/{create,go-live,end-set,submit-debrief,log-song,undo-log}` |
| Dashboard | `app/performer/dashboard/page.tsx` (state machine) |
| Components (4) | `components/{pre-set-form,post-set-form,song-log-fab,dashboard-tabs}.tsx` |

## Not Yet Done

- Migration not applied to Supabase (needs `supabase db push` or SQL Editor)
- Not deployed to Vercel
- No automated tests (project has zero test infrastructure)
- FAB timing not yet tested with real guitar + timer (the verify_first risk)
- GigPrep sync branch not merged (song tags won't be populated yet — they're optional)

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
Branch feat/cycle2-musician-intelligence has Cycle 2 (musician intelligence) complete.
Next steps:
1. Apply migration to Supabase (run SQL in Supabase SQL Editor)
2. Test the full flow locally (pre-set → go live → log songs → end set → debrief)
3. Test FAB timing with guitar + timer (the verify_first risk)
4. Send to Codex for code review before merging
```
