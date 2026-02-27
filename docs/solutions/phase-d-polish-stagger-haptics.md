---
title: "Phase D — Stagger Animations, Haptic Feedback & Micro-Polish"
category: frontend-patterns
tags: [css-animations, stagger, haptics, progressive-enhancement, mesh-gradient, react-key-trick]
module: UI Components
symptom: "Song list appears all at once (no entry feel), no tactile feedback in venue conditions, flat page background"
root_cause: "Missing staggered entry animation, no haptic API usage, no ambient background depth"
---

# Phase D — Stagger Animations, Haptic Feedback & Micro-Polish

## Problem

The song list loaded all cards simultaneously — no sense of "the app responding to your arrival." In loud venues, visual feedback alone isn't reliable (users glance away). The audience page background was flat black with no depth.

## Solution

### 1. CSS-Only Staggered List Entry

Add a `slide-in` keyframe and apply it via a `.stagger-item` wrapper with per-card delay:

```css
@keyframes slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.stagger-item {
  animation: slide-in 0.3s ease-out backwards;
}
```

```tsx
<div
  className="stagger-item"
  style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}
>
  <SongCard ... />
</div>
```

**Key decision:** Cap delay at 600ms (`Math.min(i * 40, 600)`) so long lists (50+ songs) don't feel sluggish. Cards beyond index 15 all appear at 600ms together.

**Why not `motion` package?** CSS-only stagger covers the entry animation need. The `motion` package (45KB gzipped) is only worth adding if you need layout reflow animations on search filter (cards smoothly gliding into new positions). We skipped it to keep the bundle lean.

### 2. Progressive-Enhancement Haptic Feedback

Create a tiny utility that wraps `navigator.vibrate()`:

```ts
// lib/haptics.ts
export function hapticSuccess() {
  if ("vibrate" in navigator) navigator.vibrate(50);
}
export function hapticError() {
  if ("vibrate" in navigator) navigator.vibrate([50, 100, 50]);
}
export function hapticDismiss() {
  if ("vibrate" in navigator) navigator.vibrate(80);
}
```

**Why this works:**
- `navigator.vibrate` is a no-op on iOS Safari — the `"vibrate" in navigator` check returns false, so no error handling needed
- On Android Chrome, it provides tactile confirmation even when the user isn't looking at the screen
- Keep success under 100ms (longer feels like a notification alert and confuses users)
- Double-pulse pattern `[50, 100, 50]` (vibrate, pause, vibrate) is universally understood as "error/warning"

**Where to call:**
- `hapticSuccess()` — after `onStateChange(song.id, { status: "sent" })` in song-card.tsx
- `hapticError()` — after each error state change in song-card.tsx
- `hapticDismiss()` — at the top of `handleDismiss()` in request-queue.tsx (before optimistic removal)

### 3. Count Badge Bump via React Key Trick

Force a CSS animation to replay when data changes by using React's `key` prop:

```tsx
<span
  key={song.count}
  className="animate-[count-bump_0.3s_ease-out]"
>
  {song.count}
</span>
```

```css
@keyframes count-bump {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
```

**How it works:** When `song.count` changes (e.g., 2 → 3), React sees a new `key` and unmounts the old `<span>`, mounts a new one. The new element starts the CSS animation fresh. No state management or refs needed.

**When to use this pattern:** Any time you need a one-shot CSS animation to replay on data change. Works for badges, counters, notification dots.

### 4. Ambient Mesh Gradient Background

Layer multiple `radial-gradient` calls at low opacity for depth:

```tsx
style={{
  background: `
    radial-gradient(ellipse at 20% 0%, rgba(245, 158, 11, 0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(245, 158, 11, 0.05) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(245, 158, 11, 0.03) 0%, transparent 60%),
    #0D0D0F
  `,
}}
```

**Opacity rules for amber on dark:**
- 3–6% for background ambient gradients (subtle depth, not distracting)
- 7% is the upper limit before amber looks muddy against near-black
- Position ellipses at different corners so they don't stack and create a visible hotspot
- Always include the base color (`#0D0D0F`) as the final layer

## Rejected Alternatives

| Alternative | Why rejected |
|---|---|
| `motion` package for layout animations | 45KB added for a feature (search filter reflow) that isn't core to the venue UX. Can revisit later. |
| JavaScript-driven stagger via `useEffect` + `setTimeout` | Unnecessary complexity. CSS `animation-delay` with `backwards` fill mode achieves the same result declaratively. |
| Web Audio API for sound feedback | Sound is useless in a loud venue. Haptics work regardless of ambient noise. |
| `requestAnimationFrame` loop for count badge | The `key` re-mount trick is simpler and more React-idiomatic. |

## Risk Resolution

**Flagged risk from plan:** "Will CSS-only stagger feel premium enough without `motion`?"
**What actually happened:** The 40ms stagger with 8px translateY creates a satisfying cascade effect. Users don't need layout reflow on filter for the MVP venue use case — they scroll, not search.
**Lesson learned:** Start with CSS-only. Add JS animation libraries only when you hit a specific limitation (layout reflow, shared element transitions, gesture-driven animations).
