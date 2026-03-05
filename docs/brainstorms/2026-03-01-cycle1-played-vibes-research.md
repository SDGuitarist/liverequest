---
title: "Cycle 1 — Played + Vibes — Parallel Research Findings"
date: 2026-03-01
status: complete
parent: "docs/brainstorms/2026-03-01-cycle1-played-vibes.md"
---

# Cycle 1 — Played + Vibes — Research Findings

Four parallel research agents investigated the open questions and implementation areas from the brainstorm. This document summarizes findings, concrete SQL/code, and flags anything that challenges the brainstorm decisions.

---

## Agent 1: Supabase RLS UPDATE Policy Scoping

### Key Finding: RLS Cannot Restrict Columns — Use GRANT/REVOKE

**RLS only restricts ROWS, not COLUMNS.** The `USING` and `WITH CHECK` clauses have no mechanism to say "only column X may be changed." Without column-level protection, a malicious caller could sneak `played_at = now()` or `session_id = 'other'` into the same UPDATE call.

The correct Postgres primitive is **column-level GRANT/REVOKE**:

```sql
-- Revoke all UPDATE privilege for anon
REVOKE UPDATE ON song_requests FROM anon;

-- Grant UPDATE only on the vibe column
GRANT UPDATE (vibe) ON song_requests TO anon;
```

After this, if `anon` tries to update ANY other column, Postgres returns `permission denied` at the privilege layer (before RLS even runs). No trigger hacks needed.

### RLS Policy for Row Scoping

Column-level GRANT handles *which columns*. RLS handles *which rows*:

```sql
CREATE POLICY "Anon can set vibe on own requests"
  ON song_requests
  FOR UPDATE
  TO anon
  USING (
    session_id = (
      current_setting('request.headers', true)::json->>'x-session-id'
    )
    AND vibe IS NULL
    AND gig_id IN (SELECT id FROM gigs WHERE is_active = true)
  )
  WITH CHECK (
    vibe IN ('fire', 'more_energy', 'softer')
  );
```

### Session Matching: Two Options

**Option A: Custom `x-session-id` header (more secure).** Pass `session_id` as a global header on the Supabase client, then read it in RLS via `current_setting('request.headers')`. Prevents one audience member from setting vibes on another's requests.

**Option B: Skip session check in RLS (simpler, acceptable risk).** Since column-level GRANT means anon can *only* change `vibe`, and `vibe IS NULL` means each row can only be set once, the worst a bad actor could do is set a vibe emoji on someone else's request. Blast radius is trivially low.

### Security Layers Summary

| Attack | Blocked by | Layer |
|---|---|---|
| `SET played_at = now()` | `GRANT UPDATE (vibe)` | Privilege |
| `SET session_id = 'other'` | `GRANT UPDATE (vibe)` | Privilege |
| `SET vibe = 'fire'` on someone else's row | RLS `USING` session_id check | RLS |
| `SET vibe = 'evil_value'` | CHECK constraint + RLS `WITH CHECK` | Constraint + RLS |
| `SET vibe` on already-vibed row | RLS `USING vibe IS NULL` | RLS |
| UPDATE on old/inactive gig | RLS `USING gig_id IN (active gigs)` | RLS |

### Impact on Brainstorm

**Confirms the brainstorm decision** (direct client via RLS, not API route). The brainstorm was right that narrow RLS works, but needed the additional insight that **column-level GRANT is required** alongside RLS. This was the "least confident" area flagged in Feed-Forward — now resolved.

---

## Agent 2: INSERT Returning Row ID + Optimistic UI Rollback

### Getting the Row ID: `.insert().select('id').single()`

The official Supabase pattern returns the inserted row via PostgreSQL's `RETURNING` clause (single atomic operation, not two queries):

```ts
const { data, error } = await supabase
  .from("song_requests")
  .insert({ gig_id: gigId, song_id: song.id, session_id: sessionId })
  .select("id")
  .single();

// data: { id: string } | null
if (!error && data) {
  const requestId = data.id; // pass to confirmation overlay for vibe UPDATE
}
```

