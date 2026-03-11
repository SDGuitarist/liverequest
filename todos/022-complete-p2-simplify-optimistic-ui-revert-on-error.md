---
status: pending
priority: p2
issue_id: "022"
tags: [code-review, simplification, architecture]
dependencies: []
unblocks: ["023"]
sub_priority: 1
---

# 022: Simplify optimistic UI — replace generation counter with revert-on-error

## Problem Statement

The `SetlistManager` has accumulated three layers of defensive patterns across fix commits: a generation counter (`generationRef`), a self-heal timer (`healTimerRef`), a `refetchSongs` callback, and a `revertAndHeal` callback. This protects against: (1) a toggle failing, (2) another toggle happening within 2 seconds, (3) the refetch overwriting the second toggle's optimistic state. This scenario is astronomically unlikely during a live gig.

Additionally, the global generation counter has a real bug: if song A fails and schedules a self-heal, then song B is toggled (bumping generation), song A's self-heal is silently dropped even though it was needed.

**File:** `components/setlist-manager.tsx` lines 13-86

## Findings

- **Simplicity reviewer:** "Three refs and a callback eliminated. Zero behavioral difference for the performer." Estimates ~35 lines removed (141 -> ~106).
- **Races reviewer (P1):** Global generation counter lets unrelated toggles kill needed self-heals. Recommends either per-song heal timers or merge-based refetch.
- **Learnings researcher:** Confirmed generation counter pattern originated from `RequestQueue` (which has Realtime subscriptions and concurrent guest requests — a harder problem). For a single-user toggle list, simple revert is sufficient.

## Proposed Solutions

### Solution 1: Simple revert-on-error (Recommended)
Remove generationRef, healTimerRef, refetchSongs, and revertAndHeal. On error, just flip the switch back.
```typescript
const handleToggle = useCallback(async (songId: string, newActive: boolean) => {
  if (inFlight.current.has(songId)) return;
  inFlight.current.add(songId);
  setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_active: newActive } : s));
  try {
    const res = await fetch("/api/songs/toggle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ songId, isActive: newActive }) });
    if (!res.ok) setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_active: !newActive } : s));
  } catch {
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_active: !newActive } : s));
  } finally {
    inFlight.current.delete(songId);
  }
}, []);
```
- **Pros:** ~35 lines removed, 3 refs eliminated, 2 useCallbacks eliminated, no race conditions possible
- **Cons:** If API partially succeeds (unlikely), state could drift until page refresh
- **Effort:** Small
- **Risk:** Low

### Solution 2: Per-song heal timers with merge-based refetch
Keep self-heal but fix the global generation counter bug by using per-song timers.
- **Pros:** More robust against partial failures
- **Cons:** More complex than Solution 1, over-engineering for single-user case
- **Effort:** Medium
- **Risk:** Medium (more moving parts)

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**
- `components/setlist-manager.tsx` (major refactor of lines 13-86)

**Lines to remove:**
- Lines 13-16 (generationRef, healTimerRef)
- Lines 20-32 (refetchSongs callback)
- Lines 34-41 (revertAndHeal callback)
- Lines 47-52 (generation bump + timer clear)
- Lines 67-75 (strict success check — simplify to `!res.ok`)

## Acceptance Criteria

- [ ] Toggle reverts on API error
- [ ] Toggle reverts on network error
- [ ] No generation counter, heal timer, or refetchSongs in component
- [ ] Rapid toggling of different songs works correctly
- [ ] Same song cannot be double-toggled

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-10 | Created from code review | Simplicity + Races reviewers agree pattern is over-engineered |

## Resources

- PR branch: `feat/setlist-management`
- Simplicity reviewer full analysis
- Races reviewer finding #2
