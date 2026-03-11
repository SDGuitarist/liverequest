---
title: "feat: Setlist management tab on performer dashboard"
type: feat
status: active
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-setlist-management-brainstorm.md
feed_forward:
  risk: "Guest page cache behavior is uncertain — it sets revalidate=60 but also calls cookies() via createClient(), which may force dynamic rendering. Already-open guest pages will not auto-update regardless. Exact Vercel caching behavior must be verified in Phase 1."
  verify_first: true
---

# feat: Setlist Management Tab on Performer Dashboard

## Overview

Add a "Setlist" tab to the performer dashboard so the performer can toggle songs visible/hidden from the guest request list on the fly during a gig. Toggle flips `is_active` in the Supabase `songs` table. Designed for upgrade to GigPrep API integration (Layer 4) later.

(See brainstorm: `docs/brainstorms/2026-03-10-setlist-management-brainstorm.md`)

## Problem Statement

The performer must log into the Supabase Dashboard to change the song list. That's not viable mid-gig. Thursday's gig at Japanese Friendship Garden needs in-app setlist control.

## What Exactly Is Changing

### New files (3)
1. **`components/setlist-manager.tsx`** — Client component: song list with toggle switches
2. **`app/api/songs/toggle/route.ts`** — POST endpoint: flip `is_active` + revalidate guest page
3. **`components/dashboard-tabs.tsx`** — Client component: tab switcher wrapping RequestQueue and SetlistManager

### Modified files (1)
4. **`app/performer/dashboard/page.tsx`** — Fetch all songs (including inactive), pass to DashboardTabs

(`lib/supabase/types.ts` already exports `Song` — no changes needed.)

### Total: ~200-250 lines of new code

## What Must NOT Change

- Guest request page (`app/r/[slug]/page.tsx`) — no modifications
- Request queue behavior — realtime subscription must stay alive when viewing Setlist tab
- Existing API routes (`/api/gig/*`) — untouched
- RLS policies — no changes (service role key bypasses RLS for mutations)
- Song data model — no schema migration, using existing `is_active` column
- Auth flow — reuse existing `isAuthenticated()` check

## Proposed Solution

### Architecture

```
app/performer/dashboard/page.tsx (server)
  ├── fetches gig + requests (existing)
  ├── fetches ALL songs (new query: no is_active filter)
  └── renders <DashboardTabs>
        ├── tab: "Requests" → <RequestQueue /> (existing, always mounted)
        └── tab: "Setlist"  → <SetlistManager songs={songs} />
```

**Critical decision:** Both components stay mounted. Tab switching uses CSS `hidden` class so `RequestQueue`'s realtime subscription is never torn down. The performer never misses incoming requests while managing the setlist.

**Implementation constraint:** `DashboardTabs` must NOT conditionally render, key-remount, or otherwise unmount `RequestQueue`. `RequestQueue` owns the Supabase realtime subscription and the wake lock — unmounting it kills both. Always render both children; toggle visibility with CSS `hidden` only.

### Component: `dashboard-tabs.tsx` (~40 lines)

```
- State: activeTab ("requests" | "setlist")
- Renders tab bar with two buttons
- Renders both children, applies `hidden` class to inactive tab
```

### Component: `setlist-manager.tsx` (~120 lines)

```
- Props: songs: Song[] (all songs, active and inactive)
- Local state: songs array (for optimistic updates)
- Each song row: title, artist, toggle switch (on = active/visible to guests)
- Toggle handler:
  1. Optimistic UI flip
  2. POST /api/songs/toggle { songId, isActive }
  3. If response is non-2xx: revert optimistic state + refetch after 2s to self-heal
  4. Only treat 2xx with { success: true } as confirmation
- Double-tap guard: inFlightRef per songId
- Sort: alphabetical by title
- (Optional) Summary line: "X of Y songs active" — not in brainstorm, include only if trivial
- Search: deferred (only 25 songs currently; add when catalog grows)
```

### API Route: `app/api/songs/toggle/route.ts` (~45 lines)

