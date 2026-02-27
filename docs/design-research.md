# LiveRequest Design Research: From Generic to Stunning

**Date:** 2026-02-27
**Goal:** Make LiveRequest so visually striking that people screenshot and share it unprompted.
**Scope:** Research only — no code changes.

---

## Top 10 Recommendations (Ranked by Impact)

### 1. Glassmorphic Surfaces with White-Opacity Borders

**What it is:** Replace all gray borders (`border-surface-border` / `#3F3F46`) with white at very low opacity (`border-white/[0.06]`). Add `backdrop-saturate-150` to blurred surfaces. Use `bg-white/[0.04]` for input backgrounds instead of solid surface colors.

**Why it works:** Spotify, Apple Music, and Vercel's dark modes all use this technique. White-at-low-opacity borders are nearly invisible at rest but become apparent on hover (bump to `border-white/[0.12]`), creating a cleaner, more immersive look than fixed gray borders which look "dusty" by comparison. The saturation boost on backdrop-blur makes frosted glass feel "rich" instead of washed out.

**Applies to:** Every component — song-card, song-list (search bar), request-queue, confirmation-overlay.

**Code sketch:**
```html
<!-- Search bar: frosted glass -->
<div class="sticky top-0 z-10 px-5 pt-3 pb-3
  bg-surface/72 backdrop-blur-[24px] backdrop-saturate-150
  border-b border-white/[0.06]">
  <input class="w-full pl-10 pr-4 py-3.5 rounded-xl
    bg-white/[0.04] text-text-primary
    border border-white/[0.06]
    focus:border-accent/30 focus:bg-white/[0.06]
    focus:shadow-[0_0_0_3px_rgba(245,158,11,0.06)]
    outline-none transition-all" />
</div>

<!-- Song card: clean borders with hover glow -->
<button class="rounded-xl bg-surface-raised p-4
  border border-white/[0.06]
  hover:border-white/[0.12]
  shadow-[0_0_0_0_rgba(245,158,11,0)]
  hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.08)]
  transition-all duration-300">
```

**Impact: HIGH | Effort: ~30 min (find-and-replace borders across all components)**

---

### 2. Dynamic Mesh Gradient Backgrounds on Confirmation Overlay

**What it is:** Generate a unique gradient background for each song request using a deterministic hash of the song title + artist. Two or three large, blurred radial gradient orbs positioned differently per song, layered over the dark base. Plus an amber core glow for brand consistency.

**Why it works:** This is the core mechanic behind Spotify Wrapped's virality — every screenshot looks different, so sharing stays novel. If every LiveRequest confirmation looks identical, people stop sharing after the first post. A deterministic hash means the same song always gets the same gradient (consistency), but "Bohemian Rhapsody" looks completely different from "Yesterday" (uniqueness).

**Applies to:** `confirmation-overlay.tsx`

**Code sketch:**
```ts
// Deterministic color generation from song data
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getSongPalette(title: string, artist: string | null) {
  const hue1 = hashString(title) % 360;
  const hue2 = (hue1 + 40 + hashString(artist ?? '')) % 360;
  return {
    primary: `hsl(${hue1}, 75%, 50%)`,
    secondary: `hsl(${hue2}, 65%, 40%)`,
    xPos: 25 + (hashString(title + 'x') % 50),  // 25-75%
    yPos: 20 + (hashString(title + 'y') % 40),   // 20-60%
  };
}
```
```html
<!-- Layered gradient orbs -->
<div class="absolute inset-0">
  <div class="absolute inset-0 bg-[#0D0D0F]" />
  <div class="absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-25"
    style="background: {primary}; top: {yPos}%; left: {xPos}%; transform: translate(-50%,-50%)" />
  <div class="absolute w-[400px] h-[400px] rounded-full blur-[120px] opacity-15"
    style="background: {secondary}; bottom: 20%; right: 15%" />
  <div class="absolute w-[300px] h-[300px] rounded-full blur-[100px] opacity-10"
    style="background: #F59E0B; top: 50%; left: 50%; transform: translate(-50%,-50%)" />
</div>
```

**Impact: VERY HIGH | Effort: ~1 hour**

---

### 3. Staggered List Entry + Layout Animations on Filter

**What it is:** Songs fade-and-slide in with staggered delays on first load (CSS-only). When the user types in the search bar, remaining cards smoothly glide into new positions instead of jumping (requires `motion` package).

