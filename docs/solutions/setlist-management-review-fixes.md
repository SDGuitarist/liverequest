---
title: "Setlist Management Review Fixes — RLS Bug, Optimistic UI Simplification, inFlight UX"
date: 2026-03-10
category: code-review
tags:
  - rls
  - optimistic-ui
  - simplification
  - ux
  - supabase
severity: mixed (P1, P2)
component:
  - app/performer/dashboard/page.tsx
  - components/setlist-manager.tsx
  - app/api/songs/list/route.ts
resolution_time: "~20 minutes"
related_issues:
  - "021-complete-p1-toggle-disabled-during-inflight"
  - "022-complete-p2-simplify-optimistic-ui-revert-on-error"
  - "027-complete-p1-dashboard-rls-hides-inactive-songs"
  - "023-rejected-p2-list-route-service-client-rls"
commits: ["e36158f", "a3e5ef1"]
---

# Setlist Management Review Fixes — RLS Bug, Optimistic UI Simplification, inFlight UX

## Problem

Three review findings from the Setlist Management feature, caught by `/workflows:review` and browser testing before merge:

1. **027 (P1 — bug):** The RLS policy on `songs` only allows `anon` to read active songs (`is_active = true`). The dashboard page used `createClient()` (anon role), so toggling a song inactive made it disappear from the setlist manager on the next page load. The performer could not toggle it back on.

2. **022 (P2 — over-engineering):** The optimistic UI accumulated three defensive layers — a generation counter (`generationRef`), a 2-second self-heal timer (`healTimerRef`), and `refetchSongs`/`revertAndHeal` callbacks. The generation counter had a real bug: if song A failed and scheduled a self-heal, then song B was toggled (bumping generation), song A's heal was silently dropped. For a single-user toggle list, simple revert-on-error is sufficient.

3. **021 (P1 — UX):** The in-flight guard silently swallowed taps during pending API requests. The toggle looked clickable but did nothing — no visual feedback, no disabled state. Confusing during a live gig.

Additionally, **023 was rejected** — it recommended switching the songs list API route from `createServiceClient()` to `createClient()`, but the RLS finding (027) proved the service client is required. Switching would have hidden inactive songs from the self-heal refetch too.

## Root Cause

### RLS bug (027)
The `songs` table has an RLS policy: `anon` can only SELECT where `is_active = true`. This is correct for the guest page — guests should only see active songs. But the dashboard page also used the anon client, so it was subject to the same restriction. Admin views that need to see all records must use `createServiceClient()`.

### Over-engineered self-heal (022)
The generation counter + heal timer pattern was borrowed from `RequestQueue`, which handles concurrent guest requests and Supabase Realtime — a much harder concurrency problem. For a single-performer toggle list with no Realtime subscription, this complexity was unnecessary and introduced its own bug (cross-song generation counter interference).

### Silent inFlight swallow (021)
The `inFlight` ref prevented duplicate API calls (correct) but was invisible to React's render cycle. No re-render occurred, so the button appeared fully interactive while requests were pending.

## Solution

### Fix 1: Service client for songs query (commit e36158f)
Split the dashboard page's parallel fetch: `createClient()` for song_requests (RLS applies — correct), `createServiceClient()` for songs (bypasses RLS — sees inactive songs).

```typescript
const supabase = await createClient();
const supabaseService = createServiceClient();
const [{ data: requests }, { data: songs }] = await Promise.all([
  supabase.from("song_requests")...,    // anon, RLS filters by gig
  supabaseService.from("songs")...,     // service, sees all songs
]);
```

### Fix 2: Simplified optimistic UI (commit a3e5ef1)
Replaced generation counter, heal timer, refetchSongs, and revertAndHeal with a single revert-on-error pattern. Component went from 149 to 105 lines (44 lines removed, 3 refs eliminated, 2 useCallbacks eliminated).

```typescript
const handleToggle = useCallback(async (songId: string, newActive: boolean) => {
  if (inFlight.has(songId)) return;
  setInFlight(prev => new Set(prev).add(songId));
  setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_active: newActive } : s));
  try {
    const res = await fetch("/api/songs/toggle", { ... });
    if (!res.ok) setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_active: !newActive } : s));
  } catch {
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_active: !newActive } : s));
  } finally {
    setInFlight(prev => { const next = new Set(prev); next.delete(songId); return next; });
  }
}, []);
```

### Fix 3: Disabled state during inFlight (commit e36158f)
Changed `inFlight` from `useRef<Set<string>>` to `useState<Set<string>>` so changes trigger re-renders. Toggle buttons now show `disabled` attribute + `opacity-50 cursor-not-allowed` while their API request is pending.

## What Didn't Change

- Guest page (`app/r/[slug]/page.tsx`) — still uses anon client, still only sees active songs (correct)
- Song toggle API route (`app/api/songs/toggle/route.ts`) — unchanged, uses service client for mutations
- Dashboard tabs (`components/dashboard-tabs.tsx`) — unchanged, CSS-hidden tab switching
- RLS policies — no schema changes needed
- Songs list API route (`app/api/songs/list/route.ts`) — kept service client (023 rejected)

## Risk Resolution

This section traces the Feed-Forward risk chain from brainstorm through review.

**Plan flagged risk:** "Guest page cache behavior is uncertain — `revalidate=60` but `cookies()` may force dynamic rendering. Exact Vercel caching behavior must be verified."

**What review actually found:** The guest cache question turned out to be a secondary concern. The real blocker was RLS — the anon client hid inactive songs from the performer's own dashboard, not just from guests. The plan correctly specified "fetch ALL songs (no `is_active` filter)" but didn't account for RLS enforcing that filter server-side regardless of the query.

**Lesson:** When the plan says "no filter," verify that RLS doesn't add one. RLS policies are invisible query filters — the SQL you write isn't the SQL that runs. Admin views that need unfiltered access must use the service client. This extends the existing "RLS defense-in-depth" pattern: defense-in-depth means RLS protects public access, but admin views must explicitly bypass it.

**Guest cache resolution:** The guest page cache behavior was verified during Phase 4 (working as expected with `revalidatePath`). Not a blocker.

## Open P3s (Not Blocking Merge)

| Todo | Issue | Status |
|------|-------|--------|
| 024 | `select("*")` could use explicit columns | Pending — 25-row table, not a concern now |
| 025 | Hardcoded slug in `revalidatePath` | Pending — tracked as known risk for dynamic slug cycle |
| 026 | Toggle response could return updated record | Pending — nice-to-have, no UX impact |

## Feed-Forward

- **Hardest decision:** Using `createServiceClient()` on a server page. The project convention is "RLS defense-in-depth" — but admin views are the exception. The service client is appropriate when the performer needs to see data that RLS correctly hides from guests. We kept the anon client for song_requests to maintain RLS there.
- **Rejected alternatives:** (1) Adding a new RLS policy for authenticated reads — rejected because performer auth uses JWT cookies, not Supabase Auth, so there's no `authenticated` role to policy against. (2) Per-song heal timers instead of simple revert — rejected because single-performer use case doesn't justify the complexity. (3) Switching list API route to anon client (023) — rejected because it would break the self-heal refetch for the same RLS reason.
- **Least confident:** Whether the simplified revert-on-error is sufficient if the API partially succeeds (updates DB but network drops before response reaches client). In theory, the toggle would revert locally while the DB has the new value. This drift resolves on the next page load. Acceptable for a 25-song single-performer scenario — not acceptable if we add Realtime to the setlist or scale to multiple performers.
