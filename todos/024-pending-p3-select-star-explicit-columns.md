---
status: pending
priority: p3
issue_id: "024"
tags: [code-review, performance, security]
dependencies: []
unblocks: []
sub_priority: 1
---

# 024: Replace select("*") with explicit column list

## Problem Statement

Both the API route and dashboard page use `.select("*")` on the songs table. The UI only needs `id`, `title`, `artist`, and `is_active`. If future columns are added (lyrics, notes, audio URLs), they would be automatically included in API responses.

**Files:** `app/api/songs/list/route.ts` line 14, `app/performer/dashboard/page.tsx` line 50

## Proposed Solutions

### Solution 1: Explicit select (Recommended)
Replace `.select("*")` with `.select("id, title, artist, is_active")` in both files.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Both queries use explicit column selection
- [ ] SetlistManager still renders correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-10 | Created from code review | Security + Performance + Architecture all flagged |
