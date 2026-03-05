---
title: "LiveRequest Cycle 1 — Mark as Played + Vibe Feedback"
date: 2026-03-01
status: complete
origin: "docs/roadmap.md — Cycle 1 (Stop Losing Data)"
---

# LiveRequest Cycle 1 — Mark as Played + Vibe Feedback — Brainstorm

## Problem

Two data gaps cause permanent information loss every gig:

1. **Dismiss deletes data.** When you tap "Done" on a song, the dismiss API calls `.delete()` on all `song_requests` rows for that song+gig (`app/api/gig/dismiss/route.ts:23-27`). Once deleted, you can never know what you played, calculate response rate, or review past gigs.

2. **No emotional data.** The `song_requests` table only captures *what* was requested (song + session + time). There's no way for the audience to tell you *how the room feels* — loving it, wanting more energy, or wanting it softer.

Every gig run without fixing these = data lost permanently. First gig is March 6.

## Context

### Current schema (`supabase/schema.sql`)
- `song_requests` has 5 columns: `id`, `gig_id`, `song_id`, `session_id`, `created_at`
- No `played_at`, no `vibe`, no `message` columns
- Unique constraint: `(gig_id, song_id, session_id)` — one request per person per song per gig

### Current dismiss flow
- `app/api/gig/dismiss/route.ts` — hard DELETE via service role key
- `components/request-queue.tsx:227-241` — optimistic removal from local state, fire-and-forget API call, if it fails "the next re-query will restore them"
- Songs vanish entirely from the dashboard. No "played" section.

### Current audience flow
- One-tap curated catalog (NOT a form with a submit button like the old Bolt version)
- `components/song-card.tsx` — inserts `{ gig_id, song_id, session_id }` directly to Supabase
- Confirmation overlay appears after success with confetti, song name, share button
- No vibe selection anywhere in the flow

### Current RLS
- Insert policy validates: gig active + requests open + song active + session < 5 requests
- No anon UPDATE or DELETE. Service role handles performer mutations.

### Constraints
- Deadline: March 6 gig (5 days)
- Solo performer, one device (iPad on music stand)
- Must not break the one-tap audience flow
- Realtime subscription currently listens for INSERT events only

## Options

### Decision 1: How to handle "Mark as Played"

#### Option A: `played_at` timestamp column (CHOSEN)
- Add `played_at timestamptz default null` to `song_requests`
- Dismiss API changes from `.delete()` to `.update({ played_at: now() })`
- Undo = `.update({ played_at: null })`
- Dashboard splits into Pending (`played_at IS NULL`) and Played (grayed out, collapsible)
- Pros: Simple, reversible, preserves all data, one migration, gives you the "played at 9:45 PM" timestamp for free
- Cons: Dashboard component gets more complex (two sections)

#### Option B: `is_played` boolean column (REJECTED)
- Simpler column, but loses the timestamp of *when* you played it
- Pros: Slightly simpler queries
- Cons: Lose the "played at what time" data point that analytics needs later

### Decision 2: Where to put vibe feedback in audience UI

#### Option A: On the confirmation overlay (CHOSEN)
- Audience taps a song → celebration overlay appears → "How's the vibe?" with three buttons below the confetti
- Vibe is sent as a separate UPDATE after the initial INSERT (or could be a second API call)
- Pros: Doesn't change the one-tap flow at all, captures vibes from engaged users, optional by nature
- Cons: Some people will close without picking (fine — `vibe` is nullable). Requires a way to UPDATE the request after INSERT.

#### Option B: Inline on each song card (REJECTED)
- Three vibe icons on every card, pick before tapping
- Breaks the one-tap simplicity, clutters every card, confusing

#### Option C: Sticky vibe bar at top/bottom (REJECTED)
- Persistent "How's the vibe?" row, selection applies to next request
- People might not notice it, state management across requests, less intuitive

### Decision 3: Realtime for played-status changes

