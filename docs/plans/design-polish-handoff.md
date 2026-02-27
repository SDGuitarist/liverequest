---
title: "Design Polish Handoff — Phases B, C, D"
date: 2026-02-27
status: active
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

## Finally: Phase D — Polish

**Recs:** #3 (stagger + layout animations) + #10 (haptics) + bonus
**Adds `motion` package. Final layer of premium feel.**

### Rec #3 — Staggered List Entry + Layout Animations
- **File:** `components/song-list.tsx`
- CSS-only stagger: `@keyframes slide-in` with `animationDelay: Math.min(i * 40, 600)ms`
- Optional: `npm install motion` for layout animations on search filter (AnimatePresence + layout prop)

### Rec #10 — Haptic Feedback
- **New file:** `lib/haptics.ts`
- **Files:** `components/song-card.tsx`, `components/request-queue.tsx`
- Success: `navigator.vibrate(50)`, Error: `navigator.vibrate([50, 100, 50])`, Dismiss: `navigator.vibrate(80)`
- Progressive enhancement — silently ignored on iOS

### Bonus Quick Wins
- Count badge bump animation on new request (`key={song.count}` + `count-bump` keyframe)
- New request slide-in with glow in performer queue
- Mesh gradient on page background (layered radial-gradient with amber at 5-7% opacity)
