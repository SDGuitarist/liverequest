---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, security]
dependencies: []
unblocks: []
sub_priority: 2
---

# Reduce console.error verbosity in API routes

## Problem Statement

The dismiss and toggle routes log the full Supabase error object to `console.error`. On Vercel, these logs can contain table names, column names, constraint names, and query details. The response to the client is correctly generic.

**Found by:** Security Sentinel (P3)

## Proposed Solutions

Log only `error.code` and `error.message`:

```ts
console.error("Supabase error:", error.code, error.message);
```

- **Effort:** Small

## Acceptance Criteria

- [ ] API routes log error code and message only, not full error object

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | Acceptable for single-dev app, good hygiene to fix |
