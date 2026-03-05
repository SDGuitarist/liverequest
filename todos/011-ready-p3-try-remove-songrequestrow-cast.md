---
status: complete
priority: p3
issue_id: "011"
tags: [code-review, typescript]
dependencies: []
unblocks: []
sub_priority: 3
---

# Try removing `as SongRequestRow[]` cast after updating interface

## Problem Statement

`request-queue.tsx:96` uses `as SongRequestRow[]` which hides potential shape mismatches. After updating the local interface with `played_at`, the Supabase client's inferred return type may match — making the cast unnecessary.

**Found by:** TypeScript Reviewer (P2, downgraded to P3 for review)

## Proposed Solutions

1. Update `SongRequestRow` interface with `played_at: string | null`
2. Update `.select()` to include `played_at`
3. Remove the `as SongRequestRow[]` cast
4. If compilation fails, keep the cast but add a comment explaining why

- **Effort:** Small

## Acceptance Criteria

- [ ] Cast removed if Supabase infers the shape correctly, or documented if it must stay

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | TypeScript reviewer recommended letting compiler verify |
