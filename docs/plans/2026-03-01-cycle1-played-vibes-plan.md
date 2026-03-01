---
title: "LiveRequest Cycle 1 — Mark as Played + Vibe Feedback"
date: 2026-03-01
status: reviewed
deepened: 2026-03-01
origin: "docs/brainstorms/2026-03-01-cycle1-played-vibes.md"
research: "docs/brainstorms/2026-03-01-cycle1-played-vibes-research.md"
deadline: 2026-03-06
feed_forward:
  risk: "Vibe UPDATE RLS policy scoping — RLS only restricts rows, not columns. Resolved: use GRANT/REVOKE for column restriction + RLS for row restriction."
  verify_first: true
---

# LiveRequest Cycle 1 — Mark as Played + Vibe Feedback — Plan

## Enhancement Summary

**Deepened on:** 2026-03-01
**Research agents used:** 14 (security sentinel, data migration expert, frontend race conditions reviewer, architecture strategist, code simplicity reviewer, pattern recognition specialist, TypeScript reviewer, performance oracle, data integrity guardian, user flow analyzer, learnings researcher, best-practices researchers x2, framework-docs researcher)

### Key Improvements from Research

1. **Critical bug fix:** Snapshot-and-rollback pattern changed from saving entire array to saving only removed items — prevents silently dropping Realtime INSERTs that arrive during an in-flight dismiss
2. **Race condition guard:** Added `dismissingIds` ref to coordinate between optimistic updates, Realtime subscription, and `fetchRequests`
3. **Simplification:** Dropped `x-session-id` session matching from RLS (untested, risky, negligible blast radius without it) — eliminates Step 6c entirely
4. **Type safety fix:** `requestId` made optional to handle 23505 duplicate constraint path where no row ID is returned
5. **Pattern fix:** Separate `onRequestCreated` callback instead of overloading `onSuccess`
6. **Design decision captured:** Played songs DO count toward 5-request limit (intentional — prevents queue domination)

### Findings That Did NOT Change the Plan

- Architecture review confirmed all major decisions (soft-delete via `played_at`, two separate routes vs toggle, no realtime for UPDATE events)
- Performance review gave clean bill of health — all operations sub-millisecond at 50-row scale
- Data migration review confirmed SQL is correct, transactional, no table rewrite, NULL passes CHECK
- Supabase insert returning research confirmed `.insert().select('id').single()` is one atomic operation

---

## Overview

Stop losing data. Every gig run without this = permanently lost information. Two changes:
1. **Mark as Played** — dismiss changes from DELETE to UPDATE `played_at`, preserving all request data
2. **Vibe Feedback** — audience can optionally send a vibe emoji after requesting a song

Deadline: March 6 gig. Solo performer, one device (iPad).

## Risk from Brainstorm (Resolved)

The brainstorm's "least confident" area was **vibe UPDATE RLS policy scoping**. The research resolved it:

> RLS restricts rows. GRANT/REVOKE restricts columns. You need both.

The migration must include `REVOKE UPDATE ON song_requests FROM anon` + `GRANT UPDATE (vibe) ON song_requests TO anon` so anon can only touch the `vibe` column. Then RLS handles which rows (vibe IS NULL, active gig).

**Simplification from research:** The original plan included `session_id = current_setting('request.headers')` in the RLS policy. All review agents agree this should be dropped for MVP:
- It's untested in our setup and is the single riskiest item in the plan
- Column-level GRANT already restricts anon to ONLY the `vibe` column
- `vibe IS NULL` prevents re-setting
- Worst case without session check: someone sets a vibe on another person's request (negligible)
- Dropping it eliminates Step 6c (client header config) entirely — one less file to touch

---

## Step 1: Migration — Add Columns + Security Layers

**Files:** New migration file, `supabase/schema.sql` (update reference)

Create migration via `supabase migration new add_played_at_and_vibe`.

### Migration SQL

