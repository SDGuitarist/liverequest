---
title: "feat: Setlist management tab on performer dashboard"
type: feat
status: active
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-setlist-management-brainstorm.md
feed_forward:
  risk: "revalidatePath is best-effort cache invalidation — already-open guest pages won't update until the user refreshes or navigates, and edge-cached pages may serve stale content even after invalidation"
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
- Summary line: "X of Y songs active"
- Search: deferred (only 25 songs currently; add when catalog grows)
```

### API Route: `app/api/songs/toggle/route.ts` (~45 lines)

Follows existing pattern from `app/api/gig/toggle/route.ts`:

```
1. isAuthenticated() check → 401
2. Parse JSON body → 400 on failure
3. Validate songId with isUUID() → 400
4. Validate isActive is boolean → 400
5. createServiceClient() (bypasses RLS)
6. UPDATE songs SET is_active = $isActive WHERE id = $songId
7. Check update count — if 0 rows updated, return 404 (song not found). MUST NOT return success if no row was updated.
8. revalidatePath('/r/alejandro') — best-effort cache invalidation for the next visitor/refresh. Does NOT push updates to already-open guest pages.
9. Return { success: true }
```

**Failure-path requirements:**
- If the Supabase update returns 0 rows affected (e.g., bad songId), return `{ error: "Song not found" }` with status 404.
- If the Supabase update returns an error, return status 500.
- The client MUST treat any non-2xx response as a failure, revert the optimistic UI, and refetch after 2s to self-heal.

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
| Guest requests song during stale-cache window | Allowed. Request is valid — performer hid song from future guests, not from in-flight requests. `revalidatePath` invalidates the cache for the *next* page load, but already-open guest pages won't see the change until they refresh. Acceptable for Thursday — the window is brief and the request is still valid. |
| Double-tap on toggle | In-flight guard per songId prevents duplicate API calls. |
| Toggle fails (network error or non-2xx) | Optimistic UI reverts, delayed refetch self-heals (2s). Client must check `response.ok` — any non-2xx triggers the revert path. Existing pattern from dismiss flow. |
| Toggle returns success but no row updated | Route must check update count and return 404 if 0 rows matched. Client treats 404 as error and reverts. |
| Phone locks/unlocks during setlist view | No special handling needed. Song list is static (not realtime). Performer taps toggle when ready. |
| Two browser tabs on dashboard | Each tab has independent state. No conflict — both send explicit `isActive` value, not relative toggles. |

## Acceptance Criteria

- [ ] Performer dashboard shows "Requests" and "Setlist" tabs
- [ ] Default tab is "Requests" (existing behavior preserved)
- [ ] Setlist tab shows all songs with active/inactive toggle
- [ ] Toggling a song calls POST `/api/songs/toggle` with auth check
- [ ] Toggle route returns 404 if no song row was updated (not a false success)
- [ ] Toggle updates `is_active` in Supabase and calls `revalidatePath` (best-effort — invalidates cache for the next page load, not a live push to open pages)
- [ ] Guest page reflects changes on next load/refresh after cache invalidation (not guaranteed instant for already-open pages)
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
- Summary line with active count
- **Commit checkpoint**

### Phase 4: Verify
- Manual test on dev: toggle song, check guest page updates
- Verify realtime requests still arrive while on Setlist tab
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
2. Guest page reflects changes on next load or manual refresh (cache is invalidated by `revalidatePath`, but already-open pages require a refresh)
3. No missed requests while managing setlist (subscription stays alive)
4. No accidental double-toggles or stale UI states
5. Toggle route returns 404 (not 200) when given a nonexistent songId
6. Client reverts optimistic state on any non-2xx response

## Most Likely Way This Plan Is Wrong

`revalidatePath` is best-effort cache invalidation — it tells the server to regenerate the page on the next request, but it does not push updates to already-open guest browsers. If a guest already has the page open, they won't see the toggled song disappear until they refresh. Edge caching (Vercel CDN) may also serve stale content briefly after invalidation. For Thursday's gig this is acceptable (guests typically re-open the page per request), but if it causes confusion, the real fix is Supabase Realtime on the guest page — not more aggressive revalidation.

Secondary risk: `revalidatePath('/r/alejandro')` is hardcoded to one slug. When dynamic slugs ship, this needs to revalidate the correct path.

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| `revalidatePath` is best-effort — already-open guest pages won't update until refresh; edge cache may serve stale content briefly | Accept for Thursday. Document in UI that changes apply "on next guest visit." Future fix: Supabase Realtime on guest page. |
| `revalidatePath` might not execute from a POST route handler in Next.js 16 | Test in Phase 1 before building UI. Fallback: remove it, accept 60s ISR delay. |
| Hardcoded slug in revalidatePath | Only one slug exists today. Track in known risks for dynamic slug cycle. |
| Dashboard page load slower (extra songs query) | Songs table has ~25 rows. Negligible. |
| Toggle route returns false success on bad songId | Mitigated by checking update count and returning 404 if 0 rows matched. |

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-03-10-setlist-management-brainstorm.md](docs/brainstorms/2026-03-10-setlist-management-brainstorm.md) — key decisions: tab on dashboard, toggle-only scope, API endpoint upgrade path
- **API pattern exemplar:** `app/api/gig/toggle/route.ts`
- **Component pattern exemplar:** `components/request-queue.tsx`
- **Auth pattern:** `docs/solutions/deploy-vercel-cookie-auth.md`
- **Race condition patterns:** `docs/solutions/diagnostic-fix-session-rls-races-perf.md`
- **Optimistic UI patterns:** `docs/solutions/cycle1-post-review-fixes.md`
- **Platform architecture:** `/Users/alejandroguillen/Projects/pacific-flow-hub/docs/architecture/PLATFORM_ARCHITECTURE.md` (Layer 4)

## Rollback Plan

If the setlist feature causes issues during Thursday's gig:

1. **Quick disable:** Revert `app/performer/dashboard/page.tsx` to remove `<DashboardTabs>` and restore direct `<RequestQueue>` rendering. One file change, redeploy.
2. **Full revert:** `git revert` the setlist commits (they'll be isolated per-phase commits). The `is_active` column and song data are untouched — no schema rollback needed.
3. **Mid-gig escape:** If the tab UI is confusing mid-gig, just stay on the "Requests" tab. The setlist tab is additive — ignoring it restores the old experience.

## Feed-Forward

- **Hardest decision:** Keeping both tabs mounted with CSS `hidden` instead of conditional rendering. This is slightly wasteful (both components in DOM) but guarantees the realtime subscription never drops. The alternative — re-subscribing on tab switch — adds complexity and a brief window where requests could be missed.
- **Rejected alternatives:** Separate `/performer/songs` page (navigation away from live dashboard), slide-out panel (more complex UI), full CRUD (scope creep), server-side toggle inference (race condition risk), request-count badge and toggle haptics (nice-to-have but not required for Thursday — can add later).
- **Least confident:** Whether `revalidatePath` from a POST route handler actually invalidates the ISR cache in Next.js 16 on Vercel, and whether Vercel's edge CDN serves stale content after invalidation. The brainstorm accepted 60s ISR delay as tolerable; this plan calls `revalidatePath` as an optimization but must not promise instant guest-page updates. Test in Phase 1 — if it doesn't work, accept the 60s window.