**Why it works:** Staggered entry creates the impression that the app is "responding to your arrival" — it feels alive. Layout animations when filtering are the single most impressive micro-interaction for list-heavy UIs — the smooth reflow communicates that the app understands spatial relationships.

**Applies to:** `song-list.tsx`

**Code sketch (CSS-only stagger):**
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
// Cap delay at 600ms so long lists don't feel sluggish
<div className="stagger-item"
  style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}>
  <SongCard ... />
</div>
```

**Code sketch (layout animations with `motion`):**
```tsx
import { motion, AnimatePresence } from "motion/react";

<AnimatePresence mode="popLayout">
  {filteredSongs.map((song) => (
    <motion.div key={song.id} layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        layout: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.15 },
      }}>
      <SongCard ... />
    </motion.div>
  ))}
</AnimatePresence>
```

**Impact: HIGH (stagger) / VERY HIGH (layout) | Effort: 10 min CSS / 20 min with motion**

---

### 4. Bigger Touch Targets + Font Sizes for Venue Conditions

**What it is:** Increase song card minimum height from 64px to 72px. Bump song title from 1.125rem to 1.25rem (20px). Bump label text from 0.75rem to 0.875rem (14px). Increase card gap from 6px to 10px. Increase search input padding. Soften primary text from #FAFAFA to #EDEDF0 (reduce halation in dark venues). Fix muted text from #71717A to #8A8A93 (passes WCAG AA).

**Why it works:** Venue users hold phones at arm's length (~40-50cm vs normal 25-30cm), are one-handed, possibly tipsy, in near-zero ambient light. MIT Touch Lab research shows error rates drop significantly with 25-50% larger targets. Pupils dilate in darkness, causing pure white (#FAFAFA) to "bloom" — slightly softened white (#EDEDF0 at ~16:1 contrast) is sharper. Current muted text (#71717A) fails WCAG AA at 3.9:1 contrast.

**Applies to:** `globals.css`, `song-card.tsx`, `song-list.tsx`, `request-queue.tsx`

**Code sketch (globals.css changes):**
```css
/* Font sizes — venue-optimized */
--font-size-song: 1.25rem;       /* was 1.125rem — readable at arm's length */
--line-height-song: 1.35;        /* was 1.3 */
--font-size-label: 0.875rem;     /* was 0.75rem — minimum for venue legibility */
--line-height-label: 1.35;       /* was 1.3 */

/* Contrast — venue-optimized */
--color-text-primary: #EDEDF0;   /* was #FAFAFA — reduces halation in dark */
--color-text-muted: #8A8A93;     /* was #71717A — now passes WCAG AA (4.8:1) */

/* Tighter letter-spacing on display text — editorial feel */
--letter-spacing-hero: -0.03em;  /* was -0.02em */
--letter-spacing-title: -0.02em; /* was -0.01em */
```
```html
<!-- Song card: bigger targets -->
<button class="... min-h-[72px] ...">  <!-- was min-h-[64px] -->
  <div class="w-12 h-12 ...">         <!-- was w-10 h-10 -->

<!-- Song list: more spacing -->
<div class="px-5 pb-8 flex flex-col gap-2.5">  <!-- was gap-1.5 -->

<!-- Search: taller input -->
<input class="... py-3.5 ..." />               <!-- was py-2.5 -->
```

**Impact: HIGH (usability) | Effort: ~30 min**

---

### 5. Ambient Amber Glow on Hover and Sent States

**What it is:** Add colored `box-shadow` glow effects to song cards on hover (subtle) and in the "sent" state (stronger). Use "heat-based glow" on the performer dashboard — songs with 3+ requests get a visible amber aura. Replace the current left accent bar with a vertical gradient that fades at top and bottom.

**Why it works:** In dark mode, black shadows are invisible. Colored shadows create the illusion of light emission — elements appear to glow on the dark surface. Spotify, Tidal, and DICE all use this. The "heat glow" on popular requests communicates popularity visually without reading the number, which is perfect for the performer's glance-and-decide workflow.

**Applies to:** `song-card.tsx`, `request-queue.tsx`

**Code sketch (song card hover):**
```html
<button class="...
  shadow-[0_0_0_0_rgba(245,158,11,0)]
  hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.08)]
  transition-all duration-300">
