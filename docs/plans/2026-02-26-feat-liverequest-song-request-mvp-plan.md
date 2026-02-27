---
title: "feat: LiveRequest Song Request MVP"
type: feat
status: active
date: 2026-02-26
deepened: 2026-02-26
origin: docs/brainstorms/2026-02-26-liverequest-mvp.md
feed_forward:
  risk: "The 'shareable' moment — brainstorm flagged that a generic confirmation screen wastes the one moment we have the audience's attention"
  verify_first: true
---

# feat: LiveRequest Song Request MVP

## Enhancement Summary

**Deepened on:** 2026-02-26
**Review agents used:** Security Sentinel, Performance Oracle, Architecture Strategist, Code Simplicity Reviewer, Frontend Races Reviewer, Data Integrity Guardian, TypeScript Reviewer, Frontend Design Skill
**Context7 docs queried:** Supabase Realtime, Next.js App Router

### Key Improvements

1. **Simplified schema from 4 tables to 3** — dropped `performers` table (YAGNI for one performer), hardcode the slug
2. **Inline confirmation overlay instead of separate page** — eliminates a navigation that can fail on venue WiFi, keeps user on song list
3. **ISR instead of SSR for audience page** — page load drops from ~2.3s to ~0.3-0.5s (served from CDN after first visitor)
4. **Client-side INSERT via Supabase RLS** — eliminates Vercel serverless cold start from the request path, real-time chain drops to ~0.5-0.9s
5. **Hardened RLS policies** — validate gig is active + requests open before accepting inserts
6. **Database-enforced request limit** — 5-request limit moved from app code to RLS policy (can't be bypassed)
7. **Partial unique index for one-active-gig** — prevents data corruption from concurrent admin tabs
8. **Complete design system** — "Neon Lounge" theme with Outfit+Sora fonts, amber/charcoal palette, specific Tailwind config
9. **Race condition mitigations** — subscribe-first pattern, useRef for double-tap prevention, reconnect re-query
10. **Connection status indicator** on performer dashboard — shows when WebSocket drops (critical for venue WiFi)

### Scope Reductions (from Simplicity Review)

- Cut `performers` table — one performer, hardcode the slug
- Cut separate confirmation page → inline overlay
- Cut PWA manifest → nobody installs this, they use it for 2 minutes
- Cut Supabase auth middleware → no audience auth, performer uses simple password cookie
- Cut genre grouping → alphabetical list with search only
- Cut performer song/gig management CRUD → use Supabase dashboard directly
- Cut 4 page states → 2 states only (active + everything else)

---

## Overview

Build a mobile web app where live music audiences scan a QR code, browse a performer's song list, and request songs with a single tap. The performer sees requests in real-time on a dashboard during the gig.

**First live test: March 6th, 2026** (8 days from plan date).

**One performer (Alejandro), one MVP, one gig.** Everything else is future.

(see brainstorm: docs/brainstorms/2026-02-26-liverequest-mvp.md)

---

## Problem Statement / Motivation

Live musicians have no structured way to take song requests from audiences. Current options: audience shouts over the music, writes on a napkin, or doesn't bother. This means:

- Musicians miss audience preferences (lost engagement)
- No data on what audiences want (lost business intelligence)
- No proof to venues that music drives revenue (lost leverage)

LiveRequest solves step one: structured, frictionless song requests that generate data passively.

---

## Resolved Open Questions

The brainstorm identified 7 open questions. The spec flow analysis surfaced 14 more. All are resolved below.

### Q1: URL Structure (CRITICAL)

**Decision: Permanent performer URL.**

- Audience URL: `liverequest.vercel.app/r/alejandro` (never changes)
- The backend knows which gig is currently "active"
- Audience doesn't need to know about gigs — they just see songs and request
- Same QR code works at every gig. Print once, use forever.
- Data is tagged with the active `gig_id` automatically

**Why not per-gig URLs?** Extra complexity, new QR codes every gig, links that expire. For MVP with one performer, permanent URL is simpler.

### Q2: Page States

**Decision (simplified from review): Two states, not four.**

| State | When | What Audience Sees |
|---|---|---|
| **Active** | Gig active + requests open | Full song list + tap to request |
| **Everything else** | No gig, requests closed, between gigs | "No active show right now — check back soon!" |

**Why simplified:** The first gig doesn't need a "pre-gig" or "closed but browsable" state. Two states = one conditional. Build the other states post-March 6th if needed.

### Q3: Performer Authentication

**Decision: Simple password via environment variable.**

- The performer dashboard lives at `/performer`
- Protected by a single password stored in `PERFORMER_PASSWORD` env var
- Entered once per session, stored in a cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=86400`)
- No email, no magic link, no OAuth — overkill for one user

### Research Insight: Security Hardening

- **Timing-safe comparison:** Use `crypto.timingSafeEqual()` instead of `===` to prevent timing attacks.
- **Cookie flags:** `HttpOnly=true`, `Secure=true`, `SameSite=Strict`, `Max-Age=86400`.
- **Never expose `service_role` key** — grep codebase before deploying. Only the `anon` key should be `NEXT_PUBLIC_`.
- **Brute-force protection:** Dropped for MVP. Vercel serverless functions are stateless — an in-memory Map resets on every cold start, making it ineffective. One performer, one password, minimal threat. Add post-MVP if needed (use Supabase table or Vercel KV).

### Q4: Song List Size and Organization

**Decision (simplified): Searchable alphabetical list. No genre grouping.**

- Assume 50-150 songs in Alejandro's repertoire
- Alphabetical list with a sticky search bar at top
- Search filters by title or artist as you type
- Large tap targets (minimum 60px height per song row)
- Dark background, high contrast text (venue-friendly)

**Why no genre grouping:** Adds complexity (need genre field on every song, section headers, grouping logic) with no proven payoff for the first gig. Alphabetical + search covers the use case.

### Q5: Network Resilience

**Decision: Optimistic UI + graceful degradation.**

- When audience taps "Request": show confirmation immediately, send request in background
- If request fails: show inline "Failed — tap to retry" on the button. **No automatic retry** (per race condition review — automatic retry + navigation = state ghost bugs).
- Song list uses ISR (Incremental Static Regeneration) — cached on CDN after first visitor, loads in ~0.3-0.5s even on slow connections.
- Performer dashboard: Supabase Realtime with auto-reconnect + re-query on reconnect + visibility change handler.

### Q6: Duplicate Requests

**Decision: Same person can't request the same song twice. Different people requesting the same song = upvotes.**

- Database: `unique(gig_id, song_id, session_id)` constraint
- Performer dashboard: groups requests by song, shows count ("Bohemian Rhapsody — 5 requests")
- Audience sees: the song they already requested is visually marked ("Requested" checkmark)
- On duplicate constraint violation: silently swallow the error — the user got what they wanted.

### Q7-Q14: Remaining Decisions

- **Songs not on list:** Out of scope for MVP. Curated list only.
- **Performer dashboard device:** Phone on music stand, portrait mode, large text (20px+), high contrast.
- **Open/close requests:** Simple toggle on performer dashboard. Updates `gigs.requests_open`.
- **Request limits:** 5 per session per gig, enforced in RLS policy (see Security section).
- **Timestamps:** Relative time ("3m ago") on performer dashboard.
- **Post-gig analytics:** Out of scope. Data is captured for future use.
- **Multiple performers:** Out of scope. One performer, one QR.
- **Audience sees queue?** No. They see their own requested songs only.

---

## Proposed Solution

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Next.js (App Router) + TypeScript | ISR for fast QR-to-page load, beginner-friendly, massive ecosystem |
| **Styling** | Tailwind CSS | Ships with create-next-app, rapid prototyping, mobile-first utilities |
| **Database** | Supabase (Postgres) | SQL is familiar, free tier is generous, real-time built in |
| **Real-time** | Supabase Realtime | WebSocket subscriptions for live request updates on performer dashboard |
| **Hosting** | Vercel | One-click deploy from GitHub, free tier, automatic HTTPS |
| **QR Code** | qrcode.react | Most popular React QR library, SVG output for crisp rendering |
| **Celebration UX** | canvas-confetti | <10KB, one function call, accessibility-aware (respects reduced motion) |
| **Sharing** | Web Share API | Native share sheet on mobile, falls back to clipboard copy |

**Total new dependencies:** `@supabase/supabase-js`, `@supabase/ssr`, `qrcode.react`, `canvas-confetti`

### Research Insight: Performance Architecture

Three changes that move all performance targets from "risky" to "comfortable margin":

| Change | Before | After | Effort |
|---|---|---|---|
| **ISR instead of SSR** for audience page | ~2.3s worst case | ~0.3-0.5s from CDN | 15 min |
| **Client-side INSERT** via Supabase JS + RLS | ~2.7s real-time chain | ~0.5-0.9s | 30 min |
| **Connection pooler** (Supavisor) | Connection exhaustion at 200 users | Comfortable with pooling | 5 min |

**ISR (Incremental Static Regeneration):** The song list doesn't change during a performance. Generate the page statically, revalidate every 60 seconds. After the first visitor, everyone gets a cached CDN response.

```typescript
// app/r/[slug]/page.tsx
export const revalidate = 60 // ISR: regenerate every 60s
```

**Client-side INSERT:** Audience requests go directly to Supabase via the JS client (no Vercel serverless function in the path). RLS policies validate the request. This eliminates cold start latency from the critical path.

**Connection pooler:** Use Supabase's Supavisor (transaction mode) for serverless queries. 200 users share ~10-20 actual connections instead of 200.

### Database Schema

```sql
-- Songs (the performer's repertoire)
-- No performers table — one performer, hardcode the slug
create table songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

-- Gigs
create table gigs (
  id uuid primary key default gen_random_uuid(),
  venue_name text not null,
  gig_date date not null,
  is_active boolean default false,
  requests_open boolean default false,
  created_at timestamptz not null default now()
);

-- Song Requests
create table song_requests (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references gigs(id) on delete restrict,
  song_id uuid not null references songs(id) on delete restrict,
  session_id text not null,
  created_at timestamptz not null default now(),
  unique(gig_id, song_id, session_id)
);

-- ============================================
-- CONSTRAINTS (from Data Integrity Review)
-- ============================================

-- Only one gig can be active at a time (prevents data corruption)
create unique index idx_one_active_gig
  on gigs(is_active)
  where is_active = true;

-- ============================================
-- INDEXES (from Performance Review)
-- ============================================

-- Loading songs (sorted, filtered by active)
create index idx_songs_active on songs(is_active, sort_order)
  where is_active = true;

-- Finding the active gig
create index idx_gigs_active on gigs(is_active)
  where is_active = true;

-- Counting requests per session per gig (for limit check)
create index idx_requests_gig_session on song_requests(gig_id, session_id);

-- Loading requests for a gig, ordered by time
create index idx_requests_gig_created on song_requests(gig_id, created_at desc);

-- ============================================
-- RLS POLICIES (hardened from Security Review)
-- ============================================

alter table songs enable row level security;
alter table gigs enable row level security;
alter table song_requests enable row level security;

-- Public read: songs (active only)
create policy "Public read active songs" on songs
  for select to anon using (is_active = true);

-- Public read: gigs (active only, hide inactive gigs)
create policy "Public read active gigs" on gigs
  for select to anon using (is_active = true);

-- Public read: song requests (only for active gig, hide session_ids of others)
-- NOTE: For MVP, allow full read of active gig requests for the performer dashboard.
-- The performer dashboard uses the anon key too (password auth is a custom cookie, not Supabase Auth).
create policy "Public read requests for active gigs" on song_requests
  for select to anon
  using (gig_id in (select id from gigs where is_active = true));

-- Public insert: song requests (hardened — validates gig is active + open + enforces limit)
create policy "Insert requests on open gigs with limit" on song_requests
  for insert to anon
  with check (
    -- Gig must exist, be active, and have requests open
    exists (
      select 1 from gigs
      where gigs.id = gig_id
        and gigs.is_active = true
        and gigs.requests_open = true
    )
    -- Song must exist and be active
    and exists (
      select 1 from songs
      where songs.id = song_id
        and songs.is_active = true
    )
    -- Enforce 5-request limit per session per gig (can't be bypassed client-side)
    and (
      select count(*) from song_requests sr
      where sr.gig_id = song_requests.gig_id
        and sr.session_id = song_requests.session_id
    ) < 5
  );

-- Enable realtime
alter publication supabase_realtime add table song_requests;
alter publication supabase_realtime add table gigs;
```

### Research Insight: Schema Improvements

From the Data Integrity and Security reviews:

- **`NOT NULL DEFAULT now()`** on all `created_at` columns — prevents silent NULLs that break ordering
- **`ON DELETE RESTRICT`** on all foreign keys — explicit about preventing orphan data
- **Partial unique index `idx_one_active_gig`** — prevents two gigs from being active simultaneously (the most critical integrity gap in the original schema)
- **Hardened RLS INSERT policy** — validates gig active + requests open + song active + enforces 5-request limit, all at the database level. Can't be bypassed by calling the Supabase REST API directly.
- **Scoped SELECT policies** — only expose active songs, active gigs, and requests for the active gig. Don't leak historical data.

### Project Structure (Simplified)

```
liverequest/
  app/
    layout.tsx                    -- Root layout: dark theme, fonts, metadata
    page.tsx                      -- Redirect → /r/alejandro (or use next.config.js redirect)
    r/[slug]/
      page.tsx                    -- AUDIENCE: Song list (ISR) + confirmation overlay
      loading.tsx                 -- Loading skeleton (built-in Next.js Suspense)
    performer/
      page.tsx                    -- PERFORMER: Password login
      dashboard/
        page.tsx                  -- PERFORMER: Live request queue (real-time)
    api/
      auth/
        route.ts                  -- POST: performer password check
  components/
    song-list.tsx                 -- Song list with search (Client Component)
    song-card.tsx                 -- Individual song row with request button
    request-queue.tsx             -- Live request queue for performer
    confirmation-overlay.tsx      -- Fullscreen celebration overlay
  lib/
    supabase/
      client.ts                   -- Browser Supabase client
      server.ts                   -- Server Supabase client
      database.types.ts           -- Auto-generated types (supabase gen types)
      types.ts                    -- Convenience type aliases
    session.ts                    -- Anonymous session ID management
  .env.local                      -- Supabase keys + PERFORMER_PASSWORD
```

**Total: ~13 files.** Down from ~15 in the original plan. Eliminated: `manifest.ts`, `middleware.ts`, `/performer/songs/page.tsx`, `/performer/gigs/page.tsx`, `/r/[slug]/confirmation/[songId]/page.tsx`. Added: `loading.tsx`, `database.types.ts`, `types.ts`, `confirmation-overlay.tsx`.

### Research Insight: Server vs Client Components

| File | Server or Client | Why |
|---|---|---|
| `app/r/[slug]/page.tsx` | **Server** | Fetches songs + gig status from Supabase, passes data to client child |
| `app/r/[slug]/loading.tsx` | **Server** | Loading skeleton shown during ISR revalidation |
| `components/song-list.tsx` | **Client** (`'use client'`) | Needs useState for search, requested songs, overlay state |
| `components/song-card.tsx` | **Client** | Needs onClick for request submission |
| `components/confirmation-overlay.tsx` | **Client** | Needs useEffect for confetti, onClick for share |
| `app/performer/dashboard/page.tsx` | **Server** | Fetches initial requests, passes to client child |
| `components/request-queue.tsx` | **Client** | Needs useEffect for Supabase Realtime subscription |

**Beginner gotcha:** In Next.js 15+, `params` is a **Promise**. Must `await params` in Server Components or use `use(params)` in Client Components. Forgetting this passes `[object Promise]` as the slug.

### Research Insight: TypeScript Patterns

**Generate types from Supabase schema:**
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/database.types.ts
```

Re-run every time you change the database schema. This gives you compile-time type safety on all queries.

**Discriminated unions for request button state:**
```typescript
type RequestState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'error'; message: string }
```

TypeScript narrows the type based on `status` — you can only access `message` when `status === 'error'`. Use this pattern for any component with more than two states.

---

## The Shareable Moment (Feed-Forward Risk Resolution)

This was the brainstorm's "least confident" item. Here's the concrete design, enhanced with the Frontend Design Skill review.

### Design System: "Neon Lounge"

A refined nightlife aesthetic — rich dark surfaces, electric amber accent, generous whitespace, moments of celebration.

**Color Palette:**

| Token | Value | Use |
|---|---|---|
| `surface` | `#0D0D0F` | Body background (warm charcoal, not pure black) |
| `surface-raised` | `#18181B` | Card/list-item backgrounds |
| `surface-hover` | `#27272A` | Hover/pressed states |
| `accent` | `#F59E0B` | Buttons, active states, confetti (amber-500) |
| `accent-bright` | `#FBBF24` | Hover glow (amber-400) |
| `text-primary` | `#FAFAFA` | Headings, song names (19.4:1 contrast ratio) |
| `text-secondary` | `#A1A1AA` | Metadata, timestamps (6.3:1 contrast ratio) |
| `text-muted` | `#71717A` | Placeholders, disabled text |

**Typography:**
- **Display font:** Outfit (headings, song names, hero text)
- **Body font:** Sora (UI text, search, metadata)
- **Hero size:** 2.5rem / 40px (confirmation screen song name)
- **Song name size:** 1.125rem / 18px (readable in dark venue)
- **Minimum text:** 0.875rem / 14px (captions, timestamps)

### Confirmation Overlay Design

After requesting a song, a fullscreen overlay appears (no page navigation):

1. **Checkmark icon** — scales in with a spring animation (0.4s)
2. **"Request Sent"** — small amber label, uppercase tracking
3. **Song name** — 40px bold Outfit, the hero of the screenshot. Max-width 280px forces clean line breaks.
4. **Artist name** — smaller, secondary text
5. **Venue context** — "Requested at The Blue Note"
6. **Radial amber glow** — subtle `radial-gradient` behind center content. Makes the screenshot feel warm and designed.
7. **canvas-confetti** — amber/gold particles on mount. Respects `prefers-reduced-motion`.
8. **"Share" button** — pill-shaped, triggers Web Share API. Falls back to clipboard copy.
9. **"Done" button** — dismisses overlay, returns to song list (no navigation needed)

**Staggered animation:** Each element fades up with 0.1-0.15s delays, building drama toward the song name. Per the Frontend Design Skill: "One well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions."

**Why inline overlay, not a separate page:** (from Architecture Review) Every page navigation on venue WiFi is a risk. A separate route means a new server request, potential cold start, broken back-button behavior, and dead URLs if someone bookmarks it. The overlay keeps the user on the song list, ready to request another.

### Research Insight: Subtle Texture

Add a noise grain overlay (`opacity: 0.03`) on the body to prevent the flat digital feel. A single CSS pseudo-element — barely perceptible but adds the tactile quality of film grain.

---

## Audience Experience Flow (Complete)

```
[Scan QR] → Browser opens /r/alejandro (ISR, served from CDN in ~0.3s)
    │
    ├─ No active gig or requests closed → "No active show right now" message
    │
    └─ Gig active + requests open → Song list
        │
        ├─ [Sticky search bar] → Filter songs by title/artist
        │
        └─ [Tap a song card] →
            │
            ├─ Already requested → Silently swallow (card shows "Requested" checkmark)
            │
            ├─ At request limit (5) → Toast: "You've used all your requests!"
            │
            ├─ Sending → Button shows spinner, disabled (useRef gate prevents double-tap)
            │
            ├─ Failed → Button shows "Failed — tap to retry" (no auto-retry)
            │
            └─ Success → Confirmation overlay appears
                │
                ├─ Confetti animation (canvas-confetti, amber particles)
                ├─ Staggered fade-up: checkmark → label → song name → artist → venue
                ├─ [Share] → Native share sheet (Web Share API)
                └─ [Done] → Dismiss overlay, return to song list
```

---

## Performer Experience Flow (Complete)

```
[Open /performer] → Password entry
    │
    └─ Authenticated (cookie set) → Dashboard
        │
        ├─ [Connection indicator] ← Green dot = WebSocket connected, Red = disconnected
        │
        ├─ [Toggle: Open/Close Requests]
        │   └─ Updates gigs.requests_open → audience page state updates via ISR revalidation
        │
        ├─ [Live Request Queue]
        │   ├─ SQL-grouped by song, sorted by request count (descending)
        │   ├─ "Bohemian Rhapsody — 7 reqs (3m ago)" ← left amber bar + large count badge
        │   ├─ New requests appear instantly (Supabase Realtime)
        │   ├─ Subscribe-first, query-second pattern (no missed events gap)
        │   └─ Re-query on WebSocket reconnect + visibility change
        │
        └─ [QR Code] — inline QR display (qrcode.react SVG) for sharing with audience
```

### Research Insight: Race Condition Mitigations

From the Frontend Races Review — these are the 4 most critical mitigations for a live gig:

**1. Double-tap prevention:** Use `useRef` (not `useState`) as a synchronous gate. React's batched state updates will let two rapid taps both read `state === idle`. A ref gives you a synchronous, mutable gate.

**2. Realtime gap (subscribe-first):** On performer dashboard, subscribe to Realtime FIRST, then query existing data. Deduplicate with a `seenIds` ref. This prevents the gap where a request arrives between the query response and subscription start.

**3. Request limit (pessimistic counter):** Use a `pendingCount` ref that reserves slots BEFORE the async insert call. Rapid taps see the counter incrementing synchronously. The database RLS policy is the real enforcer; the client is just being polite.

**4. WebSocket reconnect:** On reconnect status change AND on `document.visibilitychange` (phone unlocked from pocket), re-query all requests and merge with the existing set using deduplication.

---

## Technical Considerations

### Performance

- **ISR for audience page:** Song list cached on CDN, revalidated every 60s. Page load ~0.3-0.5s from QR scan. No blank white page.
- **Client-side INSERT:** Requests go directly to Supabase via the JS client. No Vercel serverless function in the critical path. Real-time chain: ~0.5-0.9s.
- **Connection pooling:** Supavisor (transaction mode) for serverless queries. 200 users share ~10-20 connections.
- **Dynamic import for confetti:** `import('canvas-confetti')` only on the confirmation overlay. Audience page ships zero unnecessary JS.
- **Server-side grouped query for dashboard:**
  ```sql
  SELECT s.id, s.title, s.artist,
         COUNT(r.id) AS request_count,
         MAX(r.created_at) AS latest_request
  FROM songs s
  LEFT JOIN song_requests r ON r.song_id = s.id AND r.gig_id = $1
  WHERE s.is_active = true
  GROUP BY s.id, s.title, s.artist
  HAVING COUNT(r.id) > 0
  ORDER BY request_count DESC;
  ```
  Returns ~30 rows (one per requested song) instead of all individual request rows.

### Performance Targets (After Optimizations)

| Target | Estimate |
|---|---|
| Page load on 4G | ~0.3-0.5s from CDN (ISR) |
| Request-to-dashboard latency | ~0.5-0.9s (client-side INSERT + Realtime) |
| 200 concurrent users | Comfortable with connection pooling |

### Security

- **Hardened RLS:** INSERT policy validates gig active + requests open + song active + 5-request limit. All enforced at database level.
- **No sensitive data:** No PII collected. Session IDs are random UUIDs.
- **Performer password:** Stored as env var (not `NEXT_PUBLIC_`), checked with `crypto.timingSafeEqual()`, brute-force protected.
- **Cookie security:** `HttpOnly`, `Secure`, `SameSite=Strict`.
- **HTTPS by default:** Vercel provides automatic SSL.
- **Anon key is safe:** RLS is the lock. The anon key just identifies the project.
- **No `service_role` key in client code** — verify before deploying.

### Research Insight: Rate Limiting

The security review flagged that **anyone with the anon key can call the Supabase REST API directly**, bypassing the Next.js frontend entirely. The hardened RLS policies handle validation, but to prevent flooding:

- **Option A (recommended for MVP):** Route all writes through a Next.js API route with IP-based rate limiting (10 requests/IP/minute using `rate-limiter-flexible` or an in-memory Map).
- **Option B:** Accept that RLS + unique constraint + 5-request limit per session is sufficient for a live venue. The realistic threat at a 50-200 person gig is low.

**Decision:** Start with Option B. If abuse occurs at the March 6th gig, add the API route rate limiter in the next iteration.

### Venue Environment Design

- **Dark mode by default:** `#0D0D0F` background (warm charcoal, not pure black)
- **Large tap targets:** Minimum 60px height per song row. Thumb-friendly, one-handed use.
- **High contrast:** All text passes WCAG AA. Amber on charcoal = 9.2:1 ratio.
- **No onboarding:** Zero explanation needed. Scan → see songs → tap.
- **15-second rule:** QR scan to confirmation in under 15 seconds.
- **Sticky search:** Always visible while scrolling 50-150 songs.
- **Noise grain overlay:** Subtle texture (`opacity: 0.03`) prevents flat digital feel.
- **Performer dashboard:** Keep-awake via Wake Lock API so phone screen doesn't dim on music stand.

---

## Implementation Phases

### Phase 1: Foundation (Days 1-2)

**Goal: Deployed skeleton with database, accessible via URL.**

Tasks:
- [x] `npx create-next-app@latest liverequest` (TypeScript, Tailwind, App Router)
- [x] Configure Tailwind with Neon Lounge design tokens (colors, fonts, type scale, keyframes)
- [x] Add Google Fonts: Outfit (500, 700) + Sora (400, 600)
- [ ] Create Supabase project, run full schema SQL (tables + constraints + indexes + RLS + realtime)
- [ ] Generate TypeScript types: `npx supabase gen types typescript --project-id XXX > lib/supabase/database.types.ts`
- [x] Set up `lib/supabase/client.ts` and `lib/supabase/server.ts` (typed with `Database` generic)
- [x] Set up `lib/supabase/types.ts` (convenience aliases: `Song`, `Gig`, `SongRequest`)
- [x] Create `.env.local` with Supabase keys + `PERFORMER_PASSWORD`
- [ ] Enable Supabase connection pooler (Supavisor, transaction mode)
- [x] Push to GitHub, connect to Vercel via Supabase marketplace integration, deploy
- [ ] Verify: visiting the Vercel URL shows the Next.js default page
- [x] Seed database: create a test gig, add 20-30 test songs via Supabase dashboard

**Success criteria:** App deployed on Vercel. Supabase tables + RLS + indexes exist. Typed Supabase clients work. Test data seeded.

### Phase 2: Audience Experience (Days 3-4)

**Goal: Audience can scan QR, see songs, and request a song with celebration.**

Tasks:
- [ ] Build `app/r/[slug]/page.tsx` — ISR song list page (`export const revalidate = 60`)
  - Server Component: fetch active gig + songs from Supabase server client
  - If no active gig or requests closed, show fallback message
  - Pass songs + gig data to `<SongList>` client component
- [ ] Build `app/r/[slug]/loading.tsx` — skeleton UI (built-in Suspense boundary)
- [ ] Build `lib/session.ts` — anonymous session ID (`crypto.randomUUID()` + localStorage)
- [ ] Build `components/song-list.tsx` — Client Component with:
  - Sticky search bar with `backdrop-blur-xl`
  - Alphabetical song list
  - State for requested song IDs, overlay visibility
  - `useRef` gate to prevent double-tap
  - Pessimistic `pendingCount` ref for request limit
- [ ] Build `components/song-card.tsx` — song row with:
  - 60px minimum height, amber "+" icon, `active:scale-[0.98]` press animation
  - Discriminated union state: idle → sending → sent → error
  - Client-side INSERT to Supabase (no API route)
  - Handle unique constraint violation (silently swallow)
  - Handle RLS rejection when gig is closed (graceful toast)
- [ ] Build `components/confirmation-overlay.tsx` — fullscreen celebration:
  - Dynamic import: `import('canvas-confetti')` on mount
  - Staggered fade-up animations (checkmark → label → song → artist → venue)
  - Radial amber glow background
  - Share button (Web Share API with clipboard fallback)
  - "Done" button dismisses overlay
- [ ] Mobile-first styling: Neon Lounge theme, dark mode, large tap targets

**Success criteria:** Open `/r/alejandro` on a phone → see songs → tap one → see confetti overlay + share works → dismiss and request another.

### Phase 3: Performer Experience (Days 5-6)

**Goal: Performer can see live requests and control the gig.**

Tasks:
- [ ] Build `app/api/auth/route.ts` — POST handler for performer password check
  - `crypto.timingSafeEqual()` comparison
  - Set `HttpOnly`, `Secure`, `SameSite=Strict` cookie on success
- [ ] Build `app/performer/page.tsx` — password login form
- [ ] Build `app/performer/dashboard/page.tsx` — Server Component shell
  - Check auth cookie, redirect to login if missing
  - Fetch initial grouped requests via SQL query
  - Pass to `<RequestQueue>` client component
- [ ] Build `components/request-queue.tsx` — Client Component with:
  - Subscribe-first, query-second pattern (no missed events gap)
  - `seenIds` ref for deduplication
  - Re-query on reconnect + `visibilitychange`
  - Connection status indicator (green/red dot)
  - Sorted by request count descending
  - Left amber bar + large count badge per song
  - Relative timestamps ("3m ago")
  - Large text, high contrast, glanceable
- [ ] Build request toggle: "Open Requests" / "Close Requests" button
  - Updates `gigs.requests_open` in Supabase
- [ ] Inline QR code display (`qrcode.react` SVG) on dashboard
- [ ] Wake Lock API to prevent screen dimming on music stand

**Success criteria:** Login to `/performer` → see gig dashboard → toggle requests open → see requests appear in real-time → close requests → QR code visible for sharing.

### Phase 4: Polish & Live Test Prep (Days 7-8)

**Goal: Ready for March 6th gig.**

Tasks:
- [ ] Test QR code scanning in a dark room with 3+ phones (iOS + Android)
- [ ] Print fallback: add short URL text below QR code on display
- [ ] Test the full flow end-to-end: scan → search → request → confetti → share → done
- [ ] Test performer dashboard on phone: readable from music stand distance?
- [ ] Test network resilience: airplane mode mid-request → verify "Failed — tap to retry"
- [ ] Test WebSocket reconnect: toggle WiFi off/on → verify dashboard catches up
- [ ] Seed Alejandro's real song list (replace test data via Supabase dashboard)
- [ ] Create the March 6th gig in Supabase dashboard
- [ ] Activate the gig (will be the only active one, enforced by partial unique index)
- [ ] Generate and display QR code from performer dashboard
- [ ] Run a "dress rehearsal": have a friend test the full flow in dim lighting
- [ ] Verify: `service_role` key is NOT in any client-side code

**Success criteria:** A friend who has never seen the app can scan the QR, find a song, request it, and see the celebration — all in under 15 seconds, in dim lighting, holding their phone with one hand.

---

## Acceptance Criteria

### Functional Requirements

- [ ] Audience scans QR code → sees song list within 0.5 seconds (ISR/CDN)
- [ ] Audience can search/filter songs by title or artist
- [ ] Audience can request a song with a single tap (no forms, no login)
- [ ] After requesting, audience sees fullscreen confetti celebration overlay
- [ ] Share button triggers native share sheet (or copies link as fallback)
- [ ] Same person cannot request the same song twice per gig (DB constraint)
- [ ] Each session limited to 5 requests per gig (enforced in RLS policy)
- [ ] Double-tap prevention via useRef gate
- [ ] Performer dashboard shows requests grouped by song with counts
- [ ] New requests appear on performer dashboard in real-time (<1 second)
- [ ] Connection status indicator shows WebSocket health
- [ ] Performer can open and close requests with a toggle
- [ ] When requests are closed, audience sees fallback message
- [ ] QR code is generated and displayable from performer dashboard

### Non-Functional Requirements

- [ ] Works on iOS Safari and Android Chrome (95%+ of venue audience)
- [ ] Dark mode by default (Neon Lounge theme)
- [ ] All tap targets minimum 60px height
- [ ] Page load under 0.5 seconds on 4G (ISR/CDN)
- [ ] Accessible: respects `prefers-reduced-motion` for confetti and animations
- [ ] No PII collected — session IDs are opaque random UUIDs
- [ ] All text passes WCAG AA contrast ratios

---

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase free tier pauses after 7 days inactivity | Medium | High (app goes down) | Visit Supabase dashboard before each gig; consider $25/mo Pro for production |
| Venue has poor WiFi/cell coverage | High | High (requests fail) | Optimistic UI + ISR (page loads from CDN even without Supabase); "Failed — tap to retry" |
| QR code doesn't scan in dark lighting | Medium | High (no audience access) | Print fallback URL below QR, test in dim conditions, display on backlit screen (iPad/laptop) |
| WebSocket drops during set | High | Medium (dashboard stale) | Connection indicator, re-query on reconnect + visibility change, manual refresh button |
| 8-day timeline is too tight | Medium | Medium | Phases ordered by priority. Cut performer management (use Supabase dashboard directly) |
| Session spoofing (clearing localStorage) | Low | Low (extra requests) | Acceptable for MVP. RLS limit still applies per new session. Add IP rate limiting post-MVP if needed. |

**If time runs short, cut in this order (last to first):**
1. Search on song list → just show the full list with scroll
2. Share button → keep the celebration overlay, drop the share
3. Noise grain overlay → purely cosmetic, not worth the time
4. Connection status indicator → performer can manually refresh
5. Wake Lock API → performer taps screen to keep it awake

**Never cut:**
- The audience request flow (scan → browse → tap → celebrate)
- The performer live dashboard (real-time request queue)
- The confirmation overlay with confetti (the shareable moment)
- The hardened RLS policies (security baseline)

---

## Tailwind Configuration

Full `tailwind.config.js` extension for the Neon Lounge design system:

```js
// tailwind.config.js (extend section)
{
  colors: {
    surface: {
      DEFAULT: '#0D0D0F',
      raised:  '#18181B',
      hover:   '#27272A',
      border:  '#3F3F46',
    },
    accent: {
      DEFAULT: '#F59E0B',
      bright:  '#FBBF24',
      dim:     '#B45309',
      surface: 'rgba(245, 158, 11, 0.10)',
    },
    text: {
      primary:   '#FAFAFA',
      secondary: '#A1A1AA',
      muted:     '#71717A',
    },
    success: '#34D399',
    danger:  '#F87171',
  },
  fontFamily: {
    display: ['Outfit', 'sans-serif'],
    body:    ['Sora', 'sans-serif'],
  },
  fontSize: {
    hero:    ['2.5rem',   { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
    title:   ['1.5rem',   { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
    song:    ['1.125rem', { lineHeight: '1.3', fontWeight: '600' }],
    body:    ['1rem',     { lineHeight: '1.5', fontWeight: '400' }],
    caption: ['0.875rem', { lineHeight: '1.4', fontWeight: '400' }],
    label:   ['0.75rem',  { lineHeight: '1.3', fontWeight: '600', letterSpacing: '0.05em' }],
  },
  keyframes: {
    'scale-in': {
      from: { transform: 'scale(0)', opacity: '0' },
      to:   { transform: 'scale(1)', opacity: '1' },
    },
    'fade-up': {
      from: { transform: 'translateY(12px)', opacity: '0' },
      to:   { transform: 'translateY(0)', opacity: '1' },
    },
  },
  animation: {
    'scale-in': 'scale-in 0.4s ease-out',
    'fade-up':  'fade-up 0.4s ease-out',
  },
}
```

---

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-26-liverequest-mvp.md](docs/brainstorms/2026-02-26-liverequest-mvp.md)
- Key decisions carried forward: Song requests only, start from scratch, web app not native, curated song list

### Technical References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Next.js ISR (Incremental Static Regeneration)](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Supabase + Next.js SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Vercel Integration](https://vercel.com/marketplace/supabase)
- [Supabase Connection Pooling (Supavisor)](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Web Share API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)
- [Wake Lock API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Wake_Lock_API)
- [canvas-confetti](https://github.com/catdad/canvas-confetti)
- [qrcode.react](https://github.com/zpao/qrcode.react)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

### Review Agents Applied

- **Security Sentinel:** Hardened RLS policies, brute-force protection, cookie security, rate limiting analysis
- **Performance Oracle:** ISR vs SSR, client-side INSERT, connection pooling, bundle optimization, database indexing
- **Architecture Strategist:** Inline confirmation, loading.tsx, connection status indicator, force-dynamic vs ISR
- **Code Simplicity Reviewer:** Removed performers table, genre grouping, separate confirmation page, PWA manifest, CRUD pages
- **Frontend Races Reviewer:** Double-tap (useRef gate), Realtime gap (subscribe-first), request limit (pessimistic counter), WebSocket reconnect (re-query + visibility)
- **Data Integrity Guardian:** Partial unique index for one-active-gig, NOT NULL defaults, explicit ON DELETE, cross-table validation, missing indexes
- **TypeScript Reviewer:** Params as Promise, generated types, discriminated unions, Server/Client component split
- **Frontend Design Skill:** Neon Lounge theme, Outfit+Sora fonts, amber/charcoal palette, component patterns, animation system

---

## Feed-Forward

- **Hardest decision:** Whether to route writes through a Next.js API route (for rate limiting) or let clients INSERT directly via Supabase (for performance). Chose direct INSERT because it eliminates serverless cold starts from the critical path, and the RLS policies are hardened enough for a live venue MVP. If abuse occurs at the gig, the API route rate limiter is a one-session addition.
- **Rejected alternatives:** (1) Keeping 4 database tables — performers table is YAGNI for one performer. (2) Separate confirmation page — every page navigation on venue WiFi is a risk. (3) SSR instead of ISR — ISR gives us CDN caching, dropping page load from ~2.3s to ~0.3s. (4) Firebase instead of Supabase — Supabase has better Vercel integration and SQL is more beginner-friendly. (5) Polling instead of WebSockets — adds latency and complexity. (6) Automatic retry on request failure — creates state ghost bugs when user navigates away before retry completes.
- **Least confident:** Whether the ISR revalidation (60s) is fast enough for the gig toggle. When the performer opens/closes requests, audience pages served from cache will be up to 60 seconds stale. The audience might tap a song and get an RLS rejection ("requests closed") that looks like a bug. Mitigation: the RLS rejection is handled gracefully with a toast message. But the UX gap between "page shows songs are requestable" and "server says requests are closed" is the roughest edge in the plan. If this proves problematic at the March 6th gig, switch the gig status check to a client-side fetch on page load (not ISR-cached).
