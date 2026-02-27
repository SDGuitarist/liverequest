---
title: "Phase B — Delight (State Animations, Gradient Button, Quick Wins)"
date: 2026-02-27
status: active
phase: work
feed_forward:
  risk: "SVG stroke-dashoffset animation timing on low-end mobile"
  verify_first: true
---

# Phase B — Delight

**Source:** docs/plans/design-polish-handoff.md (Phase B section), docs/design-research.md (Recs #9, #6, Quick Wins)

## Scope

CSS-only delight layer. No new dependencies. 4 files touched.

## Implementation Steps

### Step 1: CSS Keyframes in globals.css (~30 lines)

Add to `app/globals.css` after existing keyframes:

1. `draw-check` — stroke-dashoffset 24→0, 0.4s ease-out, 0.3s delay
2. `circle-fill` — scale(0)→scale(1.15)→scale(1) with overshoot cubic-bezier
3. `shake` — translateX oscillation ±4px, 400ms
4. `success-glow` — amber box-shadow pulse, 800ms
5. `live-glow` — amber box-shadow + opacity pulse, 2s infinite (replaces animate-pulse)
6. `@media (prefers-reduced-motion: reduce)` — kills all animations

### Step 2: Song Card State Animations in song-card.tsx (~40 lines)

- **Sent state:** Replace static checkmark with SVG that uses `stroke-dasharray` + `stroke-dashoffset` for draw animation. Wrap circle in `circle-pop` class. Add `animate-[success-glow_0.8s_ease-out]` to outer button on sent.
- **Error state:** Add `animate-[shake_0.4s_ease-out]` to the error indicator div.
- **Tap feedback:** Add `active:brightness-95` to button (already has `active:scale-[0.98]`).
- **RULE:** Use `transition-[specific-props]` not `transition-all`.

### Step 3: Gradient Share Button in confirmation-overlay.tsx (~5 lines)

- Share button: `bg-gradient-to-r from-accent to-accent-bright` + `shadow-[0_4px_16px_rgba(245,158,11,0.3)]`
- Add hover: `hover:shadow-[0_6px_24px_rgba(245,158,11,0.4)]`
- Done button already glassmorphic — no changes needed.

### Step 4: Live Dot Glow in request-queue.tsx (~3 lines)

- Replace `animate-pulse` on the green connection dot with `animate-[live-glow_2s_ease-in-out_infinite]`
- Change dot color to amber when connected (matches brand) — actually keep green for semantic meaning (connected = green).

## Commit Plan

1. **Commit 1:** Keyframes + reduced motion in globals.css
2. **Commit 2:** Song card state animations + tap feedback
3. **Commit 3:** Gradient share button + live dot glow

## Files

- `app/globals.css` — keyframes + reduced motion
- `components/song-card.tsx` — state animations + tap feedback
- `components/confirmation-overlay.tsx` — gradient share button
- `components/request-queue.tsx` — live dot glow

## Out of Scope

- Phase C items (mesh gradients, particles, badges)
- Phase D items (stagger, haptics, motion package)
- No new dependencies

## Feed-Forward

- **Hardest decision:** Using inline `style` for SVG stroke-dasharray/dashoffset on the checkmark — Tailwind doesn't have utilities for SVG stroke animation properties, so inline style was the cleanest approach.
- **Rejected alternatives:** Considered a separate `.check-draw` CSS class, but inline style keeps it co-located with the SVG element and avoids globals.css bloat for a single-use pattern.
- **Least confident:** The stroke-dashoffset animation path length (24) is an estimate for the "M5 13l4 4L19 7" path. If the checkmark looks choppy on some devices, the dasharray value may need tuning to match the actual path length.
