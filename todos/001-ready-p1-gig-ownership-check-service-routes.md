---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, security]
dependencies: []
unblocks: []
sub_priority: 1
---

# Add gig-ownership check to all service-role API routes

## Problem Statement

The dismiss, undo-dismiss, and toggle API routes verify the caller is authenticated via `isAuthenticated()`, then accept `gigId` from the request body and operate using the **service role client** which bypasses all RLS. There is no check that the `gigId` refers to an active gig. An authenticated performer could pass ANY gig ID and modify any gig's requests.

Today this is a single-performer app, but the pattern is dangerous: it establishes "authenticated = authorized for everything" when using service role. A leaked session cookie could manipulate any gig.

**Found by:** Security Sentinel (P1)

## Findings

- `app/api/gig/dismiss/route.ts` lines 17-27: accepts arbitrary `gigId`, no ownership check
- `app/api/gig/toggle/route.ts` lines 17-26: same pattern
- Planned `app/api/gig/undo-dismiss/route.ts`: copies same pattern
- Service role bypasses ALL RLS — blast radius is maximum

## Proposed Solutions

### Solution A: Active-gig check before UPDATE (Recommended)

Add a query to verify the gig exists and is active before performing the mutation:

```ts
const { data: gig } = await supabase
  .from("gigs")
  .select("id")
  .eq("id", gigId)
  .eq("is_active", true)
  .single();

if (!gig) {
  return NextResponse.json({ error: "Gig not found or inactive" }, { status: 404 });
}
```

- **Pros:** Simple, one extra query, scopes service role to active gig only
- **Cons:** Extra DB round trip (~5ms)
- **Effort:** Small (add to 3 routes)
- **Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

- **Affected files:** `app/api/gig/dismiss/route.ts`, `app/api/gig/toggle/route.ts`, planned `app/api/gig/undo-dismiss/route.ts`
- **Database changes:** None

## Acceptance Criteria

- [ ] All three service-role routes verify `gigId` is an active gig before mutating
- [ ] Passing an inactive or nonexistent `gigId` returns 404

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | Security Sentinel flagged as highest blast radius finding |

## Resources

- Plan: `docs/plans/2026-03-01-cycle1-played-vibes-plan.md` Step 3
