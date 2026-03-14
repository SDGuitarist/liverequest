---
title: "feat: Cycle 2 — Musician Intelligence (Pre-Set, Between-Song, Post-Set Logging)"
type: feat
status: active
date: 2026-03-13
origin: docs/brainstorms/2026-03-13-cycle2-musician-intelligence-brainstorm.md
feed_forward:
  risk: "Whether the FAB bottom sheet with song picker + 3 inputs actually fits in 5-7 seconds"
  verify_first: true
---

# feat: Cycle 2 — Musician Intelligence

## Overview

Add three logging windows to the performer dashboard that capture what the performer knows about the room — data that guest requests alone can't provide. The dashboard becomes state-driven, adapting to the gig lifecycle: pre-set setup → live performance with FAB logging → post-set debrief.

This is the foundation for Cycle 3's "Gift" (post-service summary that combines guest data + musician observations).

## Problem Statement / Motivation

LiveRequest currently captures Stream 1 (guest engagement — requests + vibes) but has zero Stream 2 (musician intelligence). Without the performer's observations (song quality, volume calibration, crowd response, overall set feel), Cycle 3's summary is incomplete. The "Gift" that proves venue value requires both streams.

Two-week gig downtime = opportunity to build the complete logging feature and stress-test the 5-7 second constraint with a real guitar and timer.

## What Exactly Is Changing

### New Database Tables

**`venues`**
```sql
CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  notes text,
  default_configuration text CHECK (default_configuration IN ('solo', 'duo', 'trio', 'ensemble')),
  default_genre_style text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
-- No anon policies. All access via service client in API routes.
```

**`performance_sessions`**
```sql
CREATE TABLE performance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  set_number int NOT NULL DEFAULT 1,
  configuration text NOT NULL CHECK (configuration IN ('solo', 'duo', 'trio', 'ensemble')),
  genre_style text,
  status text NOT NULL DEFAULT 'pre_set' CHECK (status IN ('pre_set', 'live', 'post_set', 'complete')),
  -- No pre_set_notes column: pre-set fields are structured (venue FK, configuration, genre_style)
  post_set_data jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE performance_sessions ENABLE ROW LEVEL SECURITY;
-- No anon policies. All access via service client.

-- Only one live session per gig at a time
CREATE UNIQUE INDEX idx_one_live_session_per_gig
  ON performance_sessions (gig_id) WHERE status = 'live';
```

**`song_logs`**
```sql
CREATE TABLE song_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES performance_sessions(id) ON DELETE CASCADE,
  song_id uuid REFERENCES songs(id) ON DELETE SET NULL,
  song_title text,
  song_quality text NOT NULL CHECK (song_quality IN ('off', 'fine', 'locked_in')),
  volume_calibration text NOT NULL CHECK (volume_calibration IN ('too_loud', 'right', 'too_soft')),
  guest_acknowledgment boolean NOT NULL DEFAULT false,
  set_position int NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE song_logs ENABLE ROW LEVEL SECURITY;
-- No anon policies. All access via service client.
```

