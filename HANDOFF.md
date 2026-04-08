# HANDOFF — LiveRequest

**Date:** 2026-04-07
**Branch:** `main`
**Phase:** Audit remediation complete. Ready for deploy + migration + Cycle 3 brainstorm.

## Current State

Comprehensive 6-agent codebase audit found 25 issues (3 P1, 10 P2, 12 P3). 12 fixes applied across 7 commits (14 files, +219/-110 lines). Self-review caught and fixed 1 additional bug (PGRST116 handling in submit-debrief). All TypeScript checks pass. Migration file ready but not yet applied to Supabase.

Production URL: https://liverequest.vercel.app

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm | `docs/brainstorms/2026-04-07-audit-remediation-brainstorm.md` |
| Plan | `docs/plans/2026-04-07-fix-audit-remediation-plan.md` |
| Solution | `docs/solutions/2026-04-07-audit-remediation-rls-rpc-isr.md` |

## What Was Fixed

| # | Fix | Priority |
|---|-----|----------|
| 1 | Atomic set_position via RPC + UNIQUE constraint | P1 |
| 2 | Vibe endpoint RLS enforcement (anon client) | P1 |
| 3 | COOKIE_SECRET verified never committed | P1 |
| 4 | N+1 query elimination (in-memory song lookup) | P2 |
| 5 | Toggle route round-trip reduction | P2 |
| 6 | Submit-debrief CAS guard + PGRST116 handling | P2 |
| 7 | Guest page ISR restoration (anon client) | P2 |
| 8-12 | Docs fix, dead types, JSON roundtrip, useMemo (x2) | P3 |

## Deploy Steps (not yet done)

1. Push to main (Vercel auto-deploys)
2. Run preflight query for duplicate set_positions (see migration comments)
3. Apply migration: `supabase/migrations/20260407000000_add_insert_song_log_rpc.sql`
4. Verify ISR: `curl -sI https://liverequest.vercel.app/r/alejandro | grep -i cache`
5. Test vibe endpoint: send vibe, then send again — second should fail

## Deferred Items

- No rate limiting on /api/auth or /api/gig/vibe (needs upstash dependency)
- Missing CSP header (needs per-feature tuning)
- No performer_id in JWT (blocks multi-performer, not exploitable now)
- Client-side-only request limit (RLS has a check, full fix needs policy update)
- localStorage crash in private browsing (edge case)
- Component extractions (ToggleSwitch, SegmentedControl)
- API boilerplate DRY, naming convention alignment
- database.types.ts regeneration from live DB
- Dynamic slug management (hardcoded /r/alejandro)

## Three Questions

1. **Hardest decision?** Folding the session-status check into the RPC rather than leaving it as a separate query. SpecFlow analysis identified the remaining TOCTOU gap.
2. **What was rejected?** UNIQUE constraint + retry without RPC (messy conflict handling), shared verifyActiveGig() helper (marginal DRY), soft-delete for undo-log (reclassified as correct behavior).
3. **Least confident about?** Migration rollout ordering. Code must deploy before migration is applied, or .rpc() calls fail.

## Prompt for Next Session

```
Read HANDOFF.md for context. This is LiveRequest, a live musician song request app.
Audit remediation (12 fixes from 6-agent audit) is complete on main, not yet deployed.
Next steps:
1. Deploy to Vercel (push to main or npx vercel --prod)
2. Apply Supabase migration (20260407000000_add_insert_song_log_rpc.sql)
3. Verify ISR cache headers on /r/alejandro
4. Start Cycle 3 brainstorm (The Gift — post-service summary for venue contacts)
```
