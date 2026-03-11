# Setlist Management — Brainstorm

**Date:** 2026-03-10
**Status:** Complete
**Next:** Plan phase
**Gig context:** Japanese Friendship Garden, Thursday March 12

---

## What We're Building

A "Setlist" tab on the performer dashboard that lets the performer toggle songs visible/hidden from the guest request list — on the fly, mid-gig. No full CRUD needed; the catalog lives in Supabase and the performer just flips `is_active` per song.

**Why now:** The performer currently must log into the Supabase Dashboard to change the song list. That's not viable mid-gig. Thursday's gig at Japanese Friendship Garden needs this.

## Key Decisions

### 1. Location: Tab on existing dashboard
- New "Setlist" tab alongside the existing request queue
- Same page, same auth, no navigation away from the live view
- Keeps the performer in one place during a gig

### 2. Scope: Toggle visibility only
- Show/hide songs from the guest-facing list (`is_active` boolean)
- Full catalog stays in DB — nothing is deleted
- Simplest possible mid-gig interaction: one tap per song
- Adding new songs or editing metadata is out of scope for this cycle

### 3. GigPrep upgrade path: API endpoint on LiveRequest
- Future `POST /api/songs/sync` accepts a song list from GigPrep
- Auth via `X-API-Key` header (matches Layer 1 pattern from Lead Responder ↔ PF-Intel)
- GigPrep pushes, LiveRequest receives — clean separation
- **For now:** We only build the dashboard toggle UI + the API route it calls (`POST /api/songs/toggle`)
- **Later (Layer 4):** Add `/api/songs/sync` that bulk-upserts and toggles. The toggle route we build now becomes a building block.

## What We're NOT Building

- No song creation/editing UI (use Supabase Dashboard or GigPrep for that)
- No drag-to-reorder (sort_order exists in schema but not exposed yet)
- No GigPrep integration yet (just the upgrade path)
- No multi-performer/slug scoping (songs remain global)
- No realtime subscription on songs tab (manual refresh or refetch on tab switch is fine)

## Technical Context

- **Songs table:** `id (uuid), title, artist, sort_order, is_active, created_at`
- **RLS:** Only anon SELECT on active songs. All mutations use service role key.
- **API pattern:** `isAuthenticated()` check → `createServiceClient()` → mutation → `{ success: true }`
- **Guest page ISR:** 60-second revalidation. Toggle takes up to 60s to appear for guests (acceptable).
- **Dashboard component:** `request-queue.tsx` is ~557 lines. The setlist tab should be a separate component (`setlist-manager.tsx`) rendered conditionally by tab state.

## GigPrep Song Model (for future compatibility)

GigPrep stores: `id, title, artist, genre, mood, energy, readiness, key, bpm, notes, arrangements`. LiveRequest only needs `title` and `artist` for now. The sync endpoint should accept optional fields and ignore what it doesn't use yet.

## Open Questions

None — scope is tight and decisions are locked.

## Feed-Forward

- **Hardest decision:** Keeping scope to toggle-only. Adding new songs on the fly is tempting but adds form UI, validation, and edge cases that aren't needed for Thursday.
- **Rejected alternatives:** Separate `/performer/songs` page (requires navigation away from live dashboard), slide-out panel (more complex UI for same result), full CRUD (scope creep).
- **Least confident:** Whether 60-second ISR delay on guest page after toggling a song will feel too slow. May need `revalidatePath()` call from the API route if it bothers the performer. Verify this during the gig.
