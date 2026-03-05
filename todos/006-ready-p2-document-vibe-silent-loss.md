---
status: complete
priority: p2
issue_id: "006"
tags: [code-review, data-integrity, documentation]
dependencies: []
unblocks: []
sub_priority: 3
---

# Document fire-and-forget vibe silent loss as known v1 limitation

## Problem Statement

If the audience member taps a vibe and immediately closes the overlay, the component unmounts, `isMounted.current` becomes false, and if the UPDATE fails, the error handler never runs. The vibe is silently lost. Three agents flagged this independently.

**Found by:** Security Sentinel (P2), Data Integrity Guardian (P2), Frontend Races Reviewer (P2)

## Findings

- Overlay unmount sets `isMounted.current = false`
- The `.then()` error handler checks `isMounted`, so error is swallowed
- User sees highlighted button (thinks vibe was recorded) but it may have failed
- No retry mechanism exists after overlay is gone

## Proposed Solutions

### Solution A: Document as known limitation (Recommended for March 6)

Add a code comment in the vibe handler and note in the plan. Vibe data is non-critical metadata.

### Solution B: Move vibe function to parent (future)

Pass `sendVibe(requestId, vibe)` from `song-list.tsx` (which stays mounted) to the overlay. The parent handles the promise lifecycle.

- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] Code comment in vibe handler documenting the silent-loss path
- [ ] "What This Plan Does NOT Cover" section updated if needed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | 3 independent agents flagged the same issue |
