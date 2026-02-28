---
title: "Diagnostic Fix Session — RLS, Race Conditions & Performance"
category: security-and-reliability
tags: [rls, supabase, race-conditions, security-headers, input-validation, react-memo, wake-lock, auth, performance]
module: Full Stack
symptom: "7-agent code review found 13 issues across security, races, and performance"
root_cause: "Open anon RLS policies allowed unauthenticated Supabase REST access, bypassing API auth entirely"
---

# Diagnostic Fix Session — RLS, Race Conditions & Performance

## Problem

A 7-agent code review diagnostic surfaced 13 issues in LiveRequest spanning security (P1), race conditions (P1-P2), performance (P1), and code quality (P2). The root cause — open RLS policies on the `anon` role — meant anyone with the public Supabase URL and anon key could DELETE song requests or UPDATE gig state directly via the REST API, bypassing the API route's cookie auth entirely.

Secondary issues included: no input validation on API routes, realtime race conditions causing duplicate items in the request queue, a StrictMode wake lock leak, missing memoization on expensive renders, a forgeable auth cookie, and leaked Supabase error messages.

## Solution

All 13 fixes were applied in order over a single work session (commits `8bed600` through `7fed80e`), one fix per commit.

### Security Fixes (5 commits)

**1. Tighten RLS policies** (`8bed600`) — Removed `anon` DELETE policy on `song_requests` and `anon` UPDATE policy on `gigs` from `schema.sql`. Switched API routes (`dismiss/route.ts`, `toggle/route.ts`) from the anon key to a `SUPABASE_SERVICE_ROLE_KEY` via a new server client. The service role bypasses RLS, making the API route's cookie check the sole auth gate.

**2. Input validation** (`be8e751`) — Wrapped every `request.json()` call in try/catch (returns 400 on parse failure). Added manual type guards: `gigId`/`songId` must be strings, `requestsOpen` must be boolean, `password` must be string. No Zod needed at this scale.

**6. Crypto auth tokens** (`efc7c84`) — Replaced the literal `"authenticated"` cookie value with `crypto.randomUUID()`. Tokens are stored in a server-side `Set<string>`. Extracted a shared `lib/auth.ts` helper (`isAuthenticated()`) used by all three protected routes.

**9. Security headers** (`cf202b1`) — Added `headers()` config in `next.config.ts`: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy denying camera/mic/geo.

**10. Stop leaking errors** (`8c434b7`) — Replaced `{ error: error.message }` with `{ error: "Operation failed" }` in dismiss and toggle routes. Full errors logged server-side via `console.error`.

### Race Condition Fixes (4 commits)

**3. Realtime races** (`4724191`) — Three sub-fixes: (a) `fetchGeneration` ref (monotonic counter) discards stale fetch responses; (b) realtime INSERT handler checks `prev.some(r => r.id === newReq.id)` before prepending, preventing duplicates; (c) `toggleInFlight` ref prevents double-tap from sending two toggle API calls.

**4. StrictMode wake lock leak** (`1ed3a94`) — Added `cancelled` boolean inside the effect. After `await navigator.wakeLock.request()`, checks if `cancelled` is true (set by cleanup) and immediately releases the just-acquired lock.

**7. Derive pendingCount** (`091abca`) — Replaced manually incremented/decremented ref with a derived value: `Object.values(requestStates).filter(s => s.status === "sending").length`. Eliminates drift.

### Performance Fixes (2 commits)

**5. useMemo / React.memo** (`9afb36e`) — Memoized `groupRequests(requests)` (O(n log n) on every render), memoized `filteredSongs` in song-list, and wrapped SongCard with `React.memo` plus a module-level `IDLE_STATE` constant so shallow compare works.

**8. Cache Supabase client** (`d418ee3`) — `createClient()` was called on every tap inside `handleRequest`. Moved to `useRef(createClient())` at component top, reused across handlers.

### Code Quality Fixes (2 commits)

**11. Z-index layering** (`1127941`) — Noise grain overlay was `z-50`, rendering above the `z-40` confirmation overlay. Changed to `z-index: 1`.

**12. Extract RequestState type** (`f7c94e1`) — Defined `RequestState` once in `lib/types.ts`, imported in both components. Removed unused `SongRequest`, `SongInsert`, `GigInsert`, `SongRequestInsert` exports.

**13. Fail-fast env vars** (`7fed80e`) — Added `requireEnv(key)` helper that throws a clear error if an env var is missing. Replaces non-null assertions (`!`) on `process.env` values.

## Key Lessons

1. **RLS is not middleware — it's the last line of defense.** If your RLS policies allow `anon` to DELETE/UPDATE, your API route auth is decoration. The anon key is public by design in Supabase; RLS must assume hostile callers.

2. **Service role key is the correct escape hatch.** When your app needs server-side-only access, use the service role key (which bypasses RLS) behind your own auth gate. Don't try to make RLS policies match your app's auth logic — that's two auth systems to maintain.

3. **Race conditions in React realtime apps come in threes.** Stale fetch responses, duplicate items from realtime + fetch overlap, and double-tap on mutations — these are almost always co-present. Fix all three together or you'll be back.

4. **StrictMode double-mount exposes async cleanup bugs.** Any effect that `await`s before using its result needs a `cancelled` flag checked after the await. Wake locks, WebSocket connections, and media streams all share this pattern.

5. **Derived state > manual counters.** A ref that's manually incremented/decremented will drift. Compute from the source of truth on each render — it's simpler and always correct.

6. **Static auth tokens are forgeable.** `"authenticated"` as a cookie value is equivalent to no auth. Always generate random tokens and validate server-side.

## Risk Resolution

- **Flagged risk:** The 7-agent review identified open `anon` RLS policies as the root cause security issue (P1). The DELETE policy on `song_requests` and UPDATE policy on `gigs` allowed unauthenticated access via the Supabase REST API, making all other API-level auth checks (cookie verification) irrelevant.
- **What happened:** Fix 1 removed both anon policies and introduced the service role key pattern. This was applied first because it was the cascade fix — it eliminated the entire class of "bypass API auth via direct REST calls." Fixes 2 (input validation), 6 (crypto tokens), 9 (security headers), and 10 (error leaking) then hardened the remaining attack surface at the API layer.
- **Verification:** After removing the anon policies, direct REST calls with the anon key now return RLS violations. Only the API routes (using the service role key behind cookie auth) can modify data.
- **Lesson:** In Supabase apps, audit RLS policies before anything else. If `anon` can write, your server-side auth is theater. The correct architecture is: restrictive RLS (deny anon writes) + service role key in API routes + your own auth gate on those routes.

## Feed-Forward

- **Hardest decision:** Whether to use a module-level `Set<string>` for auth tokens vs. a database table. Chose in-memory Set because this is a single-instance MVP — tokens clear on restart, which is acceptable. A multi-instance deploy would need Redis or DB-backed sessions.
- **Rejected alternatives:** Considered adding Zod for input validation but rejected it — three routes with 1-2 fields each don't justify the dependency. Manual type guards are clear and sufficient at this scale.
- **Least confident:** The in-memory auth token Set. It works for single-instance but will silently break under multi-instance deployment (load balancer would route to instances that don't have the token). If LiveRequest ever needs horizontal scaling, this must move to a shared store. Track this as a known limitation.