```sql
-- 1. Add columns (safe: no table rewrite, nullable DEFAULT NULL)
ALTER TABLE song_requests
  ADD COLUMN played_at timestamptz DEFAULT NULL;

-- SYNC: vibe values also defined in lib/supabase/types.ts (VIBE_VALUES) and RLS policy below
ALTER TABLE song_requests
  ADD COLUMN vibe text DEFAULT NULL
  CONSTRAINT valid_vibe CHECK (vibe IN ('fire', 'more_energy', 'softer'));
-- vibe NULL means either "not prompted" or "prompted but skipped" — acceptable for v1

-- 2. Column-level privilege: anon can ONLY update vibe, nothing else
-- Order matters: REVOKE removes table-level, GRANT adds column-level.
-- Any future columns that anon needs to UPDATE will require explicit GRANT statements.
REVOKE UPDATE ON song_requests FROM anon;
GRANT UPDATE (vibe) ON song_requests TO anon;

-- 3. RLS: which rows anon can update (vibe not already set + active gig)
-- No active-gig check: the INSERT is the access control gate;
-- the vibe is just metadata on an already-valid request.
-- Allowing vibes after gig closes prevents silent failure on the overlay.
CREATE POLICY "Anon can set vibe on requests"
  ON song_requests
  FOR UPDATE
  TO anon
  USING (
    vibe IS NULL
  )
  WITH CHECK (
    vibe IN ('fire', 'more_energy', 'softer')
  );
```

### Research Insights

**Why no session matching in RLS:** The security sentinel, code simplicity reviewer, and architecture strategist all agree — the `x-session-id` header propagation is untested in our setup and is the plan's single biggest risk. Dropping it is the plan's own documented fallback, elevated to the default choice. The three-layer defense (column-level GRANT + `vibe IS NULL` + CHECK constraint) is sufficient.

**Why no active-gig check in vibe UPDATE:** The user flow analyzer found that if the performer closes the gig while an audience member has the overlay open, the vibe UPDATE would silently fail forever with no feedback. Since the INSERT already validated the gig was active, allowing the vibe after closure is correct.

