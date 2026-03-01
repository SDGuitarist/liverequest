---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, architecture, frontend]
dependencies: []
unblocks: ["003"]
sub_priority: 2
---

# Design decision: Simplify or fix the optimistic UI pattern in Step 5

## Problem Statement

The plan's Step 5 introduces ~80 lines of coordinated optimistic UI (dismissingIds ref, save-and-restore rollback, fetchRequests filtering, Realtime INSERT guards, toast). Two review agents have conflicting recommendations:

- **Code Simplicity Reviewer:** Drop dismissingIds entirely. The current 8-line fire-and-forget pattern works fine for one performer on one iPad. Re-query self-heals on failure.
- **Frontend Races Reviewer:** Keep dismissingIds but fix 5 bugs: stale closure capture, fetchRequests merge strategy, double dismissingIds check in Realtime handler, Realtime INSERT drop recovery, undo button feedback.

This is a **design decision** that must be resolved before implementing Step 5.

**Found by:** Code Simplicity Reviewer + Frontend Races Reviewer (conflicting)

## Findings

### Bugs in the proposed dismissingIds pattern (if keeping it):

1. **Stale closure** (P1): `removedItems` captured from closure `requests`, not from functional updater — can miss Realtime INSERTs. Fix: capture inside `setRequests` updater + ref.
2. **fetchRequests filter** (P1): Replaces entire state, dropping legitimate played items during in-flight dismiss. Fix: merge strategy preserving in-flight items.
3. **Realtime handler** (P2): dismissingIds check runs before async song fetch but dismiss could start during the await. Fix: check again inside `setRequests` updater.
4. **INSERT drop** (P2): Dropped INSERTs during dismiss are never recovered. Fix: trigger `fetchRequests()` in `finally` block.
5. **seenIds sync** (P2): `seenIds` updates from unfiltered `data`, not `filtered`. Fix: one-line change.

### Argument for simplification:

- Solo performer, one iPad, ~50 requests, ~200ms network calls
- Current fire-and-forget with re-query self-healing has zero bugs in production
- The race conditions are real but the window is milliseconds on a single device
- Plan already documents simplification as the fallback: "remove dismissingIds from fetchRequests"

## Proposed Solutions

### Option A: Simple fire-and-forget (Recommended for March 6)

Keep the current pattern. On dismiss: optimistic remove from state, fire API, let re-query self-heal on failure. Add only a double-tap guard (one `useRef<Set>`, one `.has()` check). No rollback, no toast, no fetchRequests filtering.

- **Pros:** 8 lines, zero race conditions, proven in production
- **Cons:** Brief flicker if API fails (card reappears on next re-query)
- **Effort:** Small
- **Risk:** Low — the flicker is cosmetic and self-correcting

### Option B: Full coordination with bug fixes

Keep dismissingIds but fix all 5 bugs above. ~80 lines after fixes.

- **Pros:** No flicker on failure, immediate toast feedback
- **Cons:** Complex, 5 bugs to fix, cognitive load for future maintenance
- **Effort:** Large
- **Risk:** Medium — coordination logic is hard to test manually

### Option C: Middle ground — rollback only, no coordination

Optimistic update + rollback on failure (save removed items, restore on error), plus toast. But NO dismissingIds filtering on fetchRequests or Realtime. Accept that re-query may cause a brief flash.

- **Pros:** User gets error feedback, simpler than Option B
- **Cons:** Still need to fix stale closure (bug 1) and non-null assertion (see todo 003)
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

**Option A for March 6.** If the first gig reveals actual UI issues, upgrade to Option C in a follow-up cycle. The knowledge for Option B is preserved in this todo and the plan document.

## Technical Details

- **Affected files:** `components/request-queue.tsx` (Step 5 of plan)
- **Affects implementation of:** Plan Steps 4 and 5 (simplicity reviewer recommends merging them)

## Acceptance Criteria

- [ ] Design decision made and documented before implementing Step 5
- [ ] If Option A: current handleDismiss pattern adapted for UPDATE (not DELETE) with double-tap guard
- [ ] If Option B/C: all applicable bug fixes from races reviewer implemented

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | Simplicity vs races reviewers disagreed — presenting as design decision |

## Resources

- Plan: `docs/plans/2026-03-01-cycle1-played-vibes-plan.md` Step 5
- Simplicity reviewer: recommends dropping dismissingIds entirely
- Races reviewer: found 5 bugs but recommends keeping with fixes
