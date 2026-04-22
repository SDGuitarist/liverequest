---
status: resolved
priority: p3
issue_id: "031"
tags: [code-review, quality, tech-debt]
dependencies: []
unblocks: []
---

# 031: Dead code + duplicated computePeakHour

## Problem Statement

Minor code quality: (1) `?? []` after throw guards is unreachable dead code, (2) `computePeakHour` is duplicated line-for-line between `history-data.ts` and `gift-data.ts`.

**Found by:** TypeScript Reviewer, Performance Oracle

## Findings

- `lib/history-data.ts:59,67` — `allRequests.data ?? []` and `allSessions.data ?? []` are unreachable after throw on `.error`
- `lib/history-data.ts:106-135` — `computePeakHour` identical to `lib/gift-data.ts:152-182`

## Proposed Solutions

### Solution A: Remove dead code + extract shared helper (Recommended)

1. Remove `?? []` — trust the throw guards
2. Extract `computePeakHour` to `lib/time-utils.ts`, import from both files

- **Effort:** Small (~15 lines moved)
- **Risk:** None

## Acceptance Criteria

- [ ] No `?? []` after throw guards
- [ ] `computePeakHour` defined once, imported by both files

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-21 | Created from PR #6 review | Pure utility extraction |