**RLS consideration:** The `.select()` after `.insert()` uses RETURNING, which is filtered through SELECT policies. Our existing SELECT policy (`gig_id in active gigs`) already covers this — no new policy needed.

**Alternative (match on unique constraint) rejected:** Two network requests, race condition risk, more code for no benefit.

### Optimistic UI: Manual Pattern Over `useOptimistic`

**Recommendation: Use the manual snapshot-and-rollback pattern**, not React 19's `useOptimistic`.

Why skip `useOptimistic`:
- It requires wrapping mutations in `startTransition`, adding complexity
- It fights with the realtime subscription (subscription fires `setRequests`, which `useOptimistic` would interpret as a "revert")
- The manual pattern is 5 lines and trivially clear

```ts
async function handleDismiss(songId: string) {
  hapticDismiss();
  const previousRequests = requests; // snapshot (cheap pointer copy)
  setRequests((prev) => prev.filter((r) => r.song_id !== songId));

  try {
    const res = await fetch("/api/gig/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gigId: gig.id, songId }),
    });
    if (!res.ok) {
      setRequests(previousRequests);
      showToast("Could not dismiss — restored to queue");
    }
  } catch {
    setRequests(previousRequests);
    showToast("Connection lost — restored to queue");
  }
}
```

**Save the entire array** (not just the removed item). It's a reference copy (free), and re-inserting at the right position would be error-prone.

**Toast: local state**, not a context provider. Only needed in `request-queue.tsx` right now:

```ts
const [toast, setToast] = useState<string | null>(null);
function showToast(message: string) {
  setToast(message);
  setTimeout(() => setToast(null), 3000);
}
```

### Impact on Brainstorm

**Resolves open question #4** ("Does the confirmation overlay need to know the request row ID?"). Answer: yes, use `.insert().select('id').single()` — it's one atomic call, no extra policy needed.

**Resolves open question #5** ("Rollback on dismiss error"). The manual pattern is the right approach. `useOptimistic` is not a fit for our realtime subscription architecture.

---

## Agent 3: CHECK Constraint vs. Postgres Enum

### Head-to-Head Comparison

| Factor | CHECK constraint | Postgres enum |
|---|---|---|
| Adding a 4th value later | Easy (DROP + ADD, transactional) | Hard (`ALTER TYPE ADD VALUE` cannot run in a transaction — Supabase migrations run in transactions by default) |
| Removing a value | Easy (same DROP/ADD) | Very hard (create new type, migrate, drop old) |
| TypeScript type generation | `string \| null` (no narrowing) | `'fire' \| 'more_energy' \| 'softer' \| null` (auto union) |
| Beginner migration headaches | Low | High (transaction limitation is a real footgun) |
| NULL handling | NULL passes CHECK automatically | NULL allowed via nullable column |
| Performance | Negligible difference | Negligible difference |

### The Transaction Limitation Is Real

`ALTER TYPE ... ADD VALUE` **cannot run inside a transaction block**. Supabase migrations run inside transactions by default. Adding a 4th vibe value with an enum would require workarounds (run via SQL Editor manually, or create a new type + migrate + drop old). With CHECK, it's two `ALTER TABLE` statements that run cleanly in a migration.

### TypeScript Types

**Enum wins on type generation.** `supabase gen types typescript` produces a real union type for enums but only `string` for CHECK-constrained text columns. With CHECK, you'd need a manual type alias:

```ts
export type Vibe = 'fire' | 'more_energy' | 'softer';
```

### Recommendation: CHECK Constraint (Challenges the Agent's Own Enum Recommendation)

The agent initially recommended enum for type safety, but weighing the factors for our project:

1. **We're a beginner developer** — the enum transaction footgun is a real risk
2. **Values might change** — if we add a 4th vibe for a themed gig, the CHECK migration is trivial
3. **Manual type alias is one line** — `export type Vibe = 'fire' | 'more_energy' | 'softer'` gives the same DX
4. **The brainstorm already chose CHECK** — changing to enum adds risk for marginal benefit

