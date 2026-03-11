# Review Context — LiveRequest

## Risk Chain

**Brainstorm risk:** Guest page cache behavior is uncertain — `revalidate=60` but `cookies()` may force dynamic rendering. Already-open guest pages will not auto-update regardless.

**Plan mitigation:** Verify cache behavior in Phase 1. If `revalidatePath` has no observable effect, remove it. Guest pages updating live is a future cycle concern (Supabase Realtime on guest page).

**Work risk (from Feed-Forward):** Whether the simplified revert-on-error is sufficient if the API partially succeeds (DB updated, network drops before response). Drift resolves on next page load.

**Review resolution:** 4 findings (2 P1, 1 P2, 1 rejected P2) from multi-agent review + browser testing. Top finding: RLS policy hid inactive songs from dashboard (P1 bug caught by browser test, not code review). Over-engineered optimistic UI simplified (44 lines removed, 1 bug fixed). Silent inFlight swallow fixed with disabled state. Guest cache verified working. All P1/P2 fixes applied. 3 P3s deferred (not blocking merge).

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `app/performer/dashboard/page.tsx` | Split fetch: anon client for requests, service client for songs | Mixing client types — ensure service client only used for admin reads |
| `components/setlist-manager.tsx` | Simplified from 149→105 lines: removed generation counter, heal timer, refetch. Added useState for inFlight. | Revert-on-error drift if API partially succeeds |
| `app/api/songs/list/route.ts` | Narrowed select columns, kept service client | Service client required (RLS blocks inactive songs for anon) |
| `components/dashboard-tabs.tsx` | CSS-hidden tabs (both children always mounted) | RequestQueue realtime must not unmount |

## Cross-Tool Review Protocol

Codex is an independent second-opinion agent in this workflow. For reviews:
1. Run Codex `review-branch-risks` first (independent findings)
2. Then run Claude Code `/workflows:review` (compound review with learnings researcher)
3. Merge both finding sets, deduplicate, and apply fix ordering per CLAUDE.md rules

## Plan Reference

`docs/plans/2026-03-10-feat-setlist-management-dashboard-plan.md` (complete — review fixes applied)
