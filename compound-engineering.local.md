# Review Context — LiveRequest

## Risk Chain

**Brainstorm risk:** Whether createAnonClient() on the guest page actually restores ISR caching in Next.js 16.

**Plan mitigation:** Research via Context7 confirmed only cookies()/headers()/searchParams/connection/draftMode opt out. params Promise does NOT. Risk downgraded pre-implementation.

**Work risk (from Feed-Forward):** RPC null-handling — insert_song_log returns NULL when session not live. API route must distinguish null (409) from error (500) from unique violation 23505 (retry). Three code paths.

**Review resolution:** Self-review (security + architecture agents) found 1 bug: submit-debrief CAS pattern used `!data && !error` which never fires — PostgREST returns PGRST116 error on zero rows. Fixed to handle PGRST116 explicitly. Architecture review confirmed three-client pattern is clean. No security regressions.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `lib/supabase/server.ts` | Added `createAnonClient()` — third client variant | Client selection confusion in future routes |
| `app/api/gig/vibe/route.ts` | Swapped to anon client + CAS with PGRST116 | RLS enforcement correctness |
| `app/api/session/log-song/route.ts` | Replaced manual queries with RPC call + retry | Three code paths (null/23505/error) |
| `app/api/session/submit-debrief/route.ts` | CAS guard + PGRST116 handling | Same CAS pattern as vibe/toggle |
| `app/api/gig/toggle/route.ts` | Combined verification + mutation | PGRST116 for "not found" |
| `app/r/[slug]/page.tsx` | Anon client for ISR restoration | Verify cache headers post-deploy |
| `supabase/migrations/20260407000000_add_insert_song_log_rpc.sql` | RPC + UNIQUE index | Migration order: code first, then migration |
| `components/request-queue.tsx` | In-memory song lookup via prop | Stale songs if catalog changes mid-gig |

## Plan Reference

`docs/plans/2026-04-07-fix-audit-remediation-plan.md` (complete)
