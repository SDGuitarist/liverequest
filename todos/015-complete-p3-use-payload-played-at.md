---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, race-conditions, future-proofing]
dependencies: []
unblocks: []
sub_priority: 3
---

# 015 — Use payload value for played_at in Realtime INSERT handler

## Problem Statement

The Realtime INSERT handler hardcodes `played_at: null` when constructing the SongRequestRow, ignoring the actual payload value. While new INSERTs always have `played_at = null` today, using the payload value is a one-line future-proofing fix.

## Findings

**Source:** Frontend race conditions reviewer (P3)

**Evidence:** `components/request-queue.tsx` line 137:
```ts
played_at: null,  // hardcoded
```

Should be:
```ts
played_at: newReq.played_at ?? null,
```

## Proposed Solutions

One-line change. Use `newReq.played_at ?? null` instead of hardcoded `null`.

- **Effort:** Tiny (1 line)
- **Risk:** None

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from post-implementation review | Future-proofs against server-side played_at changes |
