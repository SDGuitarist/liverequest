---
status: pending
priority: p1
issue_id: "021"
tags: [code-review, ux, accessibility]
dependencies: []
unblocks: []
sub_priority: 1
---

# 021: Toggle silently swallows taps during inFlight

## Problem Statement

When a toggle is in-flight (API request pending), tapping the same toggle again is silently ignored (line 44: `if (inFlight.current.has(songId)) return;`). The performer sees a clickable-looking toggle, taps it, and nothing happens. No visual feedback. During a live gig, this causes confusion and loss of trust.

**File:** `components/setlist-manager.tsx` line 44, 121-135

## Findings

- **Races reviewer (P1):** "The performer sees a toggle switch that looks clickable, taps it, and nothing happens. During a set, that performer is going to start double-tapping."
- The `inFlight` ref correctly prevents duplicate API calls, but provides zero visual feedback to the user.

## Proposed Solutions

### Solution 1: Add `disabled` attribute to toggle button (Recommended)
- Add `disabled={inFlight.current.has(song.id)}` to the button
- Add a subtle opacity/cursor change for disabled state
- **Pros:** 5-minute fix, accessible, clear user feedback
- **Cons:** Requires tracking inFlight in state (not just ref) to trigger re-render, or using a separate `disabledIds` state
- **Effort:** Small
- **Risk:** Low

### Solution 2: Track inFlight in state instead of ref
- Use `useState<Set<string>>` instead of `useRef<Set<string>>`
- Triggers re-render when inFlight changes, naturally disabling the button
- **Pros:** Clean React pattern, button auto-disables
- **Cons:** Slightly more re-renders (one per toggle start/end)
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**
- `components/setlist-manager.tsx` (lines 12, 44, 121-135)

## Acceptance Criteria

- [ ] Toggle button is visually disabled while API request is in-flight
- [ ] Disabled toggle has reduced opacity or cursor change
- [ ] Screen readers announce disabled state (aria-disabled or disabled attr)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-10 | Created from code review | Races reviewer flagged as P1 UX issue |

## Resources

- PR branch: `feat/setlist-management`
- Races reviewer finding #1
