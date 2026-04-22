# Review Context — LiveRequest

## Risk Chain

**Brainstorm risk:** Whether CSV should be summary-per-gig or detail-per-request. Whether `getGiftData()` can be called N times efficiently for CSV.

**Plan mitigation:** Created separate `getHistoryStats()` for bulk stats (list + CSV). Reserved `getGiftData()` for single-gig detail page only. Two data paths, each optimized for its use case.

**Work risk (from Feed-Forward):** Peak hour computation may be expensive at scale on the list page. Whether modifying `getGiftData()` to add `rawRequests` would break Gift PDF.

**Review resolution:** 4 findings from 6 agents (0 P1, 3 P2, 1 P3). Top findings: redundant Supabase query on detail page (3 agents converged), sanitizeCell formula+comma bypass (2 agents converged). All resolved before merge.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `lib/history-data.ts` | New — bulk stats aggregation with 3 parallel queries | Unbounded query at scale (50K+ rows) |
| `app/performer/history/[gigId]/page.tsx` | New — gig detail with rawRequests from getGiftData | Type casts on req.songs, vibe narrowing |
| `app/api/export/history/route.ts` | New — CSV export with sanitizeCell | Formula injection prevention, quoting correctness |
| `lib/gift-data.ts` | Modified — added rawRequests to GiftData | Increased payload for Gift PDF renders |
| `lib/time-utils.ts` | New — shared computePeakHour | Timezone handling (America/Los_Angeles) |
| `lib/supabase/types.ts` | Modified — added isVibe() type guard | Type narrowing correctness |

## Plan Reference

`docs/plans/2026-04-21-feat-session-history-csv-export-plan.md` (complete)
