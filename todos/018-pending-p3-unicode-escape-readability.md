---
status: complete
priority: p3
issue_id: "018"
tags: [code-review, quality]
dependencies: []
unblocks: []
sub_priority: 1
---

# Replace unicode escape with readable apostrophe in vibe text

## Problem Statement

The conditional vibe text uses `\u0027` (unicode escape for apostrophe) instead of a readable character. This is functionally correct but harder to read.

**Found by:** TypeScript Reviewer (P3)

## Findings

- `components/confirmation-overlay.tsx` line 309: `"How\u0027s the vibe?"` should be `{"How's the vibe?"}`
- Likely artifact of refactoring from `&apos;` JSX entity to a JS string expression

## Proposed Solutions

### Solution A: Use plain apostrophe in JSX expression

```tsx
{vibeSent ? "Vibe sent!" : "How's the vibe?"}
```

- **Effort:** Small (1 line)
- **Risk:** None

## Acceptance Criteria

- [ ] No unicode escapes for common punctuation in JSX

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from vibe commit review | Cosmetic |
