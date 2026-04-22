---
status: resolved
priority: p3
issue_id: "026"
tags: [code-review, agent-native, api]
dependencies: []
unblocks: []
sub_priority: 3
---

# 026: Toggle response should return updated song record

## Problem Statement

The toggle endpoint returns `{ success: true }` but not the updated song object. An API consumer must make a second GET call to confirm the actual state.

**File:** `app/api/songs/toggle/route.ts` line 33, 45

## Proposed Solutions

### Solution 1: Return updated record (Recommended)
Change `.select("id")` to `.select("id, title, artist, is_active")` and return `{ success: true, song: data[0] }`.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Toggle response includes the updated song object
- [ ] Client code handles the enriched response (or ignores extra fields)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-10 | Created from code review | Agent-native reviewer flagged |
