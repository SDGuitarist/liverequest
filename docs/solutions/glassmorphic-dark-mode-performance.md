---
title: "Glassmorphic Dark Mode — Performance & Accessibility Patterns"
category: frontend-patterns
tags: [tailwind, glassmorphism, dark-mode, accessibility, performance, backdrop-filter, box-shadow]
module: UI Components
symptom: "transition-all causes unnecessary property diffing on mobile scroll"
root_cause: "Tailwind transition-all monitors every CSS property, not just the ones that change"
---

# Glassmorphic Dark Mode — Performance & Accessibility Patterns

## Problem

When implementing glassmorphic borders and amber glow effects for LiveRequest's dark venue UI, three performance and accessibility issues surfaced:

1. `transition-all` on every song card in a scrollable list causes the browser to diff every CSS property on interaction, creating unnecessary work during mobile scroll
2. `backdrop-filter: blur()` on sticky elements requires GPU compositing on every scroll frame
3. WCAG contrast must be verified when changing text colors for dark mode

## Solution

### 1. Replace `transition-all` with explicit properties

Instead of Tailwind's `transition-all`, list only the properties that actually change:

```tsx
// Before (expensive — monitors all properties)
className="transition-all duration-200"

// After (cheap — only monitors what changes)
className="transition-[background-color,border-color,box-shadow,transform] duration-200"
```

For elements that only change one property:
- Accent bars: `transition-opacity`
- Buttons: `transition-colors`
- Queue cards: `transition-[border-color]`

### 2. Backdrop-blur safe limits

- Keep blur radius under 24px on mobile
- Only 1 sticky blur element is safe (the search bar)
- `backdrop-saturate-150` is free when combined with existing blur
- 95.76% global browser support (Safari 17+ no longer needs -webkit- prefix)

### 3. WCAG contrast verification

| Text Color | Background | Ratio | Level |
|-----------|-----------|-------|-------|
| #EDEDF0 (primary) | #0D0D0F | 16.71:1 | AAA |
| #8A8A93 (muted) | #0D0D0F | 6.16:1 | AA |
| #8A8A93 (muted) | #18181B | 5.78:1 | AA |

The original #71717A muted text failed WCAG AA at 3.9:1. Bumping to #8A8A93 passes at 6.16:1.

### 4. Box-shadow glow effects

Static box-shadows are fine for scrolling lists. Only animated shadow transitions trigger per-frame repaints. Use the zero-shadow baseline pattern for smooth hover transitions:

```tsx
// Zero baseline enables smooth transition from no-glow to glow
"shadow-[0_0_0_0_rgba(245,158,11,0)] hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.08)]"
```

For conditional shadows (heat glow on 3+ requests), inline `style` is acceptable since the value depends on dynamic data.

## Risk Resolution

- **Flagged risk:** Tailwind v4 `border-white/[0.06]` syntax — confirmed correct via research
- **What happened:** Works as expected. Arbitrary opacity values require bracket syntax since 6% is not in Tailwind's default scale
- **Lesson:** Tailwind v4 removed `bg-opacity-*` utilities. Always use slash-modifier syntax: `border-white/[0.06]` not `border-white border-opacity-[0.06]`
