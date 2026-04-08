---
title: "fix: Audit remediation — 12 fixes from 6-agent codebase audit"
type: fix
status: complete
date: 2026-04-07
origin: docs/brainstorms/2026-04-07-audit-remediation-brainstorm.md
feed_forward:
  risk: "RPC null-handling — insert_song_log returns NULL when session not live. API route must distinguish null (409) from error (500) from unique violation (retry). Three code paths."
  verify_first: true
  prior_risk_resolved: "ISR caching — Next.js 16 docs confirm params Promise does NOT opt out. Only cookies()/headers()/searchParams/connection/draftMode do. Risk downgraded."
---

# fix: Audit Remediation — 12 Fixes from Codebase Audit

## Enhancement Summary

**Deepened on:** 2026-04-07
**Research sources:** Context7 (Next.js v16.1.6 docs, Supabase docs), Security Sentinel, Performance Oracle

### Key Improvements from Deepening
1. **ISR feed_forward risk downgraded** — Next.js 16 docs confirm `params` as Promise does NOT opt out of caching. Only `cookies()`, `headers()`, `searchParams`, `connection`, `draftMode` do. Removing `cookies()` is sufficient.
2. **UNIQUE constraint added to RPC migration** — Security review found the `MAX+1` pattern inside the RPC still races under concurrent calls. Added `UNIQUE(session_id, set_position)` as cheap insurance.
3. **RPC silent failure handling specified** — When session is not live, the RPC returns NULL (zero rows inserted). API route must check for null and return 409.
4. **`songs.find()` confirmed adequate** — Performance review: at 50-100 items, linear scan is microseconds. Map would cost more to construct than it saves. Revisit only at 1,000+ songs (won't happen).

### New Considerations Discovered
- RPC should stay `SECURITY INVOKER` (default) — service role already bypasses RLS. If the call ever moved to anon client, `SECURITY DEFINER` would dangerously bypass RLS.
- `song_quality` and `volume_calibration` already have CHECK constraints on the `song_logs` table (schema.sql:77-78), so the RPC params are validated at insert time by Postgres.
- The `force-static` route segment config is a fallback option if ISR still doesn't work after removing `cookies()` — but it returns empty values for cookies/headers, which is fine since the guest page doesn't use them.

## Overview

Apply 12 targeted fixes (3 P1, 4 P2, 5 P3) identified by a 6-agent codebase audit. Fixes address data corruption, security bypass, performance, and code quality. No new features — strictly hardening what exists.

## Problem Statement / Motivation

A comprehensive audit found:
- **P1-1:** `set_position` race condition in log-song can corrupt setlist ordering on every gig
- **P1-2:** Vibe endpoint bypasses all RLS policies via service client — guests can overwrite vibes unlimited times
- **P1-3:** COOKIE_SECRET may have been committed to git history (needs verification)
- **P2s:** N+1 query on every guest request, 100-300ms extra latency per performer tap, TOCTOU race in debrief, ISR completely defeated on guest page
- **P3s:** Dead types, stale docs, unnecessary JSON roundtrip, missing memoization

(See brainstorm: `docs/brainstorms/2026-04-07-audit-remediation-brainstorm.md` for full findings and scope decisions)

## Proposed Solution

4 implementation steps, ordered by dependency chain:

### Step 0: Prerequisite — `createAnonClient()` helper

**What:** Add `createAnonClient()` to `lib/supabase/server.ts`. Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` via the raw `@supabase/supabase-js` client (same as `createServiceClient()` but with the anon key). No cookies, no SSR wrapper. Synchronous.

**Why separate:** Both Fix #2 (vibe endpoint) and Fix #7 (guest page ISR) depend on this. Must land first.

**File:** `lib/supabase/server.ts` — add between existing functions (after line 12)

```typescript
export function createAnonClient() {
  return createSupabaseClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
```

### Step 1: P1 Fixes (data integrity + security)

#### Fix #1: Atomic set_position via RPC (`log-song`)

**Problem:** `app/api/session/log-song/route.ts:59-67` — READ max position then INSERT. Two rapid taps produce duplicate positions.

**Fix:** Create a Supabase RPC function that folds ALL three operations into one atomic call: verify session is live, compute next position, insert. This eliminates both the set_position TOCTOU and the session-status TOCTOU in one shot. (SpecFlow identified that leaving the status check separate would leave a gap — resolved by folding it into the RPC.)

**Migration file:** `supabase/migrations/20260407000000_add_insert_song_log_rpc.sql`

```sql
-- Atomic song log insertion with auto-incrementing set_position.
-- Verifies session is live before inserting. Returns NULL if session
-- is not live (caller must check for null and return 409).
-- SECURITY INVOKER (default) — safe because service role bypasses RLS anyway.
-- If this ever moves to anon client, INVOKER prevents RLS bypass.
create or replace function insert_song_log(
  p_session_id uuid,
  p_song_id uuid,
  p_song_title text,
  p_song_quality text,
  p_volume_calibration text,
  p_guest_acknowledgment boolean
) returns song_logs as $$
  insert into song_logs (
    session_id, song_id, song_title,
    song_quality, volume_calibration, guest_acknowledgment,
    set_position
  )
  select
    p_session_id, p_song_id, p_song_title,
    p_song_quality, p_volume_calibration, p_guest_acknowledgment,
    coalesce(max(sl.set_position), 0) + 1
  from performance_sessions ps
  left join song_logs sl on sl.session_id = ps.id
  where ps.id = p_session_id
    and ps.status = 'live'
  group by ps.id
  returning *;
$$ language sql;

-- Cheap insurance against the remaining race condition: if two concurrent
-- calls read the same max, the UNIQUE constraint causes one to fail.
-- The API route should catch this (error code 23505) and retry once.
create unique index idx_song_logs_session_position
  on song_logs(session_id, set_position);
```

**Route handler changes** (`app/api/session/log-song/route.ts`):
- Remove lines 47-67 (session status check + max position query)
- Replace with single `.rpc("insert_song_log", { ... })` call
- **Handle null/empty result** as "Session not live" (409) — the RPC returns NULL when the WHERE clause filters out all rows (session not live or not found). This is a silent no-op, not an error.
- **Handle error code `23505`** (unique violation) with a single retry — this means a concurrent insert won the race. Retry once; if it fails again, return 500.
- Handle other errors as server error (500)

**Verification:** Log two songs rapidly in succession — positions must be sequential (no duplicates).

#### Fix #2: Vibe endpoint — swap to anon client

**Problem:** `app/api/gig/vibe/route.ts:25` — uses `createServiceClient()`, bypassing the RLS policy that enforces `vibe IS NULL`.

**Fix:** Change line 25 from `createServiceClient()` to `createAnonClient()`. That's it. The RLS layer already enforces: `vibe IS NULL` (prevents re-setting), column-level `GRANT UPDATE (vibe)` (prevents touching other columns), `WITH CHECK (vibe in (...))` (validates values). No additional application-level checks needed.

**File:** `app/api/gig/vibe/route.ts` — change import and client creation (2 lines)

**Verification:** Send a vibe on a request, then try sending again — second attempt must fail (RLS blocks it).

#### Fix #3: Verify COOKIE_SECRET never committed

**Action:** Run `git log --all --diff-filter=A -- .env` and `git log --all -p -- .env`

- If clean: document in this plan as verified, no code change.
- If leaked: rotate secret on Vercel immediately, then commit the fix.

### Step 2: P2 Fixes (performance + correctness)

#### Fix #4: Eliminate N+1 query on Realtime INSERT

**Problem:** `components/request-queue.tsx:126-148` — fetches song details from DB for every incoming request via Realtime.

**Fix:** 
1. Add `songs` prop to `RequestQueueProps` interface (`request-queue.tsx:27-29`)
2. In dashboard page (`app/performer/dashboard/page.tsx:123`), pass `allSongs` to `RequestQueue`
3. In the Realtime INSERT handler, replace the DB query with an in-memory lookup: `const song = songs.find(s => s.id === newReq.song_id)`
4. **Fallback for missing songs:** If song not found in array (e.g., song added mid-gig), display request with `song_title: "Unknown Song"` and `artist: ""`. Don't fall back to a DB query — that reintroduces the N+1. The performer can identify the song from context.

### Research Insight: `.find()` vs Map

Performance review confirmed: at 50-100 songs, `songs.find()` completes in microseconds. A `Map` would cost more to construct than it saves. Use `.find()` for simplicity. Revisit only if song catalog exceeds 1,000 (won't happen for this product).

**Files changed:**
- `components/request-queue.tsx` — props interface + INSERT handler
- `app/performer/dashboard/page.tsx` — pass `allSongs` prop

#### Fix #5: Extract shared gig verification helper

**Problem:** `app/api/gig/dismiss/route.ts:29-37`, `toggle:29-37`, `undo-dismiss:29-37` — identical 9-line gig ownership check duplicated 3 times.

**Fix:** The goal is DRY code, not round-trip reduction. The extra query is a single-row index lookup (~5ms) — negligible for a single-performer dashboard. Combining it into the mutation would require Supabase subqueries which the JS client doesn't support cleanly.

**However**, for `toggle/route.ts` specifically, the gig verification CAN be combined since it updates the `gigs` table directly: `.update({ requests_open }).eq("id", gigId).eq("is_active", true).select("id").single()` — check empty result for 404.

For `dismiss` and `undo-dismiss` (which update `song_requests`), extract a shared helper:

**New helper** in `lib/supabase/server.ts` (or inline in each route — keep it simple):

Actually, on reflection: 3 routes, 9 lines each = 27 lines of duplication. A helper saves ~18 lines but adds indirection. Per the project's "match complexity to concurrency" lesson and the simplicity reviewer's finding that this is a 15-route app, the DRY gain is marginal. **Revised decision: combine the check into the mutation for `toggle` only (saves a round trip), leave `dismiss` and `undo-dismiss` as-is.** This is the smallest change that addresses the actual performance concern (toggle is the most-tapped route during a gig).

**File:** `app/api/gig/toggle/route.ts` — remove lines 29-37 (separate verification), add `.eq("is_active", true)` to the update query, check for empty result.

#### Fix #6: Submit-debrief CAS guard + cleanup

**Problem:** `app/api/session/submit-debrief/route.ts:85-88` — UPDATE filters by `id` only, not `status`. Unlike go-live/end-set which use atomic CAS.

**Fix:** Match the go-live/end-set pattern exactly:
1. Remove the separate SELECT + status check (lines 69-83) — the CAS guard makes it redundant
2. Add `.eq("status", "post_set")` to the UPDATE (line 88)
3. Add `.select("id").single()` to check result
4. Handle `!data && !error` as 409 Conflict ("Session not found or not in post_set status")

**Also in this file (Fix #10):** Remove `JSON.parse(JSON.stringify(postSetData))` on line 87. The object is already plain primitives constructed on lines 55-64. All `undefined` values are mapped to `null` by ternary expressions. Safe to pass directly.

**File:** `app/api/session/submit-debrief/route.ts`

**Verification:** Submit a debrief, then try submitting again — second attempt must return 409.

#### Fix #7: Restore ISR on guest page

**Problem:** `app/r/[slug]/page.tsx:13` — calls `createClient()` which calls `cookies()`, opting out of ISR despite `revalidate = 60`.

**Fix:** Change `createClient()` to `createAnonClient()`. The guest page only reads public data (active gigs, active songs) — it needs no cookies or auth context. The anon key respects RLS policies, which correctly scope to `anon` role reads.

**File:** `app/r/[slug]/page.tsx` — change import and client creation (2 lines). Remove `await` since `createAnonClient()` is synchronous.

**Verification (feed_forward risk — confidence upgraded):** After deploying, check response headers on `/r/alejandro`:
- Look for `x-vercel-cache: HIT` or `STALE` (confirms ISR is working)
- Or check `Cache-Control` header includes `s-maxage=60`
- **Risk is lower than originally assessed:** Next.js 16.1.6 docs confirm that ONLY `cookies()`, `headers()`, `searchParams`, `connection`, and `draftMode` opt out of Full Route Cache. `params` as a Promise does NOT — the official ISR example uses `params: Promise<{ id: string }>` with `revalidate = 60`. Removing `cookies()` should be sufficient.
- **Fallback if ISR still doesn't work:** Set `export const dynamic = 'force-static'` — this forces static rendering and returns empty values for `cookies()`/`headers()`, which is safe since the guest page doesn't use them. But this should not be needed.

### Research Insight: ISR Staleness is Safe

Performance review confirmed 60-second cache is safe for the guest page:
- Song list changes when performer edits setlist (before gigs, not during)
- Worst case: guest sees a 60-second-old song list
- Request submission goes through API route (always dynamic) — no stale write path
- Vibes and queue state are fetched client-side via Supabase Realtime, not from ISR page
- If faster invalidation is ever needed, call `revalidatePath("/r/alejandro")` from the setlist toggle endpoint (already done there)

### Step 3: P3 Quick Wins

All independent, no ordering constraints.

#### Fix #8: CLAUDE.md docs fix
**File:** `CLAUDE.md` — change `VibeType` to `Vibe` in Key Conventions section

#### Fix #9: Delete dead types
**File:** `lib/supabase/types.ts:80-92` — remove `ENERGY_LEVEL_VALUES`, `EnergyLevel`, `REPERTOIRE_TYPE_VALUES`, `RepertoireType`

**Pre-check:** Grep confirms these are not imported anywhere in app code. They correspond to DB columns (`songs.energy_level`, `songs.repertoire_type`) but no application code references the types. Re-add in 30 seconds when a feature needs them.

#### Fix #11: useMemo in SongLogFab
**File:** `components/song-log-fab.tsx:33` — wrap `new Set(logs.map(...))` in `useMemo(() => ..., [logs])`

#### Fix #12: useMemo for window.location.origin
**File:** `components/request-queue.tsx:319` — wrap in `useMemo(() => typeof window !== "undefined" ? \`...\` : "", [])`

## Technical Considerations

- **Architecture impact:** None. No new tables, no new pages, no new components. One new RPC function, one new client helper, surgical edits to existing files.
- **Performance:** Fixes #4 (N+1), #5 (round trip on toggle), #7 (ISR) directly improve gig-time performance.
- **Security:** Fixes #1 (data integrity), #2 (RLS enforcement), #3 (secret verification) close real gaps.
- **Migration:** One migration file for the RPC function. Forward-only — the RPC is additive, doesn't modify existing tables or constraints. Rollback: drop the function and revert the route handler.

## What Must NOT Change

- Guest request flow (`song-card.tsx` insert path — uses browser client + RLS, untouched)
- Performer auth flow (JWT cookie auth in `lib/auth.ts`, untouched)
- Realtime subscription structure (channel names, event types in `request-queue.tsx`, untouched)
- Dashboard state machine transitions (pre_set -> live -> post_set -> complete, untouched)
- Any visual/UI behavior (no CSS, no markup changes beyond the memoized values)

## Acceptance Criteria

- [ ] `git log --all -p -- .env` shows no committed secrets (Fix #3)
- [ ] Rapid double-tap on "Log Song" produces sequential set_positions, never duplicates (Fix #1)
- [ ] Sending a vibe on a request that already has one returns an error, not a silent overwrite (Fix #2)
- [ ] Dashboard Realtime INSERT handler does zero DB queries for song details (Fix #4)
- [ ] `toggle` route makes 1 DB round trip, not 2 (Fix #5)
- [ ] Double-submit of debrief returns 409 Conflict (Fix #6)
- [ ] Guest page response headers show ISR cache behavior (Fix #7)
- [ ] CLAUDE.md references `Vibe`, not `VibeType` (Fix #8)
- [ ] `grep -r "EnergyLevel\|RepertoireType" lib/ components/ app/` returns zero results (Fix #9)
- [ ] No `JSON.parse(JSON.stringify())` in submit-debrief (Fix #10)
- [ ] `SongLogFab` set creation is memoized (Fix #11)
- [ ] `audienceUrl` in request-queue is memoized (Fix #12)

## Commit Strategy

4 commits, grouped by dependency:

1. `fix(supabase): add createAnonClient helper` — Step 0
2. `fix(api): P1 audit fixes — atomic set_position, vibe RLS, secret verified` — Step 1
3. `fix(api): P2 audit fixes — N+1 query, toggle round trip, debrief CAS, guest ISR` — Step 2
4. `fix: P3 audit quick wins — dead types, docs, memoization` — Step 3

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| RPC function fails on Supabase free tier | RPC is standard PL/SQL, no extensions needed. `count_session_requests` RPC already works. |
| Concurrent set_position race within RPC | UNIQUE constraint `(session_id, set_position)` catches duplicates. API route retries once on error code 23505. |
| RPC returns NULL silently when session not live | API route explicitly checks for null result, returns 409. Not an error — it's the expected CAS behavior. |
| ISR still defeated after anon client swap | **Risk downgraded** — Next.js 16 docs confirm `params` Promise does NOT opt out. Fallback: `export const dynamic = 'force-static'`. |
| `allSongs` prop stale if song added mid-gig | Display "Unknown Song" for unmatched IDs. Performer can identify from context. |
| Migration applied to prod before code deploys | Push code first (Vercel auto-deploys from main), then apply migration. Route falls back to existing behavior until RPC exists. |

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-04-07-audit-remediation-brainstorm.md](docs/brainstorms/2026-04-07-audit-remediation-brainstorm.md) — scope decisions, prior lessons, resolved questions
- **CAS pattern reference:** `app/api/session/go-live/route.ts:27-33` — atomic update with `.eq("status", "pre_set")`
- **RLS architecture:** `supabase/schema.sql:176-183` — column-level GRANT + vibe IS NULL policy
- **Prior lesson (RLS defense-in-depth):** [docs/solutions/diagnostic-fix-session-rls-races-perf.md](docs/solutions/diagnostic-fix-session-rls-races-perf.md)
- **Prior lesson (service vs anon client):** [docs/solutions/setlist-management-review-fixes.md](docs/solutions/setlist-management-review-fixes.md)

## Plan Quality Gate

1. **What exactly is changing?** 1 new RPC function, 1 new client helper, ~9 surgical edits across 8 existing files. No new pages, components, or tables.
2. **What must not change?** Guest request flow, performer auth, Realtime subscriptions, dashboard state machine, all visual behavior.
3. **How will we know it worked?** 12 acceptance criteria above, each verifiable with a single action or command.
4. **What is the most likely way this plan is wrong?** ~~The ISR fix (#7)~~ **Updated after deepening:** ISR risk downgraded — Next.js 16 docs confirm `params` Promise does not opt out. New most-likely failure: the RPC `insert_song_log` returning NULL when session is not live, and the API route not handling it correctly (silent 200 with empty body instead of 409). This is why the plan specifies explicit null-checking with a distinct error response.

## Feed-Forward

- **Hardest decision:** Folding the session-status check into the RPC (Fix #1). The brainstorm only mentioned set_position atomicity, but SpecFlow correctly identified that leaving the status check separate creates a remaining TOCTOU gap. The RPC now does all three operations atomically.
- **Rejected alternatives:** (1) UNIQUE constraint + retry for set_position — rejected for RPC's cleaner atomicity. (2) Shared `verifyActiveGig()` helper for 3 routes — rejected as marginal DRY gain for a 15-route app; only combined the check for `toggle` where it saves a real round trip. (3) Soft-delete migration for undo-log — reclassified as correct behavior in brainstorm.
- **Least confident:** RPC null-handling (Fix #1). The function silently returns NULL when the session isn't live — the API route must distinguish "null = session not live" from "error = DB failure" and "23505 = retry race". Three distinct code paths in the error handler. ISR (Fix #7) was previously the top risk but was downgraded after Context7 research confirmed `params` Promise doesn't affect caching.