**Stick with the brainstorm decision: CHECK constraint on a text column + manual TypeScript type alias.**

### Impact on Brainstorm

**Confirms open question #3** — CHECK is the right choice. The brainstorm's instinct ("CHECK is simpler and good enough") holds up after research.

---

## Agent 4: Supabase Migration for Adding Nullable Columns

### Migration SQL (Single File)

```sql
-- Migration: add played_at and vibe columns to song_requests

ALTER TABLE song_requests
  ADD COLUMN played_at timestamptz DEFAULT NULL;

ALTER TABLE song_requests
  ADD COLUMN vibe text DEFAULT NULL
  CONSTRAINT valid_vibe CHECK (vibe IN ('fire', 'more_energy', 'softer'));
```

Both columns in one migration (same feature, no ordering dependency). Named constraint (`valid_vibe`) makes future `DROP CONSTRAINT` easier.

### Existing RLS: No Changes Needed

- **INSERT policy** still works — new columns get `DEFAULT NULL` automatically, the `WITH CHECK` clause only validates `gig_id`, `song_id`, and `session_id`
- **SELECT policy** still works — checks `gig_id` only, new columns are readable automatically

### Realtime: No Changes Needed for INSERT

- New columns appear in `payload.new` but are ignored by the current TypeScript destructure
- UPDATE events (for `played_at`/`vibe`) are NOT captured by the INSERT-only subscription — this is fine per the brainstorm decision (no realtime for played status)

### TypeScript Types: Manual Regeneration Required

After migration, must run:

```bash
npx supabase gen types typescript --local > lib/supabase/database.types.ts
# or with project ID for remote:
npx supabase gen types typescript --project-id <ID> > lib/supabase/database.types.ts
```

The `vibe` column will type as `string | null` (CHECK not reflected). Add a manual type alias.

### Existing Rows: Safe, No Table Rewrite

Adding nullable `DEFAULT NULL` columns does NOT trigger a table rewrite (PostgreSQL 11+). The CHECK constraint triggers a table scan (not rewrite) but passes instantly since all existing rows have `vibe = NULL` and `NULL` passes CHECK.

### CLI Command Sequence

```bash
# 1. Create migration file
supabase migration new add_played_at_and_vibe_to_song_requests

# 2. Edit the generated file with the SQL above

# 3. Apply locally (if local Supabase is running)
supabase db reset

# 4. Regenerate types
npx supabase gen types typescript --local > lib/supabase/database.types.ts

# 5. Push to remote
supabase db push

# 6. Regenerate types from remote (confirm parity)
npx supabase gen types typescript --project-id <ID> > lib/supabase/database.types.ts
```

### Impact on Brainstorm

No challenges. The migration is straightforward and all the brainstorm's assumptions hold.

---

## Summary: What Changes or Challenges the Brainstorm?

| Brainstorm Decision | Research Verdict | Change? |
|---|---|---|
| `played_at timestamptz default null` | Confirmed safe, no rewrite | No change |
| `vibe text default null` with CHECK | Confirmed. Enum considered but CHECK wins for migration simplicity | No change |
| Direct client UPDATE via RLS for vibes | Confirmed, but **must add column-level GRANT/REVOKE** alongside RLS | **New requirement** |
| No realtime for played status | Confirmed correct for solo performer | No change |
| Optimistic UI with rollback | Manual pattern recommended, not `useOptimistic` | No change (brainstorm didn't specify) |
| `.insert()` returning row ID | `.insert().select('id').single()` works atomically, no new policy needed | **Resolves open question #4** |

### The One New Requirement

The brainstorm's "least confident" area (vibe UPDATE RLS policy) is now fully resolved. The key insight the brainstorm was missing:

> **RLS restricts rows. GRANT/REVOKE restricts columns. You need both.**

The migration must include:
```sql
REVOKE UPDATE ON song_requests FROM anon;
GRANT UPDATE (vibe) ON song_requests TO anon;
```

This is the security layer that prevents anon from updating `played_at`, `session_id`, or any other column. Without it, the RLS policy alone would allow column tampering on matching rows.
