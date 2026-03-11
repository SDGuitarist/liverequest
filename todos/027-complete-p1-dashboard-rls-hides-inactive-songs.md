---
status: pending
priority: p1
issue_id: "027"
tags: [code-review, browser-test, bug, rls]
dependencies: []
unblocks: ["023"]
sub_priority: 1
---

# 027: Dashboard RLS policy hides inactive songs from setlist manager

## Problem Statement

**Found during browser testing.** When a song is toggled inactive, it disappears from the setlist manager on the next page load. The performer cannot toggle it back on.

**Root cause:** The dashboard page (`app/performer/dashboard/page.tsx` line 17) uses `createClient()` (anon role). The RLS policy on `songs` only allows `anon` to read active songs:

```sql
create policy "Public read active songs" on songs
  for select to anon using (is_active = true);
```

So the server-side fetch at line 48-51 returns only active songs. The `SetlistManager` never receives inactive songs.

**File:** `app/performer/dashboard/page.tsx` line 17, 48-51
**RLS policy:** `supabase/schema.sql` lines 77-79

## Reproduction Steps

1. Go to `/performer/dashboard`, click Setlist tab
2. Toggle any song off (e.g., Wonderwall)
3. Refresh the page
4. The song is gone from the setlist — cannot be toggled back on

## Proposed Solutions

### Solution 1: Use createServiceClient() for the songs query only (Recommended)
Split the parallel fetch: use `createClient()` for requests (needs RLS), use `createServiceClient()` for songs (needs to see inactive).
```typescript
const supabase = await createClient();
const supabaseService = createServiceClient();
const [{ data: requests }, { data: songs }] = await Promise.all([
  supabase.from("song_requests")...,  // anon client, RLS applies
  supabaseService.from("songs")...,    // service client, sees all
]);
```
- **Pros:** Minimal change, songs query gets all records, requests query still respects RLS
- **Cons:** Mixes client types in one page (but this is the correct pattern for admin views)
- **Effort:** Small
- **Risk:** Low

### Solution 2: Add an RLS policy for authenticated reads
Add a new RLS policy allowing authenticated users to read all songs.
- **Pros:** Keeps using anon client everywhere
- **Cons:** Requires DB migration, performer auth uses JWT cookies not Supabase auth
- **Effort:** Medium
- **Risk:** Medium (auth model mismatch)

## Recommended Action

Solution 1 — use service client for songs query in dashboard page.

## Technical Details

**Affected files:**
- `app/performer/dashboard/page.tsx` (line 17, 48-51)

**Note:** This also affects todo 023 (which recommended switching the list API route from service client to anon client). The list API route MUST keep using service client — otherwise the self-heal refetch would also miss inactive songs. Todo 023 should be updated or rejected.

## Acceptance Criteria

- [ ] Setlist manager shows ALL songs (active and inactive) after page reload
- [ ] Inactive songs show with toggle off (dimmed appearance)
- [ ] Toggling an inactive song back on works correctly
- [ ] Guest page at `/r/[slug]` still only shows active songs

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-10 | Found during browser testing | RLS policy for anon only allows active songs — dashboard needs service client for admin views |

## Resources

- PR branch: `feat/setlist-management`
- RLS policy: `supabase/schema.sql` lines 77-79
- Browser test screenshots: `/tmp/dashboard-setlist-after-toggle.png`
