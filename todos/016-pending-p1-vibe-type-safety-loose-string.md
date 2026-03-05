---
status: complete
priority: p1
issue_id: "016"
tags: [code-review, quality, typescript]
dependencies: []
unblocks: ["017"]
sub_priority: 1
---

# Fix loose `string` typing on vibes — use `Vibe` union type

## Problem Statement

`SongRequestRow.vibe` is typed as `string | null` and `GroupedSong.vibes` as `string[]`, but a narrowed `Vibe` union type already exists. This forces an unsafe `as keyof typeof VIBE_EMOJI` cast in the display and a `?? v` fallback that renders raw strings. The type system cannot catch invalid vibe values at compile time.

**Found by:** TypeScript Reviewer (P1), Simplicity Reviewer, Security Sentinel

## Findings

- `components/request-queue.tsx` line 15: `vibe: string | null` should be `Vibe | null`
- `components/request-queue.tsx` line 25: `vibes: string[]` should be `Vibe[]`
- `components/request-queue.tsx` line 477: `v as keyof typeof VIBE_EMOJI` cast exists because of loose typing
- `components/request-queue.tsx` lines 7-8: two import lines from same module should be merged
- `lib/supabase/types.ts` already has `Vibe` type — just needs to be imported and used
- **Known Pattern:** `docs/solutions/diagnostic-fix-session-rls-races-perf.md` — past review also flagged realtime payload casting

## Proposed Solutions

### Solution A: Narrow types + merge imports (Recommended)

1. Change `SongRequestRow.vibe` to `Vibe | null`
2. Change `GroupedSong.vibes` to `Vibe[]`
3. Merge imports into single line: `import { VIBE_EMOJI, type Gig, type SongRequest, type Vibe } from "@/lib/supabase/types"`
4. Remove the `as` cast — `VIBE_EMOJI[v]` works directly with `Vibe` type
5. Replace `?? v` fallback with nothing (type system guarantees valid key)

- **Effort:** Small (~5 lines changed)
- **Risk:** None — types only, no runtime behavior change

## Acceptance Criteria

- [ ] `SongRequestRow.vibe` typed as `Vibe | null`
- [ ] `GroupedSong.vibes` typed as `Vibe[]`
- [ ] No `as` cast in vibe emoji rendering
- [ ] Single import line from `@/lib/supabase/types`
- [ ] `npm run build` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-01 | Created from vibe commit review | Cascade fix — resolves type safety + security fallback + import merge |