**Migration safety (confirmed by data migration expert):**
- Adding nullable `DEFAULT NULL` columns does NOT trigger a table rewrite (PostgreSQL 11+)
- CHECK triggers a table scan but NULL passes (SQL three-valued logic: `NULL IN (...)` = NULL, not FALSE)
- All 5 statements are DDL, fully transactional — if any fails, everything rolls back
- REVOKE is idempotent (no-op if privilege doesn't exist)
- Column must exist before GRANT references it — proposed ordering is correct

### Update schema.sql reference

Add the new columns, constraint, GRANT/REVOKE, and RLS policy to `supabase/schema.sql` so it stays in sync as the canonical schema reference.

### Verify

After migration, run these checks:

```sql
-- Verify anon cannot update played_at
SET ROLE anon;
UPDATE song_requests SET played_at = now() WHERE id = 'some-id';
-- Expected: permission denied

-- Verify anon can update vibe (if vibe IS NULL)
UPDATE song_requests SET vibe = 'fire' WHERE id = 'some-id';
-- Expected: success (or 0 rows if vibe already set)

RESET ROLE;
```

- `supabase db reset` applies cleanly
- Existing rows get `played_at = NULL`, `vibe = NULL`

**Commit ~30 lines: migration + schema.sql update**

---

## Step 2: TypeScript Types — Regenerate + Vibe Alias

**Files:** `lib/supabase/database.types.ts`, `lib/supabase/types.ts`

### Regenerate database types

```bash
npx supabase gen types typescript --local > lib/supabase/database.types.ts
```

This adds `played_at: string | null` and `vibe: string | null` to the `song_requests` table types.

### Add Vibe constant + narrowed SongRequest type

The CHECK constraint generates `string | null`, not a union. Add to `lib/supabase/types.ts`:

```ts
// Single source of truth for vibe values — also enforced by DB CHECK constraint
// SYNC: if you add a 4th vibe, also update the CHECK constraint and RLS WITH CHECK
export const VIBE_VALUES = ['fire', 'more_energy', 'softer'] as const;
export type Vibe = (typeof VIBE_VALUES)[number];

// Narrowed SongRequest type — overrides vibe from string to Vibe union
export type SongRequest = Omit<
  Database["public"]["Tables"]["song_requests"]["Row"],
  "vibe"
> & { vibe: Vibe | null };
```

### Research Insights

**Why `VIBE_VALUES` constant array (data integrity guardian):** Three places must stay in sync (DB CHECK, RLS WITH CHECK, TypeScript type). The constant array gives the UI a single source to map over for buttons, reducing sync points from 3 to 2 (DB + TS).

**Why `Omit + &` pattern (TypeScript reviewer):** The generated type has `vibe: string | null`. Using `Omit` to override it to `Vibe | null` gives compile-time safety everywhere downstream. Without it, you'd need `as Vibe` casts scattered throughout the UI.

### Verify

- TypeScript compiles with no errors
- `SongRequest` type includes `played_at` and `vibe: Vibe | null`

**Commit: regenerate types + add Vibe alias**

---

## Step 3: Dismiss API — DELETE to UPDATE + Undo Endpoint

**Files:** `app/api/gig/dismiss/route.ts`, new `app/api/gig/undo-dismiss/route.ts`

### Change dismiss from DELETE to UPDATE

Current code (`dismiss/route.ts:23-27`):
```ts
// BEFORE: deletes rows permanently
const { error } = await supabase
  .from("song_requests")
  .delete()
  .eq("gig_id", gigId)
  .eq("song_id", songId);
```

New code:
```ts
// AFTER: soft-dismiss — sets played_at timestamp
const { error } = await supabase
  .from("song_requests")
  .update({ played_at: new Date().toISOString() })
  .eq("gig_id", gigId)
  .eq("song_id", songId)
  .is("played_at", null);  // only update pending rows
```

The `.is("played_at", null)` guard prevents double-marking. The guard is atomic within the UPDATE statement (no read-before-write race).

### Add undo endpoint

Create `app/api/gig/undo-dismiss/route.ts` — near copy-paste of dismiss route, same auth pattern (service role + `isAuthenticated()` check):

```ts
// Undo: clear played_at to restore to pending
const { error } = await supabase
  .from("song_requests")
  .update({ played_at: null })
  .eq("gig_id", gigId)
  .eq("song_id", songId)
  .not("played_at", "is", null);  // only undo already-played rows
```

### Research Insights

**Two routes vs one toggle (architecture strategist):** Two separate routes are better for idempotency. A toggle route would need read-before-write, introducing a race condition. Each operation has its own guard (`.is("played_at", null)` / `.not(...)`), making both safe against double-taps.

**UUID validation (security sentinel, P3):** Add a UUID format check to both routes as a best practice:
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(gigId) || !UUID_RE.test(songId)) {
  return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
}
```

**JS timestamp vs DB timestamp (data integrity guardian):** Using `new Date().toISOString()` is acceptable for the March 6 deadline. The clock skew between server and DB is typically <100ms on Vercel + Supabase. Long-term, an RPC function with `now()` would be cleaner.

### Verify

- POST `/api/gig/dismiss` sets `played_at` on matching rows
- POST `/api/gig/undo-dismiss` clears `played_at` on matching rows
- Neither endpoint deletes data

**Commit ~40 lines: dismiss API DELETE → UPDATE + undo endpoint**

---

## Step 4: Dashboard UI — Pending vs Played Sections

**Files:** `components/request-queue.tsx`

### Update SongRequestRow interface

Add `played_at` to the local interface:

```ts
interface SongRequestRow {
  id: string;
  song_id: string;
  created_at: string;
  played_at: string | null;  // NEW
  songs: { id: string; title: string; artist: string | null } | null;
}
```

> Note: This is a local interface for joined query results (not raw table rows). The `songs` field comes from the Supabase join and isn't in generated types. Try removing the `as SongRequestRow[]` cast after updating — let the compiler tell you if the shapes match.

### Update fetchRequests query

Add `played_at` to the select:

```ts
.select("id, song_id, created_at, played_at, songs(id, title, artist)")
```

### Update Realtime INSERT handler

The handler constructs `SongRequestRow` objects manually. Add `played_at: null` to the constructed object (new INSERTs are always pending):

```ts
// Inside the INSERT callback, where the new SongRequestRow is constructed:
{
  id: newReq.id,
  song_id: newReq.song_id,
  created_at: newReq.created_at,
  played_at: null,  // NEW — required by updated interface
  songs: song,
}
```

### Split into Pending and Played

Replace the single `grouped` list with two. Extract grouping as pure functions above the component (follows existing pattern):

```ts
const pendingRequests = useMemo(
  () => requests.filter((r) => r.played_at === null),
  [requests]
);
const playedRequests = useMemo(
  () => requests.filter((r) => r.played_at !== null),
  [requests]
);
const pendingGrouped = useMemo(() => groupRequests(pendingRequests), [pendingRequests]);
const playedGrouped = useMemo(() => groupRequests(playedRequests), [playedRequests]);
```

### Played section (always visible, not collapsible)

> Simplification from research: The code simplicity reviewer recommended making the played section always visible instead of collapsible. The performer wants to see at a glance what they've played. No toggle state, no extra button. Played cards are below the fold — the performer scrolls past them naturally.

Render two sections:
1. **Pending** — current card style, "Mark Played" button (amber) replaces "Done" button
2. **Played** — muted/grayed cards below pending, "Undo" button (muted green with checkmark)

### Design Decision: `count_session_requests` and the 5-request limit

The `count_session_requests` function counts ALL rows including played ones. After soft-delete, a session's played songs still count toward the 5-request limit. **This is intentional** — it prevents one audience member from dominating the queue by requesting 5 songs, having them all played, then requesting 5 more. For a live gig, 5 total requests per session per gig is already generous.

### Verify

- Pending section shows unplayed requests sorted by count
- Played section shows played requests muted, below pending
- "Mark Played" moves song to Played section
- "Undo" on a played song moves it back to Pending

**Commit ~70 lines: dashboard Pending/Played sections + Mark Played button**

---

## Step 5: Optimistic UI with Rollback + Toast

**Files:** `components/request-queue.tsx`

### The `dismissingIds` coordination ref

This ref coordinates three concurrent systems: optimistic updates, Realtime subscription, and `fetchRequests`. Without it, any of these can conflict:

```ts
const dismissingIds = useRef(new Set<string>());
```

### Corrected dismiss pattern — save removed items, not entire array

> **Critical fix from research:** The original plan saved the entire `requests` array as a snapshot. The frontend race conditions reviewer found this is a **data-loss bug**: if a Realtime INSERT arrives between the snapshot and rollback, the rollback overwrites the new INSERT. Fix: capture only the removed items and re-insert them on failure.

```ts
async function handleDismiss(songId: string) {
  if (dismissingIds.current.has(songId)) return; // double-tap guard
  dismissingIds.current.add(songId);
  hapticDismiss();

  // Capture ONLY the items being dismissed (not the whole array)
  const removedItems = requests.filter((r) => r.song_id === songId);

  // Optimistic: set played_at locally
  setRequests((prev) =>
    prev.map((r) =>
      r.song_id === songId ? { ...r, played_at: new Date().toISOString() } : r
    )
  );

  try {
    const res = await fetch("/api/gig/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gigId: gig.id, songId }),
    });
    if (!res.ok) {
      // Rollback: restore ONLY the removed items into current state
      setRequests((prev) =>
        prev.map((r) =>
          removedItems.some((ri) => ri.id === r.id)
            ? { ...r, played_at: null }
            : r
        )
      );
      showToast("Could not mark as played — restored");
    }
  } catch {
    setRequests((prev) =>
      prev.map((r) =>
        removedItems.some((ri) => ri.id === r.id)
          ? { ...r, played_at: null }
          : r
      )
    );
    showToast("Connection lost — restored");
  } finally {
    dismissingIds.current.delete(songId);
  }
}
```

### Same pattern for undo

```ts
async function handleUndoDismiss(songId: string) {
  if (dismissingIds.current.has(songId)) return;
  dismissingIds.current.add(songId);

  const undoneItems = requests.filter((r) => r.song_id === songId);

  setRequests((prev) =>
    prev.map((r) =>
      r.song_id === songId ? { ...r, played_at: null } : r
    )
  );

  try {
    const res = await fetch("/api/gig/undo-dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gigId: gig.id, songId }),
    });
    if (!res.ok) {
      setRequests((prev) =>
        prev.map((r) =>
          undoneItems.some((ui) => ui.id === r.id)
            ? { ...r, played_at: undoneItems.find((ui) => ui.id === r.id)!.played_at }
            : r
        )
      );
      showToast("Could not undo — restored");
    }
  } catch {
    setRequests((prev) =>
      prev.map((r) =>
        undoneItems.some((ui) => ui.id === r.id)
          ? { ...r, played_at: undoneItems.find((ui) => ui.id === r.id)!.played_at }
          : r
      )
    );
    showToast("Connection lost — restored");
  } finally {
    dismissingIds.current.delete(songId);
  }
}
```

### Guard Realtime handler and fetchRequests against in-flight dismissals

In the Realtime INSERT callback, add at the top:
```ts
if (dismissingIds.current.has(newReq.song_id)) return;
```

In `fetchRequests`, filter out in-flight items:
```ts
if (data) {
  const filtered = dismissingIds.current.size > 0
    ? (data as SongRequestRow[]).filter(
        (r) => !dismissingIds.current.has(r.song_id)
      )
    : (data as SongRequestRow[]);
  setRequests(filtered);
  seenIds.current = new Set(data.map((r) => r.id));
}
```

### Toast with timer cleanup

```ts
const [toast, setToast] = useState<string | null>(null);
const toastTimer = useRef<ReturnType<typeof setTimeout>>();

