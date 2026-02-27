---
title: "Phase B — Delight Animations Patterns"
category: frontend-patterns
tags: [css-animations, keyframes, svg-stroke, reduced-motion, accessibility, performance]
module: UI Components
symptom: "Static state transitions feel lifeless — no feedback on tap, success, or error"
root_cause: "Missing CSS keyframe animations for state changes"
---

# Phase B — Delight Animations Patterns

## Problem

Song card state transitions (idle → sending → sent, idle → error) had no visual delight. The confirmation overlay Share button was flat. The live connection dot used generic `animate-pulse`.

## Solution

### 1. SVG Stroke-Draw Checkmark Animation

Use `stroke-dasharray` + `stroke-dashoffset` for a "drawing" checkmark effect:

```tsx
<svg
  style={{
    strokeDasharray: 24,
    strokeDashoffset: 24,
    animation: 'draw-check 0.4s ease-out 0.3s forwards'
  }}
>
```

The `0.3s` delay creates a narrative: circle pops first, then checkmark draws. The `forwards` fill mode keeps the checkmark visible after animation ends.

**Key insight:** Tailwind has no utilities for `stroke-dasharray`/`stroke-dashoffset`, so inline `style` is the correct approach for single-use SVG animations. Don't create a CSS class for a one-off.

### 2. Overshoot Bounce with cubic-bezier

For the circle-pop, use a spring-like cubic-bezier that overshoots and settles:

```css
animation: circle-fill 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
```

The `1.56` control point creates the overshoot (scale goes to 1.15 at 50%, settles to 1.0).

### 3. One-Shot vs Infinite Animations

- **One-shot** (`success-glow`, `shake`, `circle-fill`, `draw-check`): Fire once on state change. No `infinite`. Safe on list items.
- **Infinite** (`live-glow`): Only on single elements (connection dot), never on list items. Keep to `box-shadow` only — don't animate `opacity` on tiny elements (imperceptible).

### 4. Tap Feedback: Pick One Signal

Review finding: `active:scale-[0.98]` is sufficient tap feedback. Adding `active:brightness-95` is duplicate — two simultaneous signals for the same event. Removed brightness, kept scale (industry standard for iOS/Material).

### 5. Transition Properties Must Match

If a button has `active:scale-[0.98]`, the `transition` property must include `transform`. Example:
- Wrong: `transition-colors active:scale-[0.98]` (scale snaps, doesn't animate)
- Right: `transition-[color,background-color,transform] active:scale-[0.98]`

### 6. Global Reduced-Motion Safety Net

One rule covers everything — no per-component duplication needed:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Risk Resolution

- **Flagged risk:** SVG stroke-dashoffset path length (24) may not match actual path length
- **What happened:** The value 24 is an approximation for "M5 13l4 4L19 7". Visually it works well — the checkmark draws fully. If it ever looks choppy, compute exact length with `path.getTotalLength()`.
- **Lesson:** For simple checkmark paths, approximate dasharray values (20-30) work fine visually. Only measure precisely for complex SVG paths.
