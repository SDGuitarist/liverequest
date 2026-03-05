---
status: complete
priority: p3
issue_id: "013"
tags: [code-review, quality, react]
dependencies: []
unblocks: []
sub_priority: 1
---

# 013 — Remove isMounted anti-pattern (dead code in React 19)

## Problem Statement

Two components use the `isMounted` ref pattern to guard against setState-after-unmount. In React 19, calling `setState` on an unmounted component is silently ignored by React itself — the guard is dead code that adds cognitive overhead.

## Findings

**Source:** Code simplicity reviewer

**Evidence:**
- `components/song-card.tsx` lines 35-36 (ref + cleanup), line 45 (guard check)
- `components/confirmation-overlay.tsx` lines 77-78 (ref + cleanup), line 149 (guard check)

## Proposed Solutions

### Option A: Remove the pattern (Recommended)
Delete the `isMounted` ref, the cleanup effect, and the guard checks from both files.

- **Pros:** 6 lines removed, eliminates dated anti-pattern
- **Cons:** None — React 19 handles this
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] `isMounted` ref removed from `song-card.tsx`
- [ ] `isMounted` ref removed from `confirmation-overlay.tsx`
- [ ] No regressions — vibe retry still works, count update still works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from post-implementation review | React 19 no-ops on unmounted setState |
