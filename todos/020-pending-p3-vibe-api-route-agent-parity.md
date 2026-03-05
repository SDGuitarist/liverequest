---
status: complete
priority: p3
issue_id: "020"
tags: [code-review, architecture, agent-native]
dependencies: []
unblocks: []
sub_priority: 3
---

# Create API route for vibe submission (agent-native parity)

## Problem Statement

Vibe feedback is submitted via direct Supabase `.update()` from the browser component. There is no `POST /api/gig/vibe` route, making it inaccessible to agents, CLI tools, webhooks, or server-side processes. Performer-side actions (dismiss, undo, toggle) all have API routes — audience-side actions do not.

**Found by:** Agent-Native Reviewer

## Findings

- `components/confirmation-overlay.tsx` lines 137-145: direct Supabase client call, no API route
- `app/api/gig/dismiss/route.ts`, `toggle/route.ts`, `undo-dismiss/route.ts` all exist as patterns to follow
- Song request submission (`song-card.tsx`) has same gap (pre-existing, not from this commit)
- RLS + column grants are well-designed, so the direct-client approach works for browser users

## Proposed Solutions

### Solution A: Create POST /api/gig/vibe route

Create `app/api/gig/vibe/route.ts` accepting `{ requestId, vibe }`, validate against `VIBE_VALUES` and UUID format, perform update. Update `confirmation-overlay.tsx` to call this route.

- **Effort:** Medium (~30 lines new file + update component)
- **Risk:** Low — follows established pattern

### Solution B: Document as accepted limitation for v1

Add a comment in the code noting the direct-client pattern is intentional for audience actions. Revisit when building integrations.

- **Effort:** Small
- **Risk:** None — defers work

## Acceptance Criteria

- [ ] `POST /api/gig/vibe` endpoint exists and validates input
- [ ] Confirmation overlay calls the API route instead of direct Supabase
- [ ] Or: documented as accepted v1 limitation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from vibe commit review | Not blocking March 6 gig — audience actions via direct Supabase is intentional for v1 |
