---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, migration, documentation]
dependencies: []
unblocks: []
sub_priority: 2
---

# Add SQL comments for GRANT/REVOKE awareness in migration and schema.sql

## Problem Statement

After `REVOKE UPDATE ON song_requests FROM anon`, any future column that anon needs to UPDATE requires an explicit GRANT. Without a prominent comment in the migration AND schema.sql, a future developer adding a column will get "permission denied" with no obvious cause. Supabase does not raise a visible error — the column just stays unchanged.

**Found by:** Data Migration Expert (P2), Data Integrity Guardian (P2)

## Proposed Solutions

Add comments in both the migration file AND `supabase/schema.sql`:

```sql
-- WARNING: anon has column-level UPDATE restricted to (vibe) only.
-- Supabase grants table-level UPDATE by default; this REVOKE removes it.
-- Any new column that anon needs to UPDATE requires:
--   GRANT UPDATE (column_name) ON song_requests TO anon;
```

- **Effort:** Small (documentation only)

## Acceptance Criteria

- [ ] Migration file has GRANT/REVOKE warning comment
- [ ] schema.sql has matching comment in RLS section
- [ ] Comment explains WHY the REVOKE exists (Supabase default)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | Migration expert + data integrity guardian both flagged this |