```
**Code sketch (sent state with glow):**
```html
<button class="bg-accent/[0.06] border border-accent/20
  shadow-[0_0_24px_-8px_rgba(245,158,11,0.15)]">
  <!-- Checkmark with glow ring -->
  <div class="relative">
    <div class="absolute inset-0 rounded-full bg-accent/20 blur-md" />
    <div class="relative w-10 h-10 rounded-full bg-accent/20
      ring-1 ring-accent/30 flex items-center justify-center">
      <svg class="w-4 h-4 text-accent" ... />
    </div>
  </div>
</button>
```
**Code sketch (heat glow on performer queue):**
```tsx
<div style={{
  boxShadow: song.count >= 3
    ? '0 0 24px -8px rgba(245, 158, 11, 0.15)'
    : 'none'
}}>
```
**Code sketch (gradient accent bar):**
```html
<div class="absolute left-0 top-3 bottom-3 w-[3px] rounded-full
  bg-gradient-to-b from-accent/0 via-accent/40 to-accent/0
  opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
```

**Impact: HIGH | Effort: ~30 min**

---

### 6. Gradient Share Button + Glow Shadow CTA

**What it is:** Replace the flat `bg-accent` Share button with a gradient (`from-accent to-accent-bright`) and add an amber glow shadow. Make the Done button glassmorphic (`bg-white/[0.06]` with white border). This "premium CTA" pattern is used by Apple Music, DICE, and Tidal.

**Why it works:** A gradient button with a colored glow-shadow appears to float above the surface, drawing the eye to the primary action. The contrast between the vibrant Share button and the subtle Done button creates clear action hierarchy. The glow shadow uses `rgba(245,158,11,0.3)` which, against the near-black background, creates the "neon sign" effect that matches the Neon Lounge theme.

**Applies to:** `confirmation-overlay.tsx`

**Code sketch:**
```html
<!-- Share: gradient + glow -->
<button class="w-full py-3.5 px-6 rounded-full
  bg-gradient-to-r from-accent to-accent-bright
  text-surface font-display font-bold
  shadow-[0_4px_16px_rgba(245,158,11,0.3)]
  hover:shadow-[0_6px_24px_rgba(245,158,11,0.4)]
  active:scale-[0.98] active:shadow-[0_2px_8px_rgba(245,158,11,0.25)]
  transition-all duration-200">
  Share to Story
</button>

<!-- Done: glassmorphic secondary -->
<button class="w-full py-3.5 px-6 rounded-full
  bg-white/[0.06] border border-white/[0.08]
  text-text-secondary font-body
  hover:bg-white/[0.1] hover:text-text-primary
  active:scale-[0.98] transition-all duration-200">
  Done
</button>
```

**Impact: MEDIUM-HIGH | Effort: ~10 min**

---

### 7. Musical Note Particles + Sonic Ring Pulse

**What it is:** Replace the generic confetti with music-themed celebration: floating musical note characters (Unicode notes) that drift upward, plus expanding concentric rings from the checkmark (a "sonic boom" effect). Keep the confetti burst too for the initial punctuation — layer all three for depth.

**Why it works:** Confetti is generic — every app uses it. Musical notes are on-brand for a music request app. The sonic rings create an "achievement unlocked" / "impact" feeling. Layering multiple subtle effects (rings fire immediately, notes float for 3s, confetti bursts once) creates depth without any single effect being overwhelming. Spotify Wrapped and Duolingo both use context-specific celebrations.

**Applies to:** `confirmation-overlay.tsx`, `globals.css` (new keyframes)

**Code sketch (floating notes):**
```tsx
const NOTES = ['&#9834;', '&#9835;', '&#9836;', '&#9833;'];
// 12-15 particles with random positions, staggered delays, varying sizes
<span className="absolute animate-float-up text-amber-400/30"
  style={{
    left: `${8 + (i * 7.5)}%`,
    bottom: '-20px',
    animationDelay: `${i * 0.25}s`,
    animationDuration: `${3 + (i % 3)}s`,
    fontSize: `${0.7 + (i % 3) * 0.4}rem`,
  }}>
  {note}
