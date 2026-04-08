---
title: "Audit Remediation — RLS Enforcement, Atomic RPC, ISR Restoration"
category: security-and-reliability
tags: [rls, supabase, rpc, race-conditions, isr, next-js, cas-pattern, performance, anon-client]
module: Full Stack
symptom: "6-agent code review found 25 issues (3 P1, 10 P2, 12 P3) across security, data integrity, performance, architecture, patterns, and simplicity"
root_cause: "Vibe endpoint bypassed RLS via service client; log-song had TOCTOU race on set_position; guest page ISR defeated by cookies() call"
---

# Audit Remediation — RLS Enforcement, Atomic RPC, ISR Restoration

## Problem

A comprehensive 6-agent codebase audit (security, performance, architecture, patterns, data integrity, simplicity) found 25 issues. 12 were scoped for this cycle (3 P1, 4 P2, 5 P3), 13 deferred.

The three P1 findings:
1. **set_position race condition** — `log-song` route did READ then INSERT with no atomicity. Two rapid taps could produce duplicate positions, corrupting setlist ordering.
2. **Vibe endpoint bypassed RLS** — Used `createServiceClient()` (service role key, bypasses all RLS) for a guest-facing endpoint. The RLS policy enforcing `vibe IS NULL` was completely inert. Anyone could overwrite vibes unlimited times.
3. **COOKIE_SECRET exposure risk** — Real `.env` secret on disk needed verification that it never entered git history.

## Solution

12 fixes applied across 7 commits (14 files, +219/-110 lines), grouped by dependency chain.

### Step 0: New `createAnonClient()` helper

Added a third Supabase client factory to `lib/supabase/server.ts`. Uses anon key without cookies — respects RLS, doesn't defeat ISR. Two call sites: vibe endpoint (RLS enforcement) and guest page (ISR restoration).

**Three-client pattern now established:**
| Client | Key | Cookies | RLS | Use for |
|--------|-----|---------|-----|---------|
| `createServiceClient()` | Service role | No | Bypassed | Performer API routes |
| `createClient()` | Anon + SSR | Yes | Enforced | Auth-aware server components |
| `createAnonClient()` | Anon raw | No | Enforced | Guest routes, ISR pages |

### P1 Fixes

**Fix #1: Atomic set_position via RPC** — Created `insert_song_log` Postgres function that verifies session is live + computes next position + inserts in a single SQL statement. Added `UNIQUE(session_id, set_position)` constraint as race condition insurance. Route retries once on error code 23505 (unique violation). Replaces the old non-unique index.

Key learning: the RPC returns NULL (not an error) when the WHERE clause filters out all rows (session not live). The route must check for null explicitly — this is a different code path than a DB error.

**Fix #2: Vibe endpoint RLS enforcement** — Swapped `createServiceClient()` to `createAnonClient()`. The existing RLS policy (`vibe IS NULL` check, column-level `GRANT UPDATE (vibe)` only, `WITH CHECK` on values) already enforced everything needed. Added CAS-style `.select("id").single()` to distinguish "RLS blocked it" (PGRST116 → 409) from real DB errors (→ 500).

**Fix #3: Secret verification** — `git log --all -p -- .env` returned empty. Secret was never committed. Documented as verified.

### P2 Fixes

**Fix #4: N+1 query elimination** — RequestQueue's Realtime INSERT handler queried the songs table for every incoming request. Replaced with in-memory `songs.find()` using a prop passed from the dashboard. At 50-100 songs, linear scan is microseconds — no Map needed.

**Fix #5: Toggle route round-trip reduction** — Combined separate gig verification SELECT with the UPDATE mutation: `.update({...}).eq("is_active", true).select("id").single()`. One round trip instead of two.

**Fix #6: Submit-debrief CAS guard** — Added `.eq("status", "post_set")` to the UPDATE, matching go-live/end-set pattern. Removed redundant separate SELECT. Self-review caught that PostgREST returns PGRST116 (not null data) when zero rows match — fixed to handle explicitly.

