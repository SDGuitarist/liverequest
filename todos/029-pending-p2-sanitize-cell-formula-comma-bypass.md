---
status: resolved
priority: p2
issue_id: "029"
tags: [code-review, security, quality]
dependencies: []
unblocks: []
---

# 029: sanitizeCell formula+comma bypass in CSV export

## Problem Statement

The `sanitizeCell` function handles formula injection and CSV quoting as separate branches. If a value starts with a formula char (`=+-@|`) AND also contains a comma, quote, or newline, only the formula prefix is applied — the CSV quoting is skipped. This produces an unquoted cell with raw commas, breaking column alignment.

**Found by:** TypeScript Reviewer, Security Sentinel

## Findings

- `app/api/export/history/route.ts:38-46` — formula check returns early before CSV quoting check
- Example: `=SUM(A1),"evil"` → `'=SUM(A1),"evil"` (unquoted, raw comma breaks CSV)
- Low probability with real venue names (performer-controlled), but the function's contract is to produce valid CSV cells

## Proposed Solutions

### Solution A: Apply formula prefix inside quoting logic (Recommended)

```typescript
function sanitizeCell(value: string): string {
  const needsPrefix = value.length > 0 && FORMULA_CHARS.has(value[0]);
  const escaped = needsPrefix ? "'" + value : value;
  if (/[,"\n]/.test(escaped)) {
    return '"' + escaped.replace(/"/g, '""') + '"';
  }
  return escaped;
}
```

- **Effort:** Small (5 lines)
- **Risk:** None

## Acceptance Criteria

- [ ] A value starting with `=` and containing `,` is both prefixed and quoted
- [ ] Normal values without formula chars or special CSV chars pass through unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-21 | Created from PR #6 review | 2 agents converged on same issue |
