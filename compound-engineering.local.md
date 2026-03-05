# Review Context — LiveRequest

## Risk Chain

**Brainstorm risk:** Vibe UPDATE RLS policy scoping — resolved in Cycle 1 research phase (column-level GRANT/REVOKE).

**Plan mitigation:** Column-level GRANT on `vibe` column only, CHECK constraint, direct client via RLS.

**Work risk (from Feed-Forward):** API routes using service role accept any `gigId` without ownership/active check.

**Review resolution:** 20 todos created across Cycle 1 reviews. All 20 now resolved (17 complete, 1 rejected as moot, 2 N/A). Last fix: `is_active` gig guard on all 3 service-role routes.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `app/api/gig/dismiss/route.ts` | Added `.eq("is_active", true)` to gig check | Service role authorization |
| `app/api/gig/toggle/route.ts` | Added `.eq("is_active", true)` to gig check | Service role authorization |
| `app/api/gig/undo-dismiss/route.ts` | Added `.eq("is_active", true)` to gig check | Service role authorization |

## Plan Reference

`docs/plans/2026-02-28-feat-deploy-vercel-plan.md` (next active plan — Vercel deploy)
