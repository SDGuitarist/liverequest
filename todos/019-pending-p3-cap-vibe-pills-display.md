---
status: complete
priority: p3
issue_id: "019"
tags: [code-review, performance, ux]
dependencies: ["016"]
unblocks: []
sub_priority: 2
---

# Cap vibe emoji pills at 5 with overflow count

## Problem Statement

The vibes array renders one emoji pill per vibe with no limit. A song with 50 requests all with vibes would render 50 `<span>` elements, overflowing the card layout.

**Found by:** Performance Oracle (P3)

## Findings

- `components/request-queue.tsx` lines 470-481: `.map()` over full `song.vibes` array
- No `flex-wrap` on the container, so pills would extend beyond card width
- At current gig scale unlikely to exceed 5-10 vibes per song, but unbounded rendering is fragile

## Proposed Solutions

### Solution A: Slice to 5 + overflow count (Recommended)

```tsx
{song.vibes.slice(0, 5).map((v, i) => (
  <span key={i} className="...">{VIBE_EMOJI[v]}</span>
))}
{song.vibes.length > 5 && (
  <span className="text-xs text-text-muted">+{song.vibes.length - 5}</span>
)}
```

Add `flex-wrap` to the container div.

- **Effort:** Small (~5 lines)
- **Risk:** None

## Acceptance Criteria

- [ ] Max 5 emoji pills displayed per song
- [ ] Overflow shows "+N" count
- [ ] Container has `flex-wrap` for safety

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from vibe commit review | UX + layout safety |