</span>
```
**Code sketch (sonic rings):**
```tsx
{[0, 1, 2].map(i => (
  <div key={i}
    className="absolute w-24 h-24 rounded-full border border-amber-400/20
      animate-ring-pulse"
    style={{ animationDelay: `${i * 0.4}s` }} />
))}
```
**New keyframes needed:**
```css
@keyframes float-up {
  0% { transform: translateY(0) rotate(0deg); opacity: 0; }
  10% { opacity: 0.5; }
  80% { opacity: 0.2; }
  100% { transform: translateY(-100vh) rotate(30deg); opacity: 0; }
}
@keyframes ring-pulse {
  0% { transform: scale(0.5); opacity: 0.4; }
  100% { transform: scale(4); opacity: 0; }
}
```

**Impact: MEDIUM-HIGH | Effort: ~45 min**

---

### 8. Request Number Badge + Branded Watermark + Time Label

**What it is:** Three small additions to the confirmation overlay that dramatically increase shareability:
- **Request number:** A glassmorphic pill showing "#47 tonight" — fetched via count query after insert.
- **Branded watermark:** "LIVEREQUEST" at the bottom of the screen at 30% opacity — visible in screenshots, not distracting.
- **Time-of-day label:** "GOLDEN HOUR" (5-8pm), "PRIME TIME" (8-11pm), "LATE NIGHT" (11pm-2am) — adds contextual storytelling.

**Why it works:** The request number creates scarcity ("#3 tonight" = being early) and social proof ("#47" = packed house). The watermark turns every screenshot into a free ad (Strava does this). The time label adds narrative — a "LATE NIGHT" screenshot tells a story without words. Together, these make each screenshot a unique artifact with context: who, what, where, when.

**Applies to:** `confirmation-overlay.tsx`, `song-list.tsx` (pass count), `song-card.tsx` (return count)

**Code sketch:**
```tsx
// After successful insert, fetch count
const { count } = await supabase
  .from("song_requests")
  .select("*", { count: "exact", head: true })
  .eq("gig_id", gigId);
```
```html
<!-- Request number badge -->
<div class="flex items-center gap-2 px-4 py-2 rounded-full
  bg-white/5 border border-white/10 backdrop-blur-sm">
  <span class="text-[10px] tracking-[0.2em] uppercase text-white/40">Request</span>
  <span class="text-sm font-bold text-amber-400 font-display">#{count}</span>
  <span class="text-[10px] tracking-[0.2em] uppercase text-white/40">tonight</span>
</div>

<!-- Time label -->
<div class="flex items-center gap-2">
  <div class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
  <span class="text-[10px] tracking-[0.3em] uppercase text-white/40">LATE NIGHT</span>
</div>

<!-- Watermark -->
<div class="absolute bottom-12 left-0 right-0 flex justify-center opacity-30">
  <span class="text-[11px] font-display font-bold tracking-[0.15em] text-white">
    LIVEREQUEST
  </span>
</div>
```

**Impact: HIGH (for virality) | Effort: ~45 min**

---

### 9. Morphing Checkmark + Error Shake + Success Glow

**What it is:** Three CSS-only animation upgrades to song card state transitions:
- **Morphing checkmark:** The circle scales up with an overshoot bounce, then the checkmark draws itself via SVG stroke animation (300ms delay creates narrative: "something happened" -> "it succeeded").
- **Error shake:** The error indicator shakes horizontally (4px amplitude, 400ms) — universally understood as "no/wrong."
- **Success glow:** A brief amber box-shadow pulse (800ms) when a card transitions to "sent" — the card appears to briefly emit light.

**Why it works:** State transitions should feel like one continuous motion, not three separate states. The drawing checkmark creates a moment of satisfaction (like completing a task in Todoist). The error shake is understood without reading text. The glow pulse provides ambient feedback even in peripheral vision.

**Applies to:** `song-card.tsx`, `globals.css`

**Code sketch (checkmark draw):**
```css
@keyframes draw-check {
  from { stroke-dashoffset: 24; }
  to { stroke-dashoffset: 0; }
}
.check-draw {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: draw-check 0.4s ease-out 0.3s forwards;
}