Auth and validation follow the existing pattern from `app/api/gig/toggle/route.ts` (steps 1-5 below). The mutation step intentionally diverges: the exemplar uses a separate SELECT to verify the row exists, then a bare `.update()`. This route instead chains `.select("id")` onto the UPDATE so a single query both mutates and detects 0 matched rows, allowing a 404 response without a second round-trip.

```
1. isAuthenticated() check → 401                          (same as exemplar)
2. Parse JSON body → 400 on failure                       (same)
3. Validate songId with isUUID() → 400                    (same)
4. Validate isActive is boolean → 400                     (same)
5. createServiceClient() (bypasses RLS)                   (same)
6. UPDATE songs SET is_active = $isActive WHERE id = $songId
   — chain .select("id") to get the updated row back      (differs from exemplar)
7. If data is null or empty array → return 404. MUST NOT return success if no row was updated.
8. revalidatePath('/r/alejandro') — best-effort cache invalidation. Does NOT push updates to already-open guest pages.
9. Return { success: true }
```

**Failure-path — concrete Supabase pattern:**
```ts
const { data, error } = await supabase
  .from("songs")
  .update({ is_active: isActive })
  .eq("id", songId)
  .select("id");  // returns the updated row(s)

if (error) {
  console.error("song toggle failed:", error.code, error.message);
  return NextResponse.json({ error: "Operation failed" }, { status: 500 });
}
if (!data || data.length === 0) {
  return NextResponse.json({ error: "Song not found" }, { status: 404 });
}
```
- The `.select("id")` chain makes Supabase return the matched rows. If `songId` doesn't exist, `data` is an empty array — not an error.
- The client MUST treat any non-2xx response (or missing `{ success: true }` in body) as a failure, revert the optimistic UI, and trigger a 2s self-heal refetch.

**Key design choice:** Send explicit `{ songId: string, isActive: boolean }`, not a server-side toggle. This is idempotent — double-taps and retries are safe. Matches existing `toggle/route.ts` which sends `requestsOpen: boolean` explicitly.

### Data fetch change in `page.tsx`

Add one query alongside existing gig/requests fetch:

```ts
const { data: songs } = await supabase
  .from("songs")
  .select("*")
  .order("title", { ascending: true });
```

No `is_active` filter — performer sees the full catalog.

## Edge Cases Resolved

| Edge case | Resolution |
|-----------|-----------|
| Song deactivated but has pending requests | Requests remain visible on dashboard. Toggle only affects guest page. |
| All songs deactivated | Guest page shows "No songs available" (existing empty state). Setlist tab shows all songs as inactive — no special warning needed. |
| Guest requests song after performer toggled it off | Allowed. Request is valid — performer hid the song from future guests, not from in-flight requests. Already-open guest pages will not auto-update; guests must refresh or re-open to see the change. The exact cache/revalidation timing on Vercel must be verified (see Risks). |
| Double-tap on toggle | In-flight guard per songId prevents duplicate API calls. |
| Toggle fails (network error or non-2xx) | Optimistic UI reverts, delayed refetch self-heals (2s). Client must check `response.ok` — any non-2xx triggers the revert path. Existing pattern from dismiss flow. |
| Toggle returns success but no row updated | Route must check update count and return 404 if 0 rows matched. Client treats 404 as error and reverts. |
| Phone locks/unlocks during setlist view | No special handling needed. Song list is static (not realtime). Performer taps toggle when ready. |
| Two browser tabs on dashboard | Explicit `isActive` values avoid toggle-inversion bugs (no relative flip). However, stale tabs can overwrite a newer toggle from another tab — last write wins. Acceptable for the current single-performer Thursday scenario; not a concern in practice since the performer uses one device. |

## Acceptance Criteria

