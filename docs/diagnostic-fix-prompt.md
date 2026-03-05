# LiveRequest — Diagnostic Fix Session

Read this entire prompt before starting. This is a Work phase following a 7-agent code review diagnostic. Fix each issue in order, committing after each fix (~50-100 lines per commit). Push after every 3 commits.

## Fix Order

### Fix 1: Tighten RLS policies (Security P1 — root cause)
**Problem:** RLS policies for DELETE on `song_requests` and UPDATE on `gigs` are open to the `anon` role. Anyone with the public Supabase URL + anon key can call the REST API directly and delete requests or toggle gigs, bypassing server auth entirely.
**Files:** `supabase/schema.sql` (lines 117-126)
**Fix:** Remove the anon DELETE policy on `song_requests` and the anon UPDATE policy on `gigs`. In the API routes (`app/api/gig/dismiss/route.ts`, `app/api/gig/toggle/route.ts`), switch from the anon key to a `SUPABASE_SERVICE_ROLE_KEY` env var using a new server client that uses the service role. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.example`. The service role key bypasses RLS, so the API route's cookie check becomes the sole auth gate — which is the correct architecture.

### Fix 2: Add input validation to API routes (Security + TypeScript P1)
**Problem:** All 3 API routes call `await request.json()` with no try/catch, no type validation. The return type is `any`, flowing unvalidated into Supabase queries.
**Files:** `app/api/auth/route.ts:5`, `app/api/gig/dismiss/route.ts:13`, `app/api/gig/toggle/route.ts:13`
**Fix:** Wrap each `request.json()` in try/catch (return 400 on parse error). Add manual type guards for each field: `gigId` and `songId` must be `typeof === "string"`, `requestsOpen` must be `typeof === "boolean"`, `password` must be `typeof === "string"`. Keep it simple — no need for zod at this scale.

### Fix 3: Fix realtime race conditions (Races P1)
**Problem 3a:** `fetchRequests` has no cancellation — stale responses overwrite fresh state.
**Problem 3b:** Realtime INSERT handler races `fetchRequests` — items can appear twice in queue.
**Problem 3c:** Toggle button has no ref-based mutex — fast double-tap sends two identical API calls.
**Files:** `components/request-queue.tsx` (lines 82-93, 107-140, 187-205)
**Fix 3a:** Add a `fetchGeneration` ref (monotonic counter). Increment on each fetch, discard results if generation has advanced.
**Fix 3b:** Inside the realtime handler's `setRequests` callback, re-check `prev.some((r) => r.id === newReq.id)` before prepending. This catches duplicates regardless of timing.
**Fix 3c:** Add a `toggleInFlight` ref (like `isSubmitting` in `song-card.tsx`). Check before proceeding, set true at start, false at end.

### Fix 4: Fix StrictMode wake lock leak (Races P1)
**Problem:** React StrictMode double-mount causes orphaned wake lock sentinels (battery drain). The async `navigator.wakeLock.request()` can resolve after cleanup runs.
**File:** `components/request-queue.tsx` (lines 157-184)
**Fix:** Add a `cancelled` boolean in the effect. After `await navigator.wakeLock.request()`, check if `cancelled` — if so, immediately release the just-acquired lock. Set `cancelled = true` in the cleanup function.

### Fix 5: Add useMemo / React.memo (Performance P1)
**Problem 5a:** `groupRequests(requests)` recomputes O(n log n) on every render including 30s timer ticks.
**Problem 5b:** `filteredSongs` recomputes on every keystroke without memoization.
**Problem 5c:** Every SongCard re-renders when any song's state changes.
**Files:** `components/request-queue.tsx:224`, `components/song-list.tsx:35-41`, `components/song-card.tsx`
**Fix 5a:** Wrap with `useMemo(() => groupRequests(requests), [requests])`.
**Fix 5b:** Wrap with `useMemo(() => { const q = search.toLowerCase(); return songs.filter(...) }, [songs, search])`.
**Fix 5c:** Wrap SongCard export with `React.memo`. Extract `{ status: "idle" }` fallback to a module-level constant `IDLE_STATE` so memo's shallow compare works.

### Fix 6: Replace static auth cookie with crypto token (Security P1)
**Problem:** Auth cookie is the literal string `"authenticated"` — trivially forgeable.
**File:** `app/api/auth/route.ts:36`, checks in `dismiss/route.ts:9`, `toggle/route.ts:9`, `dashboard/page.tsx:13`
**Fix:** On successful login, generate `crypto.randomUUID()` as the token value. Store it in a module-level `Set<string>` (fine for single-instance MVP). Set the cookie to this token. In the auth check, verify the cookie value exists in the Set. Extract the auth check to a shared `lib/auth.ts` helper used by all 3 locations. This also fixes the duplicated auth check pattern.

### Fix 7: Derive pendingCount from state (Races P2)
**Problem:** `pendingCount` ref is manually incremented/decremented and can drift.
**File:** `components/song-list.tsx:30,43-57`
**Fix:** Replace the ref with a derived value: `const pendingCount = Object.values(requestStates).filter(s => s.status === "sending").length`. Remove the ref and all manual increment/decrement logic.

### Fix 8: Cache Supabase client in SongCard (Performance P1 + Races P2)
**Problem:** `createClient()` called inside `handleRequest()` on every tap.
**File:** `components/song-card.tsx:61`
**Fix:** Add `const supabase = useRef(createClient())` at component top. Use `supabase.current` in `handleRequest` and `fetchCountInBackground`.

### Fix 9: Add security headers (Security P2)
**File:** `next.config.ts`
**Fix:** Add `headers()` config returning X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy: camera=(), microphone=(), geolocation=().

### Fix 10: Stop leaking Supabase errors to client (Security P2)
**Files:** `app/api/gig/dismiss/route.ts:23`, `app/api/gig/toggle/route.ts:22`
**Fix:** Replace `{ error: error.message }` with `{ error: "Operation failed" }`. Add `console.error("Supabase error:", error)` for server-side debugging.

### Fix 11: Fix z-index layering bug (Simplicity)
**Problem:** Noise grain overlay at `z-50` renders above the `z-40` confirmation overlay.
**File:** `app/globals.css:157-165`
**Fix:** Change `z-index: 50` to `z-index: 1`.

### Fix 12: Extract shared RequestState type + remove unused type exports (TypeScript P2 + Simplicity)
**Files:** `components/song-card.tsx:9-13`, `components/song-list.tsx:8-12`, `lib/supabase/types.ts:6-12`
**Fix:** Define `RequestState` once in `lib/types.ts`, import in both components. Remove unused `SongRequest`, `SongInsert`, `GigInsert`, `SongRequestInsert` exports from `lib/supabase/types.ts`.

### Fix 13: Replace env var non-null assertions with fail-fast helper (TypeScript P1)
**Files:** `lib/supabase/client.ts:6-7`, `lib/supabase/server.ts:9-10`
**Fix:** Add a `requireEnv(key: string): string` helper that throws a clear error if the env var is missing. Use it instead of `!`.

## Rules
- One fix per commit. Commit message: `fix: [short description]`
- Push after every 3 commits
- Don't refactor surrounding code — fix only what's listed
- Don't add tests, docs, or types beyond what each fix requires
- If a fix turns out to be more complex than expected, commit what you have and move to the next