**Fix #7: Guest page ISR restoration** — Swapped `createClient()` (calls `cookies()`, defeats ISR) to `createAnonClient()`. Next.js 16 docs confirmed: only `cookies()`, `headers()`, `searchParams`, `connection`, `draftMode` opt out of Full Route Cache. `params` as a Promise does NOT.

Also removed `JSON.parse(JSON.stringify())` on postSetData (Fix #10 — was a type cast workaround, replaced with explicit `as Json`).

### P3 Quick Wins

- Fixed `VibeType` → `Vibe` in CLAUDE.md (with correct values)
- Removed dead `EnergyLevel`/`RepertoireType` types (YAGNI)
- Added `useMemo` to SongLogFab `loggedSongIds` set creation
- Wrapped `audienceUrl` in `useMemo` with SSR guard

### Convention Added

Added RPC convention to CLAUDE.md: "Use Postgres RPCs only when atomicity requires it. All RPCs must be typed in `database.types.ts` and created via migrations."

## Risk Resolution

| Flagged Risk | What Happened | Lesson |
|-------------|---------------|--------|
| ISR may not restore after removing cookies() | **Resolved pre-implementation** — Next.js 16.1.6 docs confirmed `params` Promise does NOT opt out. `force-static` available as fallback. | Research framework docs before implementing — the risk was lower than assessed. |
| RPC null return when session not live | **Caught in self-review** — submit-debrief had same pattern bug (PGRST116 vs null). Fixed in both routes. | PostgREST `.single()` returns PGRST116 error on zero rows, not null data. Every CAS pattern must handle PGRST116 explicitly. |
| set_position race within the RPC itself | **Mitigated by UNIQUE constraint** — security review found MAX+1 inside a single SQL statement still races under concurrent calls. The constraint + retry is cheap insurance. | Even "atomic" SQL statements race on computed values. UNIQUE constraints are the real serialization mechanism. |

## Top Patterns (new or reinforced)

| # | Pattern | Status |
|---|---------|--------|
| 1 | **Three-client Supabase pattern** — service (admin), cookie-anon (auth-aware), plain-anon (guest/ISR) | NEW |
| 2 | **CAS with PGRST116 handling** — `.update().eq(guard).select("id").single()`, check PGRST116 for "no match" | NEW |
| 3 | **RLS as enforcement, not just filtering** — anon client for guest endpoints lets RLS do the security work | REINFORCED (from diagnostic fix cycle) |
| 4 | **In-memory lookup over N+1** — pass data as props, use `.find()` at small scale | NEW |
| 5 | **UNIQUE constraints as race insurance** — even with atomic RPCs, the constraint is the true serialization | NEW |

## Prevention

- Before using `createServiceClient()` on a new route, ask: "Is this performer-only?" If guest-facing, use `createAnonClient()` and let RLS enforce.
- Every `.single()` call after an UPDATE must handle PGRST116 explicitly. Copy the toggle/vibe/debrief pattern.
- When adding computed columns (counters, positions), add a UNIQUE constraint alongside the insert logic.
- When a Server Component only reads public data, use `createAnonClient()` to avoid defeating ISR.

## Feed-Forward

- **Hardest decision:** Folding the session-status check into the RPC rather than leaving it as a separate query. SpecFlow analysis identified the remaining TOCTOU gap, and the atomic approach closes it completely.
- **Rejected alternatives:** UNIQUE constraint + retry without RPC (messy conflict handling), shared `verifyActiveGig()` helper for 3 routes (marginal DRY gain for 15-route app), soft-delete for undo-log (reclassified as correct behavior for performer undo).
- **Least confident:** Migration rollout ordering. The RPC migration must be applied AFTER the code deploys (Vercel auto-deploys from push to main). If migration runs first, the old route code still works (manual queries). If code deploys first but migration hasn't run, the `.rpc()` call fails. Deploy code → apply migration → verify.
