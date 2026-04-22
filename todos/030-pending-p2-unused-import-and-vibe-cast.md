---
status: resolved
priority: p2
issue_id: "030"
tags: [code-review, typescript, quality]
dependencies: []
unblocks: []
---

# 030: Unused import + unsafe vibe cast

## Problem Statement

Two TypeScript hygiene issues: (1) `VOLUME_CAL_LABEL` imported but never used in detail page, (2) `r.vibe as Vibe` casts bypass the type system instead of using a type guard.

**Found by:** TypeScript Reviewer

## Findings

- `app/performer/history/[gigId]/page.tsx:6` — `VOLUME_CAL_LABEL` imported, never used
- `lib/history-data.ts:84` — `vibes[r.vibe as Vibe]++` cast
- `app/performer/history/[gigId]/page.tsx:224` — `req.vibe as keyof typeof VIBE_EMOJI` cast

## Proposed Solutions

### Solution A: Remove unused import + add isVibe type guard (Recommended)

1. Remove `VOLUME_CAL_LABEL` from import
2. Add `isVibe` type guard to `lib/supabase/types.ts`:
```typescript
export function isVibe(v: string): v is Vibe {
  return (VIBE_VALUES as readonly string[]).includes(v);
}
```
3. Replace casts with guard: `if (r.vibe && isVibe(r.vibe)) { vibes[r.vibe]++; }`

- **Effort:** Small (~10 lines)
- **Risk:** None

## Acceptance Criteria

- [ ] No unused imports
- [ ] No `as Vibe` or `as keyof typeof VIBE_EMOJI` casts
- [ ] `npm run build` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-21 | Created from PR #6 review | Type guard reusable across codebase |