**`songs` table additions:**
```sql
ALTER TABLE songs ADD COLUMN energy_level text
  CHECK (energy_level IN ('ambient', 'medium', 'high'));
ALTER TABLE songs ADD COLUMN repertoire_type text
  CHECK (repertoire_type IN ('instrumental', 'instrumental_with_vocals',
    'vocal_forward', 'traditional_cultural', 'contemporary_covers'));
```

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/venues/list` | GET | List all venues |
| `/api/venues/create` | POST | Create a new venue inline during pre-set |
| `/api/session/create` | POST | Create performance_session in pre_set status (called when pre-set form first loads with no existing session) |
| `/api/session/go-live` | POST | Transition session status pre_set → live, set started_at (called when performer taps "Go Live" on pre-set form) |
| `/api/session/end-set` | POST | Transition session status live → post_set, set ended_at |
| `/api/session/submit-debrief` | POST | Save post_set_data jsonb, transition to complete |
| `/api/session/log-song` | POST | Insert song_log row (between-song FAB) |
| `/api/session/undo-log` | POST | Delete most recent song_log for the session |

All routes follow the established pattern: `isAuthenticated()` → validate body → `createServiceClient()` → mutation → response. (See `app/api/songs/toggle/route.ts` for the template.)

### New Components

| Component | Type | Purpose |
|-----------|------|---------|
| `components/pre-set-form.tsx` | Client | Venue picker, session config, setlist confirmation |
| `components/post-set-form.tsx` | Client | Debrief form (all post-set fields) |
| `components/song-log-fab.tsx` | Client | Floating action button (visible during live phase) |
| `components/song-log-sheet.tsx` | Client | Bottom sheet with song picker + 3 quick inputs |
| `components/last-log-chip.tsx` | Client | Small chip showing last logged song + undo button |

### Modified Files

| File | Change |
|------|--------|
| `app/performer/dashboard/page.tsx` | Fetch active session, render state-driven content (pre-set / tabs+FAB / post-set) |
| `components/dashboard-tabs.tsx` | Add optional `onEndSet` callback prop for "End Set" button during live phase |
| `lib/supabase/types.ts` | Add `Venue`, `PerformanceSession`, `SongLog` type aliases + new const arrays |
| `lib/supabase/database.types.ts` | Add table definitions for venues, performance_sessions, song_logs + songs column additions |
| `supabase/schema.sql` | Add new tables + alter songs |

## What Must NOT Change

- **Guest request flow** (`/r/[slug]`) — completely untouched
- **Request queue + Realtime** (`components/request-queue.tsx`) — no modifications
- **Existing API routes** (`/api/gig/*`, `/api/songs/*`) — no changes
- **Auth system** (`lib/auth.ts`) — no changes to JWT cookie mechanism
- **Setlist manager** (`components/setlist-manager.tsx`) — toggle functionality unchanged
- **RLS policies on existing tables** (songs, gigs, song_requests) — untouched

## How We'll Know It Worked

1. **Pre-set form:** Performer can select a venue (or create new), set configuration/genre, confirm setlist, and tap "Go Live" — dashboard transitions to live phase
2. **Between-song logging:** Performer taps FAB → bottom sheet opens → taps song → taps 3 inputs → sheet closes. **Total time under 7 seconds** (tested with guitar and timer)
3. **Post-set debrief:** After "End Set," debrief form appears with all fields. Submit transitions to complete.
4. **Session recovery:** Refreshing the browser during a live session restores the live view (not pre-set form)
5. **Multi-set:** After completing Set 1 debrief, "Start Next Set" appears, pre-populates config, increments set_number
6. **Data integrity:** song_logs linked to correct session and song. post_set_data jsonb matches defined TypeScript interface. Unique index prevents duplicate live sessions.
7. **Build passes** with zero TypeScript errors

## Most Likely Way This Plan Is Wrong

The FAB bottom sheet interaction might not fit in 5-7 seconds with a 25+ song setlist. Scrolling through songs in a dark venue on a phone is the riskiest UX assumption. **Mitigation:** verify_first — build the bottom sheet component first, test with guitar + timer. If it fails, implement these fallbacks in order:
1. Show only unplayed songs (shrinks the list as the set progresses)
2. Put the 3 most recently expected songs at the top (hybrid auto-suggest)
3. Drop to 2 inputs (quality + one composite metric) if 3 inputs + song selection > 7 sec

## Proposed Solution

### Dashboard State Machine

The performer dashboard page detects the current phase by querying the active gig's most recent `performance_session`:

```
No active gig         → "No active gig" empty state (existing behavior)
No session            → Pre-set form (create session)
Session status=pre_set → Pre-set form (edit/confirm)
Session status=live    → Normal tabs (Requests + Setlist) + FAB + "End Set" button in tab bar
Session status=post_set → Post-set debrief form
Session status=complete → "Start Next Set" button + session summary
```

This is driven by a single server-side query in `page.tsx`. The `status` field is the source of truth — no client-side state machine needed for phase detection.

### Pre-Set Form Flow

1. Dashboard loads, detects no session → POST `/api/session/create` to initialize a session in `pre_set` status. (If session already exists in `pre_set`, just load it.)
2. Venue selector: dropdown of saved venues + "Add new venue" inline form (name required, address optional)
3. Configuration picker: 4 radio buttons (Solo / Duo / Trio / Ensemble) — defaults to venue's `default_configuration` if set
4. Genre/style: text input — defaults to venue's `default_genre_style` if set
5. Setlist confirmation: shows current songs with energy_level and repertoire_type tags. Read-only — editing happens in GigPrep or Setlist tab.
6. "Go Live" button → POST `/api/session/go-live` → status transitions to `live` → page revalidates → dashboard shows tabs + FAB

### Between-Song FAB Flow

1. FAB is a fixed-position circular button in the bottom-right corner of the dashboard (above the safe area)
2. Tap → bottom sheet slides up from bottom (`translateY(100%)` → `translateY(0)`, `transition-[transform,opacity]`)
3. Bottom sheet shows: song list (unplayed songs first, then played with muted styling), then 3 input rows
4. Performer taps a song → song highlights
5. Performer taps quality (3 options), volume (3 options), acknowledgment (2 options) — all are single-tap toggles, no dropdowns
6. Tapping the last input auto-submits → POST `/api/session/log-song` → sheet closes → haptic confirmation
7. `last-log-chip` appears above FAB showing the song just logged + undo button (visible for 5 seconds, then fades)
8. Undo tap → POST `/api/session/undo-log` → chip disappears

**Optimistic UI pattern** (from `setlist-manager.tsx`): update local state immediately, revert on error, `setTimeout(() => refetch(), 2000)` in catch. Single performer = simple revert, no generation counters. (See brainstorm decision #8, learnings from `setlist-management-review-fixes.md`.)

**Walkup songs (not on setlist):** Bottom sheet includes a "Not on list" option at the bottom. Tapping it shows a text input for the song title. `song_id` is nullable in `song_logs`; `song_title` stores the free-text name. This adds ~5 seconds, which is acceptable because walkups are infrequent.

### "End Set" Button Placement

During the live phase, the "End Set" button lives in the **tab bar** (right side, next to Requests and Setlist tabs). It is styled as a muted, secondary action — not a primary button — to reduce accidental taps. Uses hold-to-confirm (1.5 seconds) as an additional safeguard.

This keeps it accessible without adding a new UI surface. The tab bar is already `sticky top-0`, so "End Set" is always reachable.

**Modified file:** `components/dashboard-tabs.tsx` — add an optional `onEndSet` callback prop, rendered as a right-aligned button when the session is live.

### Post-Set Debrief Flow

1. Performer taps "End Set" in the tab bar → **hold-to-confirm** (press and hold 1.5 seconds) to prevent accidental taps
2. POST `/api/session/end-set` → status transitions to `post_set` → page revalidates
3. Debrief form renders with these fields:
   - **Setlist deviations** (textarea): "What did you change from the planned setlist and why?"
   - **Walkup count** (number input): guests who physically approached
   - **Tips received** (Yes/No toggle)
   - **Manager/staff feedback** (textarea)
   - **Overall set feel** (3-option picker): Off Night / Fine / Felt It
   - **Complaints received** (Yes/No toggle)
   - **Free-form observations** (textarea)
4. "Submit Debrief" → POST `/api/session/submit-debrief` → saves as `post_set_data` jsonb → status transitions to `complete`
5. Dashboard shows session summary + "Start Next Set" button

### `post_set_data` TypeScript Interface

```typescript
interface PostSetData {
  version: 1;
  setlist_deviations: string | null;
  walkup_count: number;
  tips_received: boolean;
  staff_feedback: string | null;
  overall_feel: 'off_night' | 'fine' | 'felt_it';
  complaints_received: boolean;
  observations: string | null;
}
```

The `version` field enables future schema evolution without breaking reads of older sessions.

### Session Recovery

On dashboard load, the server query checks for existing sessions on the active gig:
1. Query `performance_sessions` where `gig_id = active_gig.id` ordered by `created_at DESC`, limit 1
2. If found and status is `live` → render live dashboard + FAB (restores mid-set state)
3. If found and status is `post_set` → render debrief form (restores mid-debrief state)
4. If found and status is `complete` → render "Start Next Set" option
5. If not found → render pre-set form

This handles browser refresh, phone switch, and crash recovery. No client-side persistence needed — the DB is the source of truth.

### JWT Expiry During Live Set

Current JWT cookie expiry is 24 hours (`lib/auth.ts`). A typical set is 1-4 hours. **No change needed.** The 24-hour window covers even the longest gig. If a future change shortens the expiry, the FAB's fetch calls will get 401s → the optimistic revert pattern will fire → the performer sees a visual error state and can re-authenticate.

### Multi-Set Night

After submitting Set 1 debrief:
1. Dashboard shows "Start Next Set" button
2. Tapping it → POST `/api/session/create` with `set_number: previous + 1`, pre-populated configuration and genre from Set 1
3. Pre-set form appears with inherited values. Performer confirms/edits → "Go Live" → new live session

## Technical Considerations

### RLS Strategy (from learnings: `diagnostic-fix-session-rls-races-perf.md`)

All three new tables (`venues`, `performance_sessions`, `song_logs`) get RLS enabled with **zero anon policies**. All reads and writes go through `createServiceClient()` in API routes gated by `isAuthenticated()`. This follows the established defense-in-depth pattern.

Rationale: logging data is performer-only. No guest ever reads venues, sessions, or song logs. The anon key is public — any anon policy is a public endpoint.

### Type Safety (from learnings: `cycle1-vibe-review-fixes.md`)

Define all enum-like values as const arrays + union types before writing components:

```typescript
// lib/supabase/types.ts
export const SESSION_STATUS_VALUES = ['pre_set', 'live', 'post_set', 'complete'] as const;
export type SessionStatus = typeof SESSION_STATUS_VALUES[number];

export const SONG_QUALITY_VALUES = ['off', 'fine', 'locked_in'] as const;
export type SongQuality = typeof SONG_QUALITY_VALUES[number];

export const VOLUME_CAL_VALUES = ['too_loud', 'right', 'too_soft'] as const;
export type VolumeCal = typeof VOLUME_CAL_VALUES[number];

export const CONFIGURATION_VALUES = ['solo', 'duo', 'trio', 'ensemble'] as const;
export type Configuration = typeof CONFIGURATION_VALUES[number];

export const ENERGY_LEVEL_VALUES = ['ambient', 'medium', 'high'] as const;
export type EnergyLevel = typeof ENERGY_LEVEL_VALUES[number];

export const REPERTOIRE_TYPE_VALUES = [
  'instrumental', 'instrumental_with_vocals', 'vocal_forward',
  'traditional_cultural', 'contemporary_covers'
] as const;
export type RepertoireType = typeof REPERTOIRE_TYPE_VALUES[number];

export const OVERALL_FEEL_VALUES = ['off_night', 'fine', 'felt_it'] as const;
export type OverallFeel = typeof OVERALL_FEEL_VALUES[number];
```

Use these const arrays for runtime validation in API routes (same pattern as `VIBE_VALUES`).

### CSS / Animation (from learnings: `glassmorphic-dark-mode-performance.md`, `phase-b-delight-animations.md`)

- **Bottom sheet transition:** `transition-[transform,opacity]` only. Translate from `translateY(100%)`.
- **Backdrop:** `bg-black/50` overlay (not `backdrop-blur` — the dashboard header already uses blur, and 2 blur layers = mobile GPU hazard). The sheet itself uses `bg-surface-raised` (opaque), not glassmorphic.
- **FAB:** `active:scale-[0.98]` + `transition-[background-color,transform]`. One visual signal.
- **Haptics:** Call `hapticSuccess()` from `lib/haptics.ts` on log submission confirmation.
- **Reduced motion:** Global rule in `globals.css` covers all new animations. No per-component media queries.

### set_position Auto-Increment

`set_position` in `song_logs` is assigned by the API route, not the client:

```sql
-- In /api/session/log-song route:
SELECT COALESCE(MAX(set_position), 0) + 1 FROM song_logs WHERE session_id = $1
```

This guarantees sequential ordering even if concurrent requests arrive (single performer makes this unlikely, but the pattern is safe).

## Implementation Phases

### Phase 1: Schema + Types + Migration (small, foundational)
- [ ] Write migration SQL: create `venues`, `performance_sessions`, `song_logs` tables + alter `songs`
- [ ] Add RLS policies (enable + deny-all for anon)
- [ ] Add unique partial index on `performance_sessions` (one live per gig)
- [ ] Update `lib/supabase/database.types.ts` with new table definitions
- [ ] Add type aliases and const arrays to `lib/supabase/types.ts`
- [ ] Define `PostSetData` interface in `lib/supabase/types.ts`
- [ ] Apply migration to Supabase
- [ ] Verify build passes

**Files:** `supabase/migrations/2026XXXX_add_musician_intelligence.sql`, `lib/supabase/database.types.ts`, `lib/supabase/types.ts`

### Phase 2: API Routes (backend plumbing)
- [ ] `app/api/venues/list/route.ts` — GET, auth-gated, service client
- [ ] `app/api/venues/create/route.ts` — POST, validate name (required), address (optional)
- [ ] `app/api/session/create/route.ts` — POST, create session with gig_id, venue_id, configuration, genre_style
- [ ] `app/api/session/go-live/route.ts` — POST, validate session exists + status=pre_set, transition to live + set started_at
- [ ] `app/api/session/end-set/route.ts` — POST, validate status=live, transition to post_set + set ended_at
- [ ] `app/api/session/submit-debrief/route.ts` — POST, validate PostSetData shape, save jsonb, transition to complete
- [ ] `app/api/session/log-song/route.ts` — POST, validate inputs, auto-assign set_position, insert song_log
- [ ] `app/api/session/undo-log/route.ts` — POST, delete most recent song_log for session

**Files:** 8 new route files in `app/api/`

### Phase 3: Dashboard State Machine (the phase-driven rendering)
- [ ] Modify `app/performer/dashboard/page.tsx`: fetch active session, determine phase, conditionally render pre-set / tabs+FAB / post-set / next-set
- [ ] Ensure session recovery works (existing live session → restore live view on page load)

**Files:** `app/performer/dashboard/page.tsx`

### Phase 4: Pre-Set Form Component
- [ ] Build `components/pre-set-form.tsx`: venue selector (dropdown + inline create), configuration radio buttons, genre text input, setlist preview, "Go Live" button
- [ ] Wire to `/api/session/create` + `/api/session/go-live`
- [ ] Apply glassmorphic styling consistent with existing dashboard

**Files:** `components/pre-set-form.tsx`

### Phase 5: FAB + Bottom Sheet (the sacred 5-7 seconds — verify_first)
- [ ] **TEST FIRST:** Build minimal bottom sheet with song list + 3 inputs. Test with guitar + timer before adding polish.
- [ ] Build `components/song-log-fab.tsx`: fixed-position circular button, bottom-right
- [ ] Build `components/song-log-sheet.tsx`: bottom sheet with song picker (unplayed first), 3 input rows, auto-submit on last tap, "Not on list" text input fallback
- [ ] Build `components/last-log-chip.tsx`: shows last logged song + undo, fades after 5 seconds
- [ ] Wire to `/api/session/log-song` + `/api/session/undo-log`
- [ ] Optimistic UI: update local state immediately, revert on error
- [ ] Haptic confirmation on successful log

**Files:** `components/song-log-fab.tsx`, `components/song-log-sheet.tsx`, `components/last-log-chip.tsx`

**If timing test fails (> 7 seconds):**
1. First: show only unplayed songs
2. Second: put 3 expected next songs at top
3. Third: drop to 2 inputs (quality + composite)

### Phase 6: Post-Set Debrief Form
- [ ] Build `components/post-set-form.tsx`: all debrief fields, hold-to-confirm "End Set" trigger, submit button
- [ ] Wire to `/api/session/end-set` + `/api/session/submit-debrief`
- [ ] Add "Start Next Set" button after debrief submission (pre-populates from previous session)

**Files:** `components/post-set-form.tsx`

### Phase 7: Integration + Polish
- [ ] End-to-end flow test: pre-set → go live → log 3+ songs → end set → debrief → complete → start next set
- [ ] Verify session recovery (refresh during live phase)
- [ ] Verify build passes
- [ ] Update HANDOFF.md

**Files:** `HANDOFF.md`

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FAB + song picker > 7 seconds | Medium | High | verify_first: test Phase 5 with guitar + timer. Fallback: reduce inputs |
| Bottom sheet z-index conflicts with dashboard header | Low | Medium | Test on iPad music stand view. Dashboard header is `sticky top-0 z-10`; sheet overlay needs `z-50` |
| GigPrep sync not merged → songs have no tags | Expected | Low | Tags are optional enrichment. Pre-set form works without them. |
| Shared dev/prod Supabase → test data in production | Known | Low | Single performer, can manually clean. Not blocking. |
| jsonb schema drift in post_set_data | Low | Medium | `version` field + TypeScript interface validation on write |

## System-Wide Impact

- **Interaction graph:** Dashboard page → fetches session → renders phase-appropriate component → component calls API route → route uses service client → DB mutation → page revalidates via `revalidatePath`. No Realtime subscriptions needed for logging (single performer, sequential writes).
- **Error propagation:** API route errors → `!res.ok` → component catches → reverts optimistic state → shows error toast. No silent failures.
- **State lifecycle risks:** The only risk is an orphaned `live` session (browser crash). Mitigated by session recovery on dashboard load — the server detects and restores the live session.
- **API surface parity:** New routes follow exact same pattern as existing routes. No new auth mechanism.

## Alternative Approaches Considered

(See brainstorm: `docs/brainstorms/2026-03-13-cycle2-musician-intelligence-brainstorm.md`)

| Alternative | Why Rejected |
|-------------|-------------|
| Third "Log" tab | Burns 30-40% of 5-7 sec budget on tab navigation |
| Separate pages (/performer/pre-set, /performer/post-set) | Breaks "one place" mental model. Easy to forget to visit. |
| Auto-advance song identification | Too rigid for a request-taking performer. Wrong-song corrections eat the time budget. |
| Columns on gigs table (no performance_sessions) | Blocks multi-set logging. Migration pain later. |
| Tags only in GigPrep (no LR columns) | Creates hard dependency on GigPrep sync being available. |
| Simulation-based testing | ADHD research loop in disguise. Build the feature instead. |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-13-cycle2-musician-intelligence-brainstorm.md](docs/brainstorms/2026-03-13-cycle2-musician-intelligence-brainstorm.md) — Key decisions: state-driven dashboard, FAB + bottom sheet, tap-from-setlist, new venues + performance_sessions + song_logs tables, song tags synced from GigPrep
- **Product Bible:** [docs/product-bible.md](docs/product-bible.md) — Stream 2 (Musician Intelligence) full spec

### Internal References

- API route template: `app/api/songs/toggle/route.ts`
- Optimistic UI pattern: `components/setlist-manager.tsx`
- Tab system: `components/dashboard-tabs.tsx`
- Type pattern: `lib/supabase/types.ts` (VIBE_VALUES)
- RLS lesson: `docs/solutions/setlist-management-review-fixes.md`
- Glassmorphic perf: `docs/solutions/glassmorphic-dark-mode-performance.md`
- Animation lesson: `docs/solutions/phase-b-delight-animations.md`
- Haptics: `lib/haptics.ts`

### Learnings Applied

| Learning | From | Applied In |
|----------|------|-----------|
| RLS defense-in-depth | `diagnostic-fix-session-rls-races-perf.md` | Zero anon policies on new tables |
| Match complexity to concurrency | `setlist-management-review-fixes.md` | Simple revert-on-error, no generation counters |
| Narrow types early | `cycle1-vibe-review-fixes.md` | All const arrays + union types defined in Phase 1 |
| Scope CSS transitions | `glassmorphic-dark-mode-performance.md` | `transition-[transform,opacity]` on bottom sheet |
| Max 1 backdrop-blur layer | `glassmorphic-dark-mode-performance.md` | Sheet uses opaque bg, not blur |
| Progressive haptics | `phase-d-polish-stagger-haptics.md` | `hapticSuccess()` on log confirmation |
| Empty catch blocks are bugs | `cycle1-post-review-fixes.md` | All catch blocks revert + self-heal refetch |

## Feed-Forward

- **Hardest decision:** Whether to use jsonb for `post_set_data` vs. individual columns. Chose jsonb with a versioned TypeScript interface — the debrief fields are likely to evolve, and jsonb avoids a migration per field change. The `version` field enables backward-compatible reads.
- **Rejected alternatives:** Individual columns for every post-set field (migration churn), storing pre-set data as jsonb too (pre-set fields are stable enough for columns + the venue FK matters for queries), auto-advance song picker (too rigid).
- **Least confident:** The bottom sheet song picker interaction speed on a 25+ song list in a dark venue. This is flagged as `verify_first` — Phase 5 must be tested with a real guitar and timer before adding polish. If it takes > 7 seconds, fallback order: unplayed-only list → top-3 suggestions → 2 inputs instead of 3.
