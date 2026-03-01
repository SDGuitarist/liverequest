---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, typescript]
dependencies: []
unblocks: []
sub_priority: 4
---

# Update Realtime payload cast to include new fields

## Problem Statement

The Realtime INSERT handler at `request-queue.tsx:114` casts `payload.new` to a manual type that will be missing `played_at` and `vibe` after the migration. The type should reflect the actual shape.

**Found by:** TypeScript Reviewer (P2)

## Proposed Solutions

### Solution A: Use SongRequest type (Recommended)

```ts
import type { SongRequest } from "@/lib/supabase/types";
const newReq = payload.new as SongRequest;
```

Uses the canonical type instead of a hand-written subset. Cast is still needed (Supabase Realtime types are loosely typed).

### Solution B: Update inline type

Add `played_at: string | null` and `vibe: string | null` to the existing inline type.

- **Effort:** Small (either option)

## Acceptance Criteria

- [ ] Realtime payload cast includes all columns from `song_requests`
- [ ] Prefer canonical type import over inline definition

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from plan review | TypeScript reviewer flagged incomplete cast |