@keyframes circle-fill {
  from { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.15); opacity: 1; }
  to { transform: scale(1); opacity: 1; }
}
.circle-pop {
  animation: circle-fill 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
```
**Code sketch (error shake):**
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}
```
**Code sketch (success glow):**
```css
@keyframes success-glow {
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 16px 4px rgba(245, 158, 11, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}
```

**Impact: MEDIUM-HIGH | Effort: ~30 min**

---

### 10. Haptic Feedback for Android Users

**What it is:** Add `navigator.vibrate()` calls on three key moments: success (single 50ms pulse), error (double pulse: `[50, 100, 50]`), and dismiss on performer dashboard (80ms pulse). Progressive enhancement — works on Android Chrome, silently ignored on iOS Safari.

**Why it works:** In a loud venue, sound feedback is useless and visual feedback can be missed in a glance. Haptic feedback is the only sense channel that works reliably in every venue condition — the user feels confirmation even when not looking at the screen. Keep durations under 100ms for success (longer feels like a notification and confuses users).

**Applies to:** New `lib/haptics.ts`, `song-card.tsx`, `request-queue.tsx`

**Code sketch:**
```ts
// lib/haptics.ts
export function hapticSuccess() {
  if ('vibrate' in navigator) navigator.vibrate(50);
}
export function hapticError() {
  if ('vibrate' in navigator) navigator.vibrate([50, 100, 50]);
}
export function hapticDismiss() {
  if ('vibrate' in navigator) navigator.vibrate(80);
}
```
```tsx
// In song-card.tsx after state changes:
onStateChange(song.id, { status: "sent" });
hapticSuccess();

// In request-queue.tsx after dismiss:
handleDismiss(song.songId);
hapticDismiss();
```

**Impact: MEDIUM | Effort: ~15 min**

---

## Bonus: Quick Wins (Under 10 Minutes Each)

These didn't make the top 10 but are high-ROI polish items:

| Change | File | Code | Time |
|--------|------|------|------|
| Live dot glow pulse (replace `animate-pulse`) | `request-queue.tsx` | `animation: live-glow 2s ease-in-out infinite` with `box-shadow` keyframes | 5 min |
| Count badge bump on new request | `request-queue.tsx` | `key={song.count}` to force re-mount with `count-bump` animation | 5 min |
| New request slide-in with glow | `request-queue.tsx` | `.new-request` class with `slide-in-new` keyframe | 10 min |
| Scale + shadow + brightness tap feedback | `song-card.tsx` | Add `active:brightness-95 shadow-md active:shadow-sm` | 5 min |
| Mesh gradient on page background | `page.tsx` | Layered `radial-gradient` with amber at 5-7% opacity | 5 min |
| Reduced motion media query | `globals.css` | `@media (prefers-reduced-motion: reduce)` kills all animations | 5 min |
| Image share via html2canvas | `confirmation-overlay.tsx` | Dynamic import + `canvas.toBlob()` + `navigator.share({ files })` | 30 min |
| Safe area inset padding | `globals.css` | `padding-bottom: max(2rem, env(safe-area-inset-bottom))` | 2 min |

---

## New CSS Keyframes (All Needed Animations)

Add these to `globals.css` when implementing:

```css
/* Staggered list entry */
@keyframes slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Checkmark stroke draw */
@keyframes draw-check {
  from { stroke-dashoffset: 24; }
  to { stroke-dashoffset: 0; }
}

/* Circle pop with overshoot */
@keyframes circle-fill {
  from { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.15); opacity: 1; }
  to { transform: scale(1); opacity: 1; }
}

/* Error shake */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}

/* Success glow pulse */
@keyframes success-glow {
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 16px 4px rgba(245, 158, 11, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}

/* Live dot glow */
@keyframes live-glow {
  0%, 100% { box-shadow: 0 0 4px 0 rgba(245, 158, 11, 0.4); opacity: 1; }
  50% { box-shadow: 0 0 12px 4px rgba(245, 158, 11, 0.6); opacity: 0.8; }
}

/* Count bump */
@keyframes count-bump {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* Floating musical notes */
@keyframes float-up {
  0% { transform: translateY(0) rotate(0deg); opacity: 0; }
  10% { opacity: 0.5; }
  80% { opacity: 0.2; }
  100% { transform: translateY(-100vh) rotate(30deg); opacity: 0; }
}

/* Sonic ring pulse */
@keyframes ring-pulse {
  0% { transform: scale(0.5); opacity: 0.4; }
  100% { transform: scale(4); opacity: 0; }
}

/* New request slide-in */
@keyframes slide-in-new {
  from { opacity: 0; transform: translateY(-12px) scale(0.97);
    box-shadow: 0 0 20px 4px rgba(245, 158, 11, 0.2); }
  70% { box-shadow: 0 0 12px 2px rgba(245, 158, 11, 0.1); }
  to { opacity: 1; transform: translateY(0) scale(1);
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}

/* Skeleton shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Reduced motion — global safety net */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Theme Variable Updates (globals.css)

```css
@theme inline {
  /* Surface elevation — expanded from 2 to 4 levels */
  --color-surface:         #0D0D0F;   /* Level 0: page background */
  --color-surface-raised:  #141416;   /* Level 1: cards (was #18181B) */
  --color-surface-overlay: #1C1C1F;   /* Level 2: nested elements, dropdowns */
  --color-surface-hover:   #252528;   /* Level 3: hover/active (was #27272A) */
  --color-surface-modal:   #2A2A2D;   /* Level 4: modals, toasts */
  --color-surface-border:  rgba(255, 255, 255, 0.06);  /* White-based (was #3F3F46) */

  /* Text — venue-optimized */
  --color-text-primary:    #EDEDF0;   /* Softened (was #FAFAFA) — less halation */
  --color-text-muted:      #8A8A93;   /* Bumped (was #71717A) — passes WCAG AA */

  /* Font sizes — venue-optimized */
  --font-size-song:    1.25rem;       /* was 1.125rem */
  --line-height-song:  1.35;          /* was 1.3 */
  --font-size-label:   0.875rem;      /* was 0.75rem */
  --line-height-label: 1.35;          /* was 1.3 */

  /* Letter spacing — tighter for premium editorial feel */
  --letter-spacing-hero:  -0.03em;    /* was -0.02em */
  --letter-spacing-title: -0.02em;    /* was -0.01em */
}
```

---

## Color Theory Notes: Why Amber on Dark Works

- **Warm colors advance visually.** Against cool-neutral #0D0D0F, amber appears to "come forward," creating natural depth.
- **Amber has high perceived luminance.** Even at 10-20% opacity, it's visible on dark backgrounds (blue/purple would be invisible at the same opacity).
- **Gold = premium connotation.** Gold-on-black reads as luxury (credit cards, awards, stage lights).
- **Amber preserves dark adaptation.** Unlike blue light, amber doesn't suppress melatonin or disrupt scotopic vision — users can still see the stage after checking their phone.
- **Opacity rules:** 5-20% for backgrounds/tints, 100% for CTAs and small accent elements. **Never use 40-80% amber as a background** — it looks muddy. That range is for glow/shadow effects only.

---

## Optional Dependency: `motion` (Framer Motion v11+)

**Package:** `motion` (~45KB gzipped, tree-shakeable)
**Install:** `npm install motion`

Worth adding if you want:
- `layout` prop for smooth card reflow on search filter (Rec #3)
- `AnimatePresence` for overlay enter/exit animations
- `layoutId` for shared element transitions (song title morphs from card to overlay)
- `whileTap` with spring physics for premium tap feedback
- Drag gestures for swipe-to-dismiss on performer dashboard

The CSS-only animations cover 80% of the polish. `motion` adds the remaining 20% — but that 20% is the difference between "polished" and "wow."

---

## Reference Apps & Inspiration

| App | What to study | Key technique |
|-----|---------------|---------------|
| Spotify (dark mode) | Surface hierarchy, no borders, single accent color | White overlay elevation, color-extracted gradients |
| Spotify Wrapped | Shareability, personalized visuals | Per-data gradient backgrounds, extreme typography |
| Apple Music | Frosted glass, generous padding | `backdrop-blur + saturate(180%)`, true black base |
| Tidal | Neon accent on black, editorial typography | `box-shadow` glow, tight letter-spacing |
| DICE | Photography-driven dark UI, yellow CTA | Gradient overlays, minimal chrome |
| Shazam | One-action design, radial glow | Pulsing radial gradient, instant feedback |
| Strava | Screenshot-worthy activity summaries | Branded watermark, personalized stats |
| Duolingo | Celebratory micro-interactions | Context-specific animations, streak badges |
| Cash App | Satisfying payment confirmations | Multi-stage celebration, haptic patterns |

---

## Implementation Order (Suggested)

**Phase A — Foundation (1-2 hours):**
Recs #1 (borders) + #4 (sizes/contrast) + #5 (glow effects)
These are all CSS/Tailwind changes. No new dependencies. Transforms the base feel.

**Phase B — Delight (1-2 hours):**
Recs #9 (state animations) + #6 (gradient button) + Quick wins (live dot, tap feedback)
All CSS-only. Adds life to interactions.

**Phase C — Shareability (2-3 hours):**
Recs #2 (dynamic gradients) + #7 (musical particles) + #8 (badge/watermark)
The confirmation overlay becomes a shareable artifact.

**Phase D — Polish (1-2 hours):**
Rec #3 (stagger + layout animations) + #10 (haptics) + image share
Add `motion` package. Final layer of premium feel.