function showToast(message: string) {
  clearTimeout(toastTimer.current);
  setToast(message);
  toastTimer.current = setTimeout(() => setToast(null), 3000);
}

// In cleanup effect:
useEffect(() => {
  return () => clearTimeout(toastTimer.current);
}, []);
```

Render as a fixed-bottom toast bar with `animate-fade-up` / `animate-fade-out`.

### Research Insights

**Why not `useOptimistic` (optimistic UI researcher):** `useOptimistic` ties its lifecycle to a single Action transition. Our `requests` state has two concurrent writers (performer actions + Realtime subscription). `useOptimistic` would interpret Realtime events as "reverts," causing flicker.

**Why `dismissingIds` ref (race conditions reviewer + optimistic UI researcher):** Three race conditions are solved by one ref:
1. Realtime INSERT for a song being dismissed → ignored
2. `fetchRequests` returning items being dismissed → filtered out
3. Double-tap on Mark Played → early return

**Toast recommendation (optimistic UI researcher):** Sonner is the popular zero-config option, but a local state toast is simpler for one component. If toast needs expand to other components later, install Sonner then.

### Verify

- Mark Played: instant move to Played section, rolls back on API error
- Undo: instant move to Pending section, rolls back on API error
- New Realtime INSERT during in-flight dismiss is NOT lost
- Toast appears for 3 seconds on error, resets timer on rapid errors

**Commit: optimistic dismiss/undo with rollback + error toast**

---

## Step 6: Audience Vibe Feedback — Insert Returns ID + Overlay Buttons

**Files:** `components/song-card.tsx`, `components/song-list.tsx`, `components/confirmation-overlay.tsx`

> **Eliminated from original plan:** Step 6c (Supabase client header config) is no longer needed — the simplified RLS policy has no session matching.

### 6a. Song card returns request ID via separate callback

In `song-card.tsx`, change the insert to return the row ID:

```ts
// BEFORE
const { error } = await supabase.current.from("song_requests").insert({...});

