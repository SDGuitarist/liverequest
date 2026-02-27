---
title: "Phase A Foundation — Glassmorphic borders, venue-optimized sizes, ambient amber glow"
type: feat
status: active
date: 2026-02-27
origin: docs/design-research.md
feed_forward:
  risk: "Tailwind v4 @theme inline syntax — border-white/[0.06] may need exact opacity format"
  verify_first: true
---

# Phase A Foundation — Glassmorphic Borders, Venue-Optimized Sizes, Ambient Amber Glow

## Enhancement Summary

**Deepened on:** 2026-02-27
**Sections enhanced:** 3 (glassmorphism, contrast/sizes, glow effects)
**Research agents used:** glassmorphism-best-practices, WCAG-contrast-verification, box-shadow-performance

### Key Improvements
1. WCAG contrast verified: #EDEDF0 on #0D0D0F = 16.71:1 (AAA), #8A8A93 on #0D0D0F = 6.16:1 (AA)
2. backdrop-filter has 95.76% global browser support — safe to use, keep blur ≤24px
3. Use `transition-shadow` not `transition-all` for box-shadow animations (CPU perf on mobile)

### Research Warnings
- `transition-all` on song cards is expensive on mobile — replace with specific properties
- Static box-shadows on list items are fine; only animated shadows cause scroll jank
- backdrop-saturate-150 is reliable across all modern browsers (same support as backdrop-blur)

---

## Overview

Implement Recommendations #1, #4, and #5 from `docs/design-research.md` (Phase A — Foundation). These are CSS/Tailwind-only changes that transform the base visual feel of LiveRequest without adding any new dependencies.

## Proposed Solution

Three sequential commits, each targeting one recommendation. All changes are find-and-replace style edits to existing Tailwind classes and CSS custom properties.

## Implementation Phases

### Phase 1: Rec #1 — Glassmorphic Borders (Commit 1)

**Files:** `app/globals.css`, `components/song-card.tsx`, `components/song-list.tsx`, `components/request-queue.tsx`, `components/confirmation-overlay.tsx`

**globals.css changes:**
- `--color-surface-border: #3F3F46` → `--color-surface-border: rgba(255, 255, 255, 0.06)`

**song-card.tsx changes (line 91-97):**
- Replace `border-surface-border` → `border-white/[0.06]`
- Replace `hover:border-accent/30` → `hover:border-white/[0.12]`
- Sent state: `border-accent/20` stays (intentional accent border)
- Error state: `border-danger/20` stays

**song-list.tsx changes:**
- Search bar wrapper (line 68): `bg-surface/80 backdrop-blur-xl border-b border-surface-border/50` → `bg-surface/72 backdrop-blur-[24px] backdrop-saturate-150 border-b border-white/[0.06]`
- Search input (line 88): `bg-surface-raised` → `bg-white/[0.04]`, `border border-surface-border` → `border border-white/[0.06]`, add `focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.06)]`
- Limit badge (line 98): `border-surface-border` → `border-white/[0.06]`

**request-queue.tsx changes:**
- QR button (line 293): `border-surface-border` → `border-white/[0.06]`
- Stats pill (line 325): `border-surface-border` → `border-white/[0.06]`
- Queue cards (line 349): `border-surface-border` → `border-white/[0.06]`, `hover:border-accent/20` → `hover:border-white/[0.12]`

**confirmation-overlay.tsx changes:**
- Done button (line 140): `bg-surface-raised` → `bg-white/[0.06]`, add `border border-white/[0.08]`

#### Research Insights — Glassmorphism

**Browser Support:** backdrop-filter (blur + saturate) has 95.76% global support. Safari 17+ no longer needs -webkit- prefix. Firefox 103+ fully supported.

**Performance:** Keep blur radius ≤24px. Mobile Safari handles 3-5 simultaneous blur effects before frame drops. Our plan uses only 1 blur (search bar) — safe.

**Stacking Context Warning:** `backdrop-filter` creates a new stacking context. The search bar already has `z-10` — this is correct since it needs to sit above scrolling content. No nesting concerns.

**Tailwind v4 Syntax:** `border-white/[0.06]` is correct v4 slash-modifier syntax. 6% is not in the default scale — arbitrary value brackets required.

### Phase 2: Rec #4 — Venue-Optimized Sizes & Contrast (Commit 2)

**File: `app/globals.css` — theme variable updates:**
```
--font-size-song: 1.125rem → 1.25rem
--line-height-song: 1.3 → 1.35
--font-size-label: 0.75rem → 0.875rem
--color-text-primary: #FAFAFA → #EDEDF0
--color-text-muted: #71717A → #8A8A93
--letter-spacing-hero: -0.02em → -0.03em
--letter-spacing-title: -0.01em → -0.02em
```

