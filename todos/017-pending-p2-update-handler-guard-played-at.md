---
status: complete
priority: p2
issue_id: "017"
tags: [code-review, performance, realtime]
dependencies: ["016"]
unblocks: []
sub_priority: 1
---

# Guard UPDATE handler against unnecessary re-renders + patch played_at

## Problem Statement

The realtime UPDATE handler fires for ALL updates on `song_requests` (not just vibe changes). When the performer taps "Played," dismiss updates `played_at` on multiple rows — each triggers the UPDATE handler, causing unnecessary re-renders. The handler also only patches `vibe`, ignoring `played_at` changes which prevents multi-session correctness.

**Found by:** Performance Oracle (P2), TypeScript Reviewer (P2)

## Findings

- `components/request-queue.tsx` lines 152-167: UPDATE handler maps entire array on every update
- A dismiss of a song with 5 requests causes 5 UPDATE events → 5 unnecessary re-renders
- Each re-render invalidates all 4 `useMemo` hooks (pendingRequests, playedRequests, pendingGrouped, playedGrouped)
- Handler only patches `vibe` — `played_at` changes from a second performer session would be ignored
- **Known Pattern:** `docs/solutions/diagnostic-fix-session-rls-races-perf.md` — "Race conditions in React realtime apps come in threes"

## Proposed Solutions

### Solution A: Early-return guard + patch both fields (Recommended)

```tsx
(payload) => {
  const updated = payload.new as SongRequest;
  setRequests((prev) => {
    const idx = prev.findIndex((r) => r.id === updated.id);
    if (idx === -1) return prev;
    const cur = prev[idx];
    // Skip if nothing we care about changed
    if (cur.vibe === (updated.vibe ?? null) && cur.played_at === (updated.played_at ?? null)) return prev;
    const next = [...prev];
    next[idx] = { ...cur, vibe: updated.vibe ?? null, played_at: updated.played_at ?? null };
    return next;
  });
}
```

- **Effort:** Small (~10 lines)
- **Risk:** None — returning same reference skips re-render

## Acceptance Criteria

- [ ] UPDATE handler returns `prev` (same reference) when neither `vibe` nor `played_at` changed
- [ ] Handler patches both `vibe` and `played_at` from payload
- [ ] No extra re-renders on dismiss action
- [ ] `npm run build` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from vibe commit review | Dismiss fires N UPDATE events for N requests of same song |