// AFTER
const { data, error } = await supabase.current
  .from("song_requests")
  .insert({ gig_id: gigId, song_id: song.id, session_id: sessionId })
  .select("id")
  .single();
```

This uses PostgreSQL's RETURNING clause (one atomic operation, confirmed by framework-docs researcher). The existing SELECT RLS policy already covers this — no new policy needed.

**Use a separate `onRequestCreated` callback** (pattern recognition specialist recommendation — follows one-concern-per-callback convention):

```ts
// SongCardProps additions
onRequestCreated?: (requestId: string) => void;  // NEW, optional

// In handleRequest success path
if (!error && data) {
  onStateChange(song.id, { status: "sent" });
  hapticSuccess();
  onSuccess(song);  // unchanged
  onRequestCreated?.(data.id);  // NEW
  fetchCountInBackground();
}
```

**Handle the 23505 duplicate path** (TypeScript reviewer critical finding):

```ts
// Duplicate constraint — already requested, treat as success
if (error.code === "23505") {
  onStateChange(song.id, { status: "sent" });
  hapticSuccess();
  onSuccess(song);
  // No onRequestCreated call — we don't have the row ID
  // Vibe buttons will be hidden on the overlay (requestId is undefined)
  fetchCountInBackground();
}
```

### 6b. Song list tracks request ID

In `song-list.tsx`, store the request ID alongside the overlay song:

```ts
const [overlayRequestId, setOverlayRequestId] = useState<string | null>(null);

