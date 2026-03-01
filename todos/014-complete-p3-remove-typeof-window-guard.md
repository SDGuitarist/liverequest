---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, quality]
dependencies: []
unblocks: []
sub_priority: 2
---

# 014 — Remove unnecessary typeof window guard

## Problem Statement

`request-queue.tsx` has a `typeof window !== "undefined"` check inside a `"use client"` component. Client components never run on the server, so this guard is dead code.

## Findings

**Source:** Code simplicity reviewer

**Evidence:** `components/request-queue.tsx` line 290:
```ts
const audienceUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/alejandro`;
```

## Proposed Solutions

Simplify to:
```ts
const audienceUrl = `${window.location.origin}/r/alejandro`;
```

- **Effort:** Tiny (inline change)
- **Risk:** None

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from post-implementation review | "use client" components always have window |
