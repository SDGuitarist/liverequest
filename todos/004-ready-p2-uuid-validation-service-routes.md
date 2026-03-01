---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, security]
dependencies: ["001"]
unblocks: []
sub_priority: 1
---

# Add UUID validation to all service-role API routes

## Problem Statement

The dismiss, undo-dismiss, and toggle routes only check `typeof gigId !== "string"` — any string passes into service-role Supabase queries. The plan labels UUID validation as P3 but Security Sentinel elevates it to P2 because these queries run under service role (bypasses all RLS).

**Found by:** Security Sentinel (P2)

## Findings

- `app/api/gig/dismiss/route.ts` line 18: only checks `typeof`
- `app/api/gig/toggle/route.ts` line 18: same pattern
- Planned routes copy the same pattern
- Supabase/PostgREST rejects malformed UUIDs, but relying on DB for input validation of service-role queries is a defense-in-depth gap

## Proposed Solutions

### Solution A: Shared UUID regex utility (Recommended)

Create `lib/validation.ts`:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUUID(s: string): boolean { return UUID_RE.test(s); }
```

Apply to all three routes.

- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] All service-role API routes validate UUID format before querying
- [ ] Shared utility, not duplicated regex

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | Security sentinel elevated from P3 to P2 due to service-role context |
