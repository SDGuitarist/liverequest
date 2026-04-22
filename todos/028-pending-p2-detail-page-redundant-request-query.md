---
status: resolved
priority: p2
issue_id: "028"
tags: [code-review, performance, architecture]
dependencies: []
unblocks: ["029"]
---

# 028: Detail page makes redundant Supabase query for requests

## Problem Statement

`getGiftData()` already fetches all `song_requests` for the gig (with joined `songs(title, artist)`). Then `RequestList` in the detail page makes a second identical query via its own `createClient()` call. This is a duplicate round-trip to Supabase on every detail page load.

**Found by:** Performance Oracle, Architecture Strategist, Security Sentinel (inconsistent client type)

## Findings

- `app/performer/history/[gigId]/page.tsx:185-205` — `RequestList` does `await import("@/lib/supabase/server")` and queries `song_requests` separately
- `lib/gift-data.ts:44` — `getGiftData()` already fetches the same data with `songs(title, artist)` join
- `RequestList` uses `createClient()` (anon/RLS-bound) while `getGiftData()` uses `createServiceClient()` — inconsistent
- The dynamic `await import()` is also unusual and becomes unnecessary when this is fixed

## Proposed Solutions

### Solution A: Pass requests as props from getGiftData (Recommended)

Extract the request data from `getGiftData()` result and pass it to a presentational `RequestList` component. Remove the separate query and dynamic import entirely.

- **Effort:** Small (~15 lines changed)
- **Risk:** None — removes code, no new behavior
- **Fixes 3 issues at once:** redundant query, inconsistent client, dynamic import

## Acceptance Criteria

- [ ] Detail page makes only one set of Supabase queries (via `getGiftData()`)
- [ ] `RequestList` receives request data as props, not via its own query
- [ ] No dynamic imports in the detail page
- [ ] Request list still displays correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-21 | Created from PR #6 review | 3 agents converged on same issue |
