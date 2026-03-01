---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, architecture, ux]
dependencies: []
unblocks: []
sub_priority: 5
---

# Clarify stats bar count behavior after soft-delete

## Problem Statement

`request-queue.tsx:244` shows `totalRequests = requests.length`. After soft-delete, `requests` includes both pending and played rows. The stats bar will show the total of all requests ever made, not just pending ones. The plan does not specify whether to show pending count, total count, or both.

**Found by:** Architecture Strategist (Informational), Performance Oracle (Minor Item A)

## Proposed Solutions

### Solution A: Show "X pending / Y played" (Recommended)

Use the `pendingRequests` and `playedRequests` arrays from the new useMemo calls:

```ts
const pendingCount = pendingRequests.length;
const playedCount = playedRequests.length;
```

- **Effort:** Small (UI text change)

## Acceptance Criteria

- [ ] Stats bar clearly distinguishes pending vs played counts

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | Architecture + performance agents both noted this gap |
