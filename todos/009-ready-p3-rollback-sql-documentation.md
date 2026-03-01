---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, migration, documentation]
dependencies: []
unblocks: []
sub_priority: 1
---

# Document rollback SQL alongside migration

## Problem Statement

No rollback SQL is documented in the plan. If the migration needs reverting during a gig, the developer would need to write reverse SQL under pressure.

**Found by:** Data Migration Expert (Finding 6a)

## Proposed Solutions

Add rollback SQL as a comment at the bottom of the migration file:

```sql
-- ROLLBACK (if needed):
-- DROP POLICY IF EXISTS "Anon can set vibe on requests" ON song_requests;
-- REVOKE UPDATE (vibe) ON song_requests FROM anon;
-- GRANT UPDATE ON song_requests TO anon;
-- ALTER TABLE song_requests DROP COLUMN IF EXISTS vibe;
-- ALTER TABLE song_requests DROP COLUMN IF EXISTS played_at;
```

- **Effort:** Small (documentation only)

## Acceptance Criteria

- [ ] Rollback SQL exists in or alongside the migration file

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | Deployment verification agent provided the full rollback SQL |