- [ ] Performer dashboard shows "Requests" and "Setlist" tabs
- [ ] Default tab is "Requests" (existing behavior preserved)
- [ ] Setlist tab shows all songs with active/inactive toggle
- [ ] Toggling a song calls POST `/api/songs/toggle` with auth check
- [ ] Toggle route returns 404 if no song row was updated (uses `.select("id")` chain to detect empty result)
- [ ] Toggle updates `is_active` in Supabase and calls `revalidatePath` (best-effort cache invalidation)
- [ ] Already-open guest pages do NOT auto-update (expected — no realtime on guest page)
- [ ] A manual refresh or new guest page load reflects the latest `is_active` state
- [ ] Exact cache timing on Vercel verified in Phase 1 (may be ISR, may be dynamic due to `cookies()` call — see Risks)
- [ ] Existing requests for deactivated songs remain visible on dashboard
- [ ] RequestQueue realtime subscription stays alive when on Setlist tab
- [ ] Double-tap guard prevents duplicate API calls
- [ ] Optimistic UI with rollback on any non-2xx response
- [ ] Works on mobile (performer's primary device during gigs)

## Implementation Phases

### Phase 1: API route (~45 lines)
- Create `app/api/songs/toggle/route.ts`
- Auth check, validation, service client mutation, revalidatePath
- **Commit checkpoint**

### Phase 2: Dashboard tabs (~40 lines)
- Create `components/dashboard-tabs.tsx`
- Modify `app/performer/dashboard/page.tsx` to fetch all songs and render DashboardTabs
- Both children always mounted, CSS `hidden` for inactive tab
- **Commit checkpoint**

### Phase 3: Setlist manager (~120 lines)
- Create `components/setlist-manager.tsx`
- Toggle switches, optimistic UI, double-tap guard
- (Optional) Summary line with active count — only if trivial to add
- **Commit checkpoint**

### Phase 4: Verify
- Toggle a song, open guest page in a fresh tab — confirm it reflects the change
- Confirm an already-open guest tab does NOT auto-update (expected)
- On Vercel: check response headers (`x-vercel-cache`, `cache-control`) to determine actual cache behavior
- Verify realtime requests still arrive while on Setlist tab
- Toggle a nonexistent songId (via curl or devtools) — confirm 404 response
- Test on mobile viewport
- **Commit checkpoint**

## GigPrep Upgrade Path (Layer 4 — future)

The toggle API route we build now is a building block. Future integration:

```
POST /api/songs/sync   (new, Layer 4)
  Body: { songs: [{title, artist, ...}], source: "gigprep" }
  Auth: X-API-Key header (matches Lead Responder ↔ PF-Intel pattern)
  Action: Upsert songs, set is_active based on list membership
```

The internal toggle function and Supabase mutation pattern are reusable. No refactoring needed — just add a new route.

## How We'll Know It Worked

1. Performer can toggle songs on/off from the dashboard during Thursday's gig
2. A guest who refreshes or opens a new browser tab sees the updated song list (active/inactive reflects the toggle)
3. A guest who already has the page open does NOT see changes without refreshing (expected, not a bug)
4. No missed requests while managing setlist (RequestQueue realtime subscription stays alive across tab switches)
5. No accidental double-toggles or stale UI states
6. Toggle route returns 404 (not 200) when given a nonexistent songId
7. Client reverts optimistic state on any non-2xx response or missing `{ success: true }`

## Most Likely Way This Plan Is Wrong

The guest page's cache behavior is not settled. It exports `revalidate = 60` (suggesting ISR), but `createClient()` calls `cookies()`, which may opt the route into fully dynamic rendering in Next.js. If the page is already dynamic, `revalidatePath` may be a no-op or behave differently than expected. If it's ISR, Vercel's edge CDN may still serve stale content briefly after invalidation. Either way, already-open guest pages will never auto-update — guests must refresh.

This uncertainty is acceptable for Thursday (guests typically open the page fresh per request), but it must be verified in Phase 1. If `revalidatePath` has no observable effect, remove it and accept whatever the default behavior is. The real fix for live updates is Supabase Realtime on the guest page — a future cycle concern.

Secondary risk: `revalidatePath('/r/alejandro')` is hardcoded to one slug. When dynamic slugs ship, this needs to revalidate the correct path.

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Guest page cache model is uncertain — `revalidate=60` suggests ISR, but `cookies()` call may force dynamic rendering. Actual Vercel behavior unknown. | Verify in Phase 1: toggle a song, then load guest page in a fresh tab. Observe response headers (`x-vercel-cache`, `cache-control`). If `revalidatePath` has no effect, remove it. |
| Already-open guest pages will not auto-update after a toggle | Expected behavior — no realtime on guest page. Not a bug. Future fix: Supabase Realtime subscription on guest page. |
| `revalidatePath` might not execute from a POST route handler in Next.js 16 | Test in Phase 1 before building UI. Fallback: remove it, accept default cache behavior. |
| Hardcoded slug in revalidatePath | Only one slug exists today. Track in known risks for dynamic slug cycle. |
| Dashboard page load slower (extra songs query) | Songs table has ~25 rows. Negligible. |
| Toggle route returns false success on bad songId | Mitigated by `.select("id")` chain — empty result array triggers 404 response. |

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-03-10-setlist-management-brainstorm.md](docs/brainstorms/2026-03-10-setlist-management-brainstorm.md) — key decisions: tab on dashboard, toggle-only scope, API endpoint upgrade path
- **API pattern exemplar:** `app/api/gig/toggle/route.ts`
- **Component pattern exemplar:** `components/request-queue.tsx`
- **Auth pattern:** `docs/solutions/deploy-vercel-cookie-auth.md`
- **Race condition patterns:** `docs/solutions/diagnostic-fix-session-rls-races-perf.md`
- **Optimistic UI patterns:** `docs/solutions/cycle1-post-review-fixes.md`
- **Platform architecture:** `/Users/alejandroguillen/Projects/pacific-flow-hub/docs/architecture/PLATFORM_ARCHITECTURE.md` (Layer 4)

