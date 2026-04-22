---
status: resolved
priority: p3
issue_id: "023"
tags: [code-review, security, architecture]
dependencies: ["027"]
unblocks: []
sub_priority: 4
---

# 023: List route uses service client — INVALIDATED by browser test finding

## Problem Statement

`/api/songs/list/route.ts` uses `createServiceClient()` which bypasses all RLS policies. The dashboard page (`page.tsx` line 49) fetches the same songs table with `createClient()` (respects RLS). This violates the project convention: "RLS defense-in-depth — API routes validate auth AND RLS policies restrict anon access. Never rely on only one layer."

**File:** `app/api/songs/list/route.ts` line 10

## Findings

- **Security sentinel (Medium):** "Using the service client here means that if a future developer accidentally removes the isAuthenticated() check, there is no RLS safety net."
- **Architecture strategist (P1):** Inconsistency between dashboard page (anon client) and API route (service client) for the same table.
- **Learnings researcher:** Confirmed that existing pattern uses service client for writes (where RLS blocks anon writes) but reads should use anon client when RLS permits.

## Proposed Solutions

### Solution 1: Switch to createClient() (Recommended)
Replace `createServiceClient()` with `createClient()` in the list route. The dashboard page already proves RLS allows reads.
- **Pros:** One-line fix, restores defense-in-depth, consistent with dashboard page
- **Cons:** None — the anon client already works for this query
- **Effort:** Small
- **Risk:** Low

## Recommended Action

**REJECT.** Browser testing (todo 027) proved the service client is REQUIRED here. The RLS policy on `songs` only allows `anon` to read active songs (`is_active = true`). The list API is used by the setlist manager's self-heal refetch, which must see inactive songs to restore toggle state. Switching to `createClient()` would break the setlist manager.

The dashboard page itself (todo 027) also needs to switch TO `createServiceClient()` for its songs query, for the same reason.

## Technical Details

**Affected files:**
- `app/api/songs/list/route.ts` (line 2 import, line 10 usage)

## Acceptance Criteria

- [ ] List route uses `createClient()` instead of `createServiceClient()`
- [ ] Import changed from `createServiceClient` to `createClient`
- [ ] API still returns song list correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-10 | Created from code review | Security + Architecture both flagged |

## Resources

- PR branch: `feat/setlist-management`
- CLAUDE.md: "RLS defense-in-depth" convention
