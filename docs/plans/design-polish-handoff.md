---
title: "Design Polish Handoff — Phases A, B, C, D"
date: 2026-02-27
status: complete
---

# Design Polish Handoff

## Completed: Phase A — Foundation

**Commits:** 157ec16, 40a46e4, 2c4d371, 73a8afe, 1d9c506

What was done:
- Rec #1: Glassmorphic borders (border-white/[0.06]) across all components
- Rec #4: Venue-optimized sizes (72px cards, 1.25rem titles, WCAG-compliant contrast)
- Rec #5: Amber glow effects (hover, sent-state, heat glow, gradient accent bars)
- Performance fix: transition-all → specific properties, removed dead animationDelay
- Compound solution doc: `docs/solutions/glassmorphic-dark-mode-performance.md`

**Lessons learned (carry forward):**
- Use `transition-[specific-props]` not `transition-all` on list items
- Tailwind v4 arbitrary opacity: `border-white/[0.06]` (brackets required for non-standard values)
- Static box-shadows fine for lists; only animated shadows cause mobile jank
- backdrop-blur safe at ≤24px with single sticky element

## Known issues (pre-existing, not from Phase A):
- `REQUEST_LIMIT` in `components/song-list.tsx:19` is 5 but was set to 2 in commit 5fc39e3. Verify intent.
- Hardcoded `"alejandro"` slug in `components/request-queue.tsx:224`. Should derive from gig data.

---

## Completed: Phase B — Delight

**Commits:** ba974a2, 06c984a, 8df6b80, 479884a, 3711857
**Recs:** #9 (state animations) + #6 (gradient button) + Quick wins (live dot, reduced motion)

What was done:
- Rec #9: SVG stroke-draw checkmark with circle-pop overshoot, error shake, success-glow pulse
- Rec #6: Gradient Share button (from-accent to-accent-bright) with amber glow shadow
- Quick wins: live-glow keyframe on connection dot, reduced-motion safety net
- Review fixes: removed duplicate tap feedback (brightness-95), simplified live-glow, fixed Done button transition

**Lessons learned (carry forward):**
- Inline `style` is correct for single-use SVG stroke animation props (no Tailwind utilities)
- One tap feedback signal is enough — `active:scale-[0.98]` is the standard, don't stack brightness
- `transition` property must include `transform` if using `active:scale-[0.98]`
- Approximate stroke-dasharray values (20-30) work fine for simple checkmark SVGs
- Infinite animations only on single elements, never on list items

---

## Completed: Phase C — Shareability

**Commits:** 18e4f76, 32570b2, cd29cf2, 49dda34, 7c1b17f, a58275a
**Recs:** #2 (dynamic mesh gradients) + #7 (musical particles) + #8 (badge/watermark)

What was done:
- Rec #2: Deterministic mesh gradient backgrounds — hash of song title+artist produces unique gradient orbs per song. 3 layered orbs with blur-[80/60/40px] (reduced from 150/120/100 for 70% GPU cost reduction)
- Rec #7: 8 floating musical note particles + 3 sonic ring pulses layered with existing confetti. New keyframes: `float-up`, `ring-pulse`
- Rec #8: Non-blocking request count fetch, "Request #N tonight" badge pill, time-of-day label (Golden Hour / Prime Time / Late Night), branded LIVEREQUEST watermark
- Review fixes: removed unused font import, optimized particle render, tightened type signatures

**Lessons learned (carry forward):**
- Non-blocking data fetch pattern: show overlay immediately, lazy-load count via fire-and-forget `.then()` — never block UI on a secondary query
- Blur radius performance: 80/60/40px achieves 90% visual softness of 150/120/100 with ~70% less GPU cost
- No `backdrop-blur` on nested elements inside an already-blurred container (double GPU compositing)
- 8 particles is the sweet spot — 12 showed diminishing returns with 25% more DOM nodes
- `getTimeLabel()` returns `string | null`, not an object — YAGNI on unused emoji field

---

## Completed: Phase D — Polish

**Commits:** 420f8f6 (squash-merged as fe102c0)
**Recs:** #3 (stagger animations) + #10 (haptics) + bonus quick wins

What was done:
- Rec #3: CSS-only staggered slide-in animation on song list — `@keyframes slide-in` with 40ms delay per card capped at 600ms. Did not add `motion` package (CSS-only covers the need without the 45KB dependency)
- Rec #10: Progressive-enhancement haptic feedback via `lib/haptics.ts` — `hapticSuccess` (50ms), `hapticError` ([50,100,50]), `hapticDismiss` (80ms). Called in `song-card.tsx` after sent/error states and in `request-queue.tsx` after dismiss
- Bonus: Count badge bump animation (`key={song.count}` re-mount trick + `count-bump` keyframe), `slide-in-new` glow-fade entry for performer queue cards, layered amber mesh gradient (3 radial-gradients at 3–6% opacity) on audience page background

**Lessons learned:**
- `key={value}` on a child element forces React re-mount — useful for triggering one-shot CSS animations on data change without state management
- `navigator.vibrate` is a no-op on iOS Safari — progressive enhancement means zero error handling needed
- Mesh gradients: 3 overlapping radial-gradients at 3–6% opacity create depth without visible edges; going above 7% makes the amber muddy
- CSS-only stagger (`animationDelay` + `backwards` fill mode) is sufficient for list entry; `motion` package only needed if layout reflow on filter is required