const handleRequestCreated = useCallback((requestId: string) => {
  setOverlayRequestId(requestId);
}, []);

// Reset on dismiss
const handleOverlayDismiss = useCallback(() => {
  setOverlaySong(null);
  setOverlayRequestId(null);
}, []);
```

Pass `requestId={overlayRequestId}` to `ConfirmationOverlay`.

### 6c. Confirmation overlay — vibe buttons

Add three vibe buttons below the existing action buttons (Share / Done) on `confirmation-overlay.tsx`. **Only show when `requestId` is defined** (handles the 23505 duplicate case where no ID is available):

New props:

```ts
interface ConfirmationOverlayProps {
  song: Song;
  venueName: string;
  requestCount: number | null;
  requestId: string | null;  // NEW — needed for vibe UPDATE
  onDismiss: () => void;
}
```

Vibe section (only renders when requestId exists):

```tsx
{requestId && (
  <div className="...">
    <p className="...">How's the vibe?</p>
    <div className="flex gap-3">
      {VIBE_VALUES.map((v) => (
        <button
          key={v}
          onClick={() => handleVibe(v)}
          disabled={vibeSent}
          aria-label={VIBE_LABELS[v]}
          className="..."
        >
          {VIBE_EMOJI[v]} {VIBE_LABELS[v]}
        </button>
      ))}
    </div>
  </div>
)}
```

Map over `VIBE_VALUES` (from `lib/supabase/types.ts`) — single source of truth for the button list.

Vibe handler — fire-and-forget pattern (from learnings: Phase C overlay non-blocking fetch):

```ts
function handleVibe(vibe: Vibe) {
  if (!requestId || vibeSent) return;
  setVibeSent(true);

  // Fire and forget — overlay can close safely
  supabase.current
    .from("song_requests")
    .update({ vibe })
    .eq("id", requestId)
    .then(({ error }) => {
      if (error && isMounted.current) {
        setVibeSent(false); // allow retry
      }
    });
}
```

The UPDATE goes through the anon client → Postgres checks column-level GRANT (only `vibe` allowed) → RLS checks row (`vibe IS NULL`) → CHECK constraint validates the value.

### UI states

- `requestId` is null (23505 duplicate): vibe section hidden entirely
- Before selection: three buttons, full opacity
- After selection: selected button highlighted, others faded, non-interactive
- On error: reset to allow retry, brief shake animation on buttons (from learnings: Phase B animation patterns)

### Research Insights

**`.insert().select('id').single()` confirmed atomic (framework-docs researcher):** One HTTP request, one SQL statement with `RETURNING`. The `data` type is `{ id: string } | null`. If the INSERT succeeds but SELECT policy filters out the row, you get a `PGRST116` error — but this cannot happen in our schema (INSERT policy is stricter than SELECT policy).

**Accessibility (user flow analyzer):** Add `aria-label` to vibe buttons since screen readers can't read emojis as meaningful text.

### Verify

- Tap song → insert returns ID → overlay shows with vibe buttons
- Tap a vibe → UPDATE succeeds → selected button highlighted
- Tap Done without selecting a vibe → fine (vibe stays NULL)
- Duplicate constraint (23505) → overlay shows but vibe buttons hidden
- User closes overlay before vibe UPDATE completes → fire-and-forget, no crash

**Commit ~60 lines: vibe feedback on confirmation overlay**

---

## Implementation Order

| # | Step | ~Lines | Dependencies |
|---|------|--------|-------------|
| 1 | Migration + security layers | ~30 | None |
| 2 | TypeScript types | ~15 | Step 1 (migration must exist) |
| 3 | Dismiss API: DELETE → UPDATE + undo | ~40 | Step 2 (types) |
| 4 | Dashboard: Pending vs Played | ~70 | Step 3 (API endpoints) |
| 5 | Optimistic UI + rollback + toast + `dismissingIds` | ~50 | Step 4 (dashboard structure) |
| 6 | Vibe feedback: insert ID + overlay buttons | ~60 | Step 2 (types) |

Steps 3-5 are the "Mark as Played" track. Step 6 is the "Vibe Feedback" track. Both tracks depend on Steps 1-2 but are independent of each other after that.

Total: ~265 lines across 6 commits.

---

## What This Plan Does NOT Cover

- Vibe distribution stats on performer dashboard (future cycle)
- Realtime subscription for UPDATE events (not needed for solo performer)
- Multi-device sync for played status
- Analytics / gig history views
- Tests (separate session per CLAUDE.md)
- `count_session_requests` filtering by `played_at IS NULL` (intentionally counts all — see Step 4)
- Partial index `WHERE played_at IS NULL` (not needed at current scale, documented for future)
- RPC function for DB-side `now()` timestamp (acceptable JS timestamp for March 6)

---

## Pre-Deploy Checklist (from learnings: Vercel deployment session)

Before pushing to Vercel:
- [ ] `npm run build && npm run start` locally — catch env var / bundling errors
- [ ] No module-level mutable auth state (already uses JWT cookies)
- [ ] All `NEXT_PUBLIC_*` accessed as static strings (already fixed)
- [ ] All env vars set in Vercel dashboard before deploy
- [ ] Security headers in `next.config.ts`

---

## Review Amendments

Triaged 2026-03-01. 10 accepted, 1 rejected (003 — moot after Option A decision).

### Severity Snapshot
- **P1:** 2 accepted, 1 rejected
- **P2:** 5 accepted
- **P3:** 3 accepted

### Recommended Fix Order

| # | Issue | Priority | Why this order | Unblocks |
|---|-------|----------|---------------|----------|
| 1 | 002 — Simplify Step 5 to fire-and-forget (Option A) | P1 | Root architectural decision — eliminates dismissingIds, rollback, toast coordination. Rejects 003. | 003 (rejected) |
| 2 | 001 — Gig-ownership check on service-role routes | P1 | Must land before Step 3 route edits begin | 004 |
| 3 | 004 — UUID validation on service-role routes | P2 | Bundle with 001 — same files, same edit pass | — |
| 4 | 010 — Reduce console.error verbosity | P3 | Bundle with 001/004 — same files, same edit pass | — |
| 5 | 005 — GRANT/REVOKE SQL comments | P2 | During Step 1 migration | — |
| 6 | 009 — Rollback SQL documentation | P3 | During Step 1 migration | — |
| 7 | 007 — Realtime payload cast to SongRequest type | P2 | During Step 4 implementation | — |
| 8 | 011 — Try removing SongRequestRow cast | P3 | During Step 4 implementation | — |
| 9 | 008 — Stats bar: "X pending / Y played" | P2 | During Step 4 implementation | — |
| 10 | 006 — Document vibe silent-loss limitation | P2 | During Step 6 implementation | — |

### How Each Step Changes

**Step 1 (Migration):**
- Add GRANT/REVOKE warning comments in migration and schema.sql (005)
- Add rollback SQL as comments at bottom of migration file (009)

**Step 3 (Dismiss API):**
- Add active-gig ownership check before mutations in dismiss, undo-dismiss, and toggle routes (001)
- Add shared `isUUID()` utility in `lib/validation.ts`, apply to all service-role routes (004)
- Log only `error.code` and `error.message`, not full error object (010)

**Step 4 (Dashboard UI):**
- Update Realtime payload cast from inline type to canonical `SongRequest` import (007)
- Try removing `as SongRequestRow[]` cast after updating interface — keep if compiler fails (011)
- Stats bar shows "X pending / Y played" instead of single total count (008)

**Step 5 (Optimistic UI) — MAJOR SIMPLIFICATION (002, Option A):**
- **Drop entirely:** `dismissingIds` ref, snapshot-and-rollback, `fetchRequests` filtering, Realtime INSERT guard, toast state/timer
- **Keep:** Fire-and-forget pattern (optimistic remove from state, fire API, re-query self-heals on failure)
- **Add only:** Double-tap guard via `useRef<Set>` with `.has()` check
- **Net effect:** Step 5 shrinks from ~80 lines to ~15 lines. The "Least confident" area from Feed-Forward is eliminated.

**Step 6 (Vibe Feedback):**
- Add code comment in vibe handler documenting silent-loss path when overlay unmounts (006)

### Rejected

| Issue | Why |
|-------|-----|
| 003 — Non-null assertion fix in undo rollback | Moot: Option A (002) has no rollback code, so no `!` assertion exists |

---

## Feed-Forward

- **Hardest decision:** Whether to keep the `x-session-id` session matching in the RLS policy. All 14 review agents converged on dropping it — it's the single riskiest untested element, and the three-layer defense (GRANT + `vibe IS NULL` + CHECK) is sufficient without it. The blast radius of "someone sets a vibe on another person's request" is negligible for a live music app.
- **Rejected alternatives:** `useOptimistic` for rollback (fights realtime subscription), enum type for vibe (transaction footgun on future changes), matching on unique constraint for vibe UPDATE (two network calls vs one with RETURNING), API route for vibe UPDATE (unnecessary serverless overhead), whole-array snapshot for rollback (drops concurrent Realtime INSERTs), overloading `onSuccess` with requestId (violates one-concern-per-callback pattern).
- **Least confident:** The optimistic UI coordination between `dismissingIds`, Realtime subscription, and `fetchRequests`. The pattern is well-researched (two independent agents arrived at the same solution), but it hasn't been tested in a live gig with real audience concurrency. If it causes UI jank, the simplest fallback is removing the `dismissingIds` guard from `fetchRequests` and accepting that songs may briefly reappear during refetch.
