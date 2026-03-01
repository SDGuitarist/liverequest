---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, race-conditions, reliability]
dependencies: []
unblocks: []
sub_priority: 1
---

# 012 — Add re-query after failed dismiss/undo

## Problem Statement

When a dismiss or undo API call fails (network blip — common on venue Wi-Fi), the optimistic UI update persists with no automatic correction. The self-healing mechanism relies on visibility change or Realtime reconnect, neither of which fires if the performer stays on the same tab. A song can appear in the wrong section (Pending vs Played) until the next natural re-query.

**Realistic scenario:** Performer taps "Played" → optimistic update moves song to Played → HTTP request fails (venue Wi-Fi) → song stays visually in Played but is still pending in DB → audience member re-requests it → song appears in BOTH Pending and Played.

## Findings

**Source:** Frontend race conditions reviewer (P3 — upgraded to P2 for venue reliability)

**Evidence:** `components/request-queue.tsx` lines 248-249 and 273-274 — `catch` blocks do nothing:
```ts
catch {
  // If it fails, the next re-query will self-heal
}
```

## Proposed Solutions

### Option A: Delayed re-query in catch (Recommended)
Add `setTimeout(() => fetchRequests(), 2000)` in both catch blocks. The 2-second delay avoids hammering the server during a network outage. The `fetchGen` guard handles concurrent fetches correctly.

- **Pros:** 2-line fix, closes the self-heal gap, no new dependencies
- **Cons:** Adds a network request after every failure (acceptable — failures are rare)
- **Effort:** Small (2 lines)
- **Risk:** Very low

## Technical Details

**Affected files:**
- `components/request-queue.tsx` — `handleDismiss` catch block (~line 248) and `handleUndoDismiss` catch block (~line 273)

## Acceptance Criteria

- [ ] Failed dismiss triggers a delayed re-query that restores correct state
- [ ] Failed undo triggers a delayed re-query that restores correct state
- [ ] The `fetchGen` guard prevents stale fetch from overwriting newer state

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from post-implementation review | Race conditions reviewer found self-heal gap |