#### Option A: No realtime for played status (CHOSEN)
- Dashboard already re-fetches on reconnect and visibility change
- Optimistic update = instant feedback, no network round-trip delay
- Solo performer on one device — no need for multi-device sync
- Pros: Simpler code, fewer bugs, better UX (instant), auto-refetch safety net
- Cons: No multi-device sync (not needed now)

#### Option B: Subscribe to UPDATE events (REJECTED)
- Would need to filter out your own updates, handle race conditions between optimistic and realtime
- Only needed for band scenario / multi-device — defer to later

## Tradeoffs

| What we're trading | What we get |
|---|---|
| Dashboard complexity (two sections instead of one) | Permanent data preservation + undo capability |
| Extra UPDATE call after request INSERT (for vibes) | Emotional data without breaking one-tap flow |
| Nullable vibe data (some requests won't have it) | Zero friction — audience chooses if they want to share |
| No multi-device sync for played status | Simpler code, instant feedback, fewer edge cases |

The core tradeoff is **simplicity vs. data capture**, and we're leaning into data capture because every gig without it is data lost forever. The dashboard gets more complex, but the audience flow stays exactly the same.

## Decision

### Mark as Played
- Add `played_at timestamptz default null` to `song_requests`
- Change dismiss API from DELETE to UPDATE
- Dashboard: two sections (Pending + Played), collapsible played section
- Optimistic UI with rollback on error (current implementation only does optimistic removal with no rollback — need to fix this)
- "Mark Played" button (amber) → "Played" button (muted green) → tap again to undo

### Vibe Feedback
- Add `vibe text default null` to `song_requests` (constrained to `'fire' | 'more_energy' | 'softer' | null`)
- Three buttons on the confirmation overlay: 🔥 Loving it / ⚡ More energy / 🌙 Softer please
- After audience selects a vibe, UPDATE the request row with the vibe value
- Nullable — no vibe is fine
- Performer dashboard: show vibe distribution in stats bar

### No Realtime for Played
- Keep current INSERT-only subscription
- Optimistic updates + auto-refetch on reconnect/visibility = sufficient

## Open Questions

1. ~~**How does the vibe UPDATE work with RLS?**~~ **RESOLVED:** Narrow anon UPDATE policy. Audience's Supabase client does the UPDATE directly (same pattern as INSERT). Faster, simpler, no serverless overhead. Policy scoped to: only UPDATE `vibe` column, only on rows matching your `session_id`, only where `vibe IS NULL` (can't change after setting).
2. ~~**Should the vibe UPDATE use the Supabase client directly or go through an API route?**~~ **RESOLVED:** Direct client via RLS. No API route needed.
3. **What CHECK constraint for the vibe column?** A Postgres CHECK constraint (`vibe IN ('fire', 'more_energy', 'softer')`) prevents bad data at the DB level. Should we use an enum type instead? CHECK is simpler and good enough.
4. **Does the confirmation overlay need to know the request row ID to UPDATE it?** Currently the INSERT doesn't return the row. We'd need to either: (a) return the row ID from the INSERT, or (b) match on `(gig_id, song_id, session_id)` for the UPDATE.
5. **Rollback on dismiss error** — current code doesn't rollback (`"the next re-query will restore them"`). The product description wants proper rollback. Worth fixing as part of this cycle.

## Feed-Forward
- **Hardest decision:** Vibe placement. The old Bolt version put vibes in a form flow (pre-submit), but our one-tap catalog doesn't have a form. Chose confirmation overlay because it's the only place that doesn't add friction to the core tap-to-request flow.
- **Rejected alternatives:** `is_played` boolean (loses timestamp), inline vibes on song cards (breaks one-tap), sticky vibe bar (easy to miss), realtime UPDATE subscription (unnecessary complexity for solo performer).
- **Least confident:** The vibe UPDATE RLS policy scoping. We're going with a narrow anon UPDATE policy (client-side, matching INSERT pattern). Need to ensure it's locked down: only `vibe` column, only matching `session_id`, only where `vibe IS NULL`. Also need to figure out how the overlay gets the request row ID (or matches on the unique constraint) to issue the UPDATE.
