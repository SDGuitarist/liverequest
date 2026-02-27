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

## Next: Phase B — Delight

**Recs:** #9 (state animations) + #6 (gradient button) + Quick wins (live dot, tap feedback)
**All CSS-only. No new dependencies.**

### Rec #9 — Morphing Checkmark + Error Shake + Success Glow
- **Files:** `components/song-card.tsx`, `app/globals.css`
- Add keyframes: `draw-check`, `circle-fill`, `shake`, `success-glow`
- Sent checkmark: circle pops with overshoot bounce, then checkmark draws via SVG stroke-dashoffset animation
- Error state: shake animation (4px amplitude, 400ms)
- Success glow: brief amber box-shadow pulse (800ms) when card transitions to sent

### Rec #6 — Gradient Share Button + Glow Shadow CTA
- **File:** `components/confirmation-overlay.tsx`
- Share button: `bg-gradient-to-r from-accent to-accent-bright` + `shadow-[0_4px_16px_rgba(245,158,11,0.3)]`
- Done button already glassmorphic from Phase A — just verify it looks good next to gradient Share

### Quick Wins
- **Live dot glow:** Replace `animate-pulse` on connection indicator with `live-glow` keyframe (box-shadow pulse) in `request-queue.tsx`
- **Tap feedback:** Add `active:brightness-95` to song cards in `song-card.tsx`
- **Reduced motion:** Add `@media (prefers-reduced-motion: reduce)` safety net in `globals.css`

---

## Then: Phase C — Shareability

**Recs:** #2 (dynamic mesh gradients) + #7 (musical particles) + #8 (badge/watermark)
**The confirmation overlay becomes a shareable artifact.**

### Rec #2 — Dynamic Mesh Gradient Backgrounds
- **File:** `components/confirmation-overlay.tsx`
- Deterministic hash of song title + artist → unique gradient colors per song
- 2-3 large blurred radial gradient orbs positioned by hash
- Amber core glow for brand consistency
- Every screenshot looks different (Spotify Wrapped virality mechanic)

### Rec #7 — Musical Note Particles + Sonic Ring Pulse
- **Files:** `components/confirmation-overlay.tsx`, `app/globals.css`
- Floating Unicode musical notes (♪ ♫ ♬) drifting upward
- 3 expanding concentric rings from checkmark ("sonic boom")
- Keep existing confetti burst — layer all three
- New keyframes: `float-up`, `ring-pulse`

### Rec #8 — Request Number Badge + Branded Watermark + Time Label
- **Files:** `components/confirmation-overlay.tsx`, `components/song-list.tsx`, `components/song-card.tsx`
- Fetch request count after insert: `supabase.from("song_requests").select("*", { count: "exact", head: true })`
- Glassmorphic pill: "Request #47 tonight"
- Time-of-day label: GOLDEN HOUR (5-8pm) / PRIME TIME (8-11pm) / LATE NIGHT (11pm-2am)
- Branded watermark: "LIVEREQUEST" at 30% opacity at bottom

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