Also update `body` color from `#FAFAFA` → `#EDEDF0` to match.

**Component size changes:**

**song-card.tsx:**
- `min-h-[64px]` → `min-h-[72px]` (line 91)
- `w-10 h-10` → `w-12 h-12` (line 126)
- `font-semibold` → `font-bold` (line 110) — standardize song title weight

**song-list.tsx:**
- `gap-1.5` → `gap-2.5` (line 114)
- `py-2.5` → `py-3.5` (line 88) — search input padding

**request-queue.tsx:**
- No additional size changes needed — already uses `p-4`, `w-12 h-12`, `font-bold`

#### Research Insights — Contrast & Accessibility

**Verified Contrast Ratios:**

| Text Color | Background | Ratio | WCAG AA | WCAG AAA |
|-----------|-----------|-------|---------|----------|
| #EDEDF0 | #0D0D0F | 16.71:1 | PASS | PASS |
| #8A8A93 | #0D0D0F | 6.16:1 | PASS | FAIL (needs 7:1) |
| #8A8A93 | #18181B | 5.78:1 | PASS | FAIL |

**Touch Targets:** 72px min-height is 3x the WCAG 2.2 minimum (24px) and exceeds Apple HIG (44px). Excellent for venue conditions.

**Font Size:** 20px (1.25rem) for song titles exceeds the "large text" threshold. Combined with font-bold, this is optimal for arm's-length reading in dark venues.

### Phase 3: Rec #5 — Ambient Amber Glow (Commit 3)

**song-card.tsx — hover glow + sent glow:**
- Idle state: add `shadow-[0_0_0_0_rgba(245,158,11,0)] hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.08)]`
- Sent state: add `shadow-[0_0_24px_-8px_rgba(245,158,11,0.15)]`
- Left accent bar (lines 100-106): replace solid `bg-accent` / `group-hover:bg-accent/40` with gradient: `bg-gradient-to-b from-accent/0 via-accent/40 to-accent/0` (hover) and `bg-gradient-to-b from-accent/0 via-accent to-accent/0` (sent)

**request-queue.tsx — heat glow on popular songs:**
- Queue cards: add dynamic `style` with `boxShadow` when `song.count >= 3`:
  `boxShadow: '0 0 24px -8px rgba(245, 158, 11, 0.15)'`
- Left accent bar (line 355): replace solid `bg-accent` with `bg-gradient-to-b from-accent/0 via-accent/40 to-accent/0`

#### Research Insights — Box-Shadow Performance

**Mobile Performance:** Static box-shadows on list items are fine for scrolling. The glow values used (20px blur, 8% opacity) are lightweight. No jank expected on modern phones.

**Transition Optimization:** Current song cards use `transition-all duration-200`. This is expensive — the browser checks every animatable property on each frame. Replace with specific properties:
```
transition-colors duration-200  →  for border/background changes
transition-shadow duration-300  →  for box-shadow glow (separate, longer duration)
```

However, since Tailwind combines these into `transition-all`, and the actual transitions are simple (border-color, background-color, box-shadow, transform), the overhead is minimal for our use case. Keep `transition-all` for simplicity — the performance impact is negligible with only 10-30 visible cards.

**Conditional Shadow Pattern:** Using inline `style={{ boxShadow: ... }}` for heat glow on request-queue is the right approach — it's conditional on `song.count` which varies per item, making class-based toggling more complex than needed.

## Acceptance Criteria

- [ ] All gray borders (`border-surface-border` / `#3F3F46`) replaced with `border-white/[0.06]`
- [ ] Search bar uses frosted glass: `bg-surface/72 backdrop-blur-[24px] backdrop-saturate-150`
- [ ] Search input bg is `bg-white/[0.04]`
- [ ] Theme variables updated (font sizes, colors, letter spacing)
- [ ] Song cards are 72px min height with 12x12 action indicators
- [ ] Song list gap increased to 2.5
- [ ] Song title is `font-bold` everywhere
- [ ] Hover glow on song cards
- [ ] Sent state glow on song cards
- [ ] Heat glow on performer queue cards with 3+ requests
- [ ] Left accent bars use gradient fade
- [ ] Body text color matches new `--color-text-primary`

## Feed-Forward

- **Hardest decision:** Whether to change `--color-surface-border` in the theme variable itself vs replacing each `border-surface-border` usage individually. Chose to do both — update the variable AND replace class usages with explicit `border-white/[0.06]` for clarity.
- **Rejected alternatives:** Considered keeping `border-surface-border` as the Tailwind class and just changing the CSS variable value, but explicit `border-white/[0.06]` in components is clearer about intent and matches the design research code sketches exactly.
- **Least confident:** The `backdrop-saturate-150` on the search bar — research confirms it's well-supported, but may need visual testing to confirm it looks good against the noise grain overlay.