## Rollback Plan

### Mid-gig fallback (no deploy needed)
- Stay on the "Requests" tab and ignore the "Setlist" tab entirely. The setlist tab is additive — ignoring it gives the exact same stable dashboard experience as before this feature. No redeploy, no code changes, no risk.
- This restores the old dashboard behavior but does NOT restore setlist-management capability. If the performer still needs to change song visibility mid-gig and the setlist feature is misbehaving, the manual last-resort fallback is the existing Supabase Dashboard workflow (log in, edit `is_active` directly).

### Deploy-based rollback (before or after the gig, not during)
1. **Minimal revert:** Revert `app/performer/dashboard/page.tsx` to remove `<DashboardTabs>` and restore direct `<RequestQueue>` rendering. One file change + `npx vercel --prod`.
2. **Full revert:** `git revert` the setlist commits (they'll be isolated per-phase commits). The `is_active` column and song data are untouched — no schema rollback needed. Redeploy.

A redeploy is NOT an immediate live-gig escape hatch — it takes minutes and risks disrupting the live dashboard. Use the mid-gig fallback during a gig; save deploy-based rollback for before/after.

## Feed-Forward

- **Hardest decision:** Keeping both tabs mounted with CSS `hidden` instead of conditional rendering. This is slightly wasteful (both components in DOM) but guarantees the realtime subscription never drops. The alternative — re-subscribing on tab switch — adds complexity and a brief window where requests could be missed.
- **Rejected alternatives:** Separate `/performer/songs` page (navigation away from live dashboard), slide-out panel (more complex UI), full CRUD (scope creep), server-side toggle inference (race condition risk), request-count badge and toggle haptics (nice-to-have but not required for Thursday — can add later).
- **Least confident:** The guest page's actual cache behavior on Vercel. It sets `revalidate = 60` but also calls `cookies()` via `createClient()`, which may force dynamic rendering. We don't know if the page is ISR-cached, dynamically rendered, or edge-cached until we verify on Vercel. `revalidatePath` is included as a best-effort optimization but may be a no-op. Test in Phase 1: toggle, reload guest page in fresh tab, check response headers. If no observable effect, remove `revalidatePath` and accept default behavior. Already-open guest pages won't update regardless.
