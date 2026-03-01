---
title: "Cycle 1 Post-Review Fixes — Self-Heal Gap, Dead Code, Realtime Payload"
date: 2026-03-01
category: runtime-errors
tags:
  - optimistic-ui
  - error-recovery
  - code-quality
  - dead-code
  - realtime-sync
  - react-19
severity: medium
component:
  - components/request-queue.tsx
  - components/song-card.tsx
  - components/confirmation-overlay.tsx
resolution_time: "~30 minutes"
related_issues:
  - "012-complete-p2-re-query-after-failed-dismiss"
  - "013-complete-p3-remove-ismounted-antipattern"
  - "014-complete-p3-remove-typeof-window-guard"
  - "015-complete-p3-use-payload-played-at"
commit: "9775318"
---

# Cycle 1 Post-Review Fixes — Self-Heal Gap, Dead Code, Realtime Payload

## Problem

Four post-implementation review findings from Cycle 1 (Mark as Played + Vibe Feedback), caught by `/workflows:review` before deployment:

1. **012 (P2):** Failed dismiss/undo API calls leave optimistic UI in wrong state with no recovery
2. **013 (P3):** `isMounted` ref pattern is dead code in React 19
3. **014 (P3):** `typeof window` guard is dead code in `"use client"` component
4. **015 (P3):** Realtime INSERT handler hardcodes `played_at: null` instead of reading payload

None caused production bugs — all caught pre-deploy. Net result: -5 lines (9 added, 14 removed).

## Root Cause Analysis

### Optimistic UI recovery gap (012)
The catch blocks in `handleDismiss` and `handleUndoDismiss` did nothing — just a comment saying "the next re-query will self-heal." But no re-query fires if the performer stays on the same tab after a network failure. On venue Wi-Fi, this is a realistic failure mode.

### Legacy React patterns (013, 014)
The `isMounted` ref was carried from React 17/18 where `setState` on unmounted components produced warnings. React 19 silently no-ops this. Similarly, `typeof window !== "undefined"` is an SSR-era pattern that's unnecessary inside `"use client"` components (they never execute on the server).

### Payload assumption (015)
When constructing a `SongRequestRow` from a Realtime INSERT event, `played_at` was hardcoded to `null` instead of reading `newReq.played_at`. While new INSERTs are always pending today, using the payload value is correct.

## Solution

### Fix 012: Delayed re-query on failure

**File:** `components/request-queue.tsx` — both catch blocks

```ts
// BEFORE
catch {
  // If it fails, the next re-query will self-heal
}

// AFTER
catch {
  // Self-heal: delayed re-query corrects optimistic state on failure
  setTimeout(() => fetchRequests(), 2000);
}
```

The 2-second delay avoids hammering the server during outages. The existing `fetchGen` guard prevents stale fetches from overwriting newer state.

### Fix 013: Remove isMounted anti-pattern

**Files:** `components/song-card.tsx`, `components/confirmation-overlay.tsx`

Removed from both files:
- `const isMounted = useRef(true);`
- `useEffect(() => () => { isMounted.current = false; }, []);`
- `&& isMounted.current` guard checks

Also removed unused `useEffect` import from song-card.tsx.

### Fix 014: Remove typeof window guard

**File:** `components/request-queue.tsx`

```ts
// BEFORE
const audienceUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/alejandro`;

// AFTER
const audienceUrl = `${window.location.origin}/r/alejandro`;
```

### Fix 015: Use payload value for played_at

**File:** `components/request-queue.tsx` — Realtime INSERT handler

```ts
// BEFORE
played_at: null,

// AFTER
played_at: newReq.played_at ?? null,
```

## Verification

- TypeScript compiles clean (`npx tsc --noEmit` — zero errors)
- All 4 fixes are independent with no interaction effects
- `fetchGen` guard tested implicitly by existing Realtime reconnect behavior

## Risk Resolution

**Flagged risk (from plan Feed-Forward):** "The optimistic UI coordination between `dismissingIds`, Realtime subscription, and `fetchRequests`."

**What happened:** The review simplified Step 5 from rollback pattern to fire-and-forget (Option A). Fix 012 closes the remaining gap — when fire-and-forget fails, a delayed re-query self-heals within 2 seconds. The feared UI jank from `dismissingIds` coordination never materialized because the complexity was eliminated.

**Lesson:** Fire-and-forget + delayed re-query is simpler and more resilient than snapshot-and-rollback for optimistic UI in apps with Realtime subscriptions.

## Prevention Strategies

### Optimistic UI
Every optimistic state mutation must have a defined failure recovery path. Three options: revert state, re-query server, or show error UI. The catch block should never be empty.

### React version upgrades
Maintain a "deprecated patterns" checklist per major version. When upgrading React, audit for `isMounted`, `findDOMNode`, `PropTypes`, and other dead patterns in a single cleanup PR.

### "use client" boundaries
If a component has `"use client"`, no `typeof window` guard is needed. If you need the guard, the component should be server-compatible and shouldn't have `"use client"`.

### Realtime handlers
Always destructure payload values — never hardcode values that should come from the event data. Use TypeScript generics on payload types to catch mismatches at compile time.

## Related Documentation

- [Cycle 1 Plan](../plans/2026-03-01-cycle1-played-vibes-plan.md) — full implementation plan including review amendments
- [Diagnostic Fix Session](diagnostic-fix-session-rls-races-perf.md) — previous race condition and security fixes
- [Phase C Shareability](phase-c-shareability-overlay.md) — fire-and-forget fetch pattern precedent
- [Phase D Polish](phase-d-polish-stagger-haptics.md) — haptic feedback patterns used in dismiss/undo

## Feed-Forward

- **Hardest decision:** Whether Fix 012 needs rollback or just re-query. Re-query is simpler and leverages the existing `fetchGen` guard — rollback was already eliminated by review amendment 002.
- **Rejected alternatives:** Adding toast on failure (scope creep for P2 fix), using `useOptimistic` (fights Realtime subscription), reverting optimistic state in catch (redundant if re-query runs 2s later).
- **Least confident:** The 2-second delay is a guess. If venue Wi-Fi has sustained outages >2s, the re-query will also fail. A retry-with-backoff pattern would be more robust but is over-engineering for current scale.
