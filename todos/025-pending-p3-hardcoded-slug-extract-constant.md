---
status: pending
priority: p3
issue_id: "025"
tags: [code-review, architecture, tech-debt]
dependencies: []
unblocks: []
sub_priority: 2
---

# 025: Extract hardcoded slug to shared constant

## Problem Statement

`revalidatePath("/r/alejandro")` in `app/api/songs/toggle/route.ts` line 43 adds another hardcoded slug instance. Already exists in `request-queue.tsx`. Each new instance increases migration cost when dynamic slugs ship.

**Already tracked in MEMORY.md under Known Risks.** This todo is specifically about extracting to a constant.

## Proposed Solutions

### Solution 1: Create lib/constants.ts with PERFORMER_SLUG
```typescript
export const PERFORMER_SLUG = "alejandro";
```
Update all hardcoded instances to use this constant.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Slug defined once in shared constant
- [ ] All hardcoded "/r/alejandro" references use the constant

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-10 | Created from code review | Multiple agents flagged |
