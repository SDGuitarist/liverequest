---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, typescript, frontend]
dependencies: ["002"]
unblocks: []
sub_priority: 3
---

# Fix non-null assertions in undo rollback with Map lookup

## Problem Statement

The plan's `handleUndoDismiss` rollback uses `undoneItems.find(...)!.played_at` — a non-null assertion that could crash at runtime if the invariant is violated. The same `some` + `find` pattern also does two array scans where one suffices.

**Only applies if design decision (002) chooses Option B or C.** If Option A (simple fire-and-forget) is chosen, there is no rollback code and this finding is moot.

**Found by:** TypeScript Reviewer (P1), Data Integrity Guardian (P3)

## Findings

- Plan Step 5, lines 429 and 439: `undoneItems.find((ui) => ui.id === r.id)!.played_at`
- The `!` is logically sound (if `some` returns true, `find` cannot return undefined) but TypeScript can't prove this
- Two array scans (`.some()` then `.find()`) for each element is O(n*m)

## Proposed Solutions

### Solution A: Map lookup (Recommended)

```ts
const undoneMap = new Map(undoneItems.map((item) => [item.id, item]));

setRequests((prev) =>
  prev.map((r) => {
    const original = undoneMap.get(r.id);
    return original ? { ...r, played_at: original.played_at } : r;
  })
);
```

- **Pros:** No `!`, O(n) instead of O(n*m), clearer intent
- **Cons:** None
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] No `!` non-null assertions in rollback code
- [ ] Single lookup per element (Map or single `.find()`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | TypeScript reviewer + data integrity guardian converged on same fix |
