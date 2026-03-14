# Brainstorm: Cycle 2 — Musician Intelligence

**Date:** 2026-03-13
**Feature:** Pre-set, between-song, and post-set logging for the performer dashboard
**Origin:** Product Bible Stream 2 (Musician Intelligence)
**Status:** Brainstorm complete

## What We're Building

Three logging windows that capture what the performer knows about the room — data that guest requests alone can't provide. This is the foundation for Cycle 3's "Gift" (post-service summary).

### Pre-Set Logging (1-2 minutes)
The dashboard transforms into a setup form before the performer taps "Go Live":
- Confirm/edit venue (from venues table)
- Create performance session (set number, configuration, genre/style)
- Load setlist (songs arrive pre-tagged from GigPrep sync; allow per-gig overrides)
- Date/time auto-populated

### Between-Song Logging (5-7 seconds — NON-NEGOTIABLE)
A floating action button (FAB) on the dashboard opens a bottom sheet:
- Tap which song you just played (from setlist)
- Song quality: Off / Fine / Locked In
- Volume calibration: Too Loud / Right / Too Soft
- Guest acknowledgment: Yes / No

**Constraint:** The 5-7 second ceiling is sacred. If real-world testing shows it takes longer, reduce inputs rather than expand time.

### Post-Set Logging (2-3 minutes)
After tapping "End Set," the dashboard transforms into a debrief form:
- Setlist deviations from plan (what changed and why)
- Walkup count (guests who physically approached)
- Tips received: Yes / No (not amount)
- Manager/staff feedback (free text)
- Overall set feel: Off Night / Fine / Felt It
- Complaints received: Yes / No
- Free-form observations

## Why This Approach

### Dashboard State-Driven UI
The dashboard adapts to the gig lifecycle phase — no separate pages, no navigation overhead:
- **Pre-set phase:** Dashboard shows setup form → tap "Go Live"
- **Live phase:** Normal dashboard (Requests + Setlist tabs) + FAB for between-song logging
- **Post-set phase:** Dashboard shows debrief form → tap "Submit"

**Why not a Log tab?** A third tab adds 2 navigation taps to every between-song log. On a 5-7 second budget, that's 30-40% wasted on navigation.

**Why not separate pages?** Breaks the "one place for everything" mental model. If you forget to visit `/pre-set`, there's no prompt.

### Floating Action Button + Bottom Sheet
The FAB is always visible during the live phase, regardless of which tab you're on. One tap opens the bottom sheet with the song picker + 3 inputs. This eliminates tab-switching overhead entirely.

### Song Identification via Setlist Tap
The between-song bottom sheet shows the setlist — tap the song you just finished, then log the 3 quick inputs. Explicit, works even when you improvise or reorder.

**Why not auto-advance?** Live performers take requests and reorder constantly. Auto-advance assumes rigidity that doesn't match the real workflow. "Wrong song" corrections would eat the time budget.

**Why not skip song linking?** Per-song data is what makes Cycle 3 summaries rich ("Bésame Mucho got 4 requests AND the performer rated it Locked In"). Session-level averages lose this intelligence.

### Song Tags: Columns on LiveRequest, Synced from GigPrep
Add `energy_level` and `repertoire_type` columns to the `songs` table. GigPrep sync populates them. Pre-set form shows/edits them. No hard dependency — tags are optional enrichment. Songs work fine without tags.

**Why not tag in LiveRequest?** GigPrep is the catalog app. Energy level and repertoire type are catalog-level properties (a bolero is always a bolero). LiveRequest handles live performance, not song knowledge.

### New Data Model: performance_sessions + song_logs

**`venues` table (new):**
- id, name, address, notes, default_configuration, default_genre_style
- Supports presets and history for repeat venues

**`performance_sessions` table (new):**
- id, gig_id (FK), set_number, configuration, genre_style, status (pre_set/live/post_set/complete)
- pre_set_data (jsonb), post_set_data (jsonb)
- started_at, ended_at

**`song_logs` table (new):**
- id, session_id (FK), song_id (FK), song_quality, volume_calibration, guest_acknowledgment
- logged_at, set_position (order played)

**Why a separate `performance_sessions` table instead of columns on `gigs`?** Multi-set gigs (e.g., cocktail hour + dinner set at a hotel) need separate logging contexts with different configurations and observations. One session per gig for 90% of cases; the extra table costs nothing but prevents a painful migration later.

**`songs` table additions:**
- energy_level (text, nullable): ambient / medium / high
- repertoire_type (text, nullable): instrumental / instrumental_with_vocals / vocal_forward / traditional_cultural / contemporary_covers

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | All three logging windows in one cycle | Two-week downtime = time to build the complete feature. All three are needed for Cycle 3's summary. |
| 2 | Dashboard state-driven (not tabs/pages) | Zero navigation overhead. Dashboard adapts to gig lifecycle phase. |
| 3 | FAB + bottom sheet for between-song logging | Always one tap away, regardless of active tab. Eliminates navigation waste from the 5-7 sec budget. |
| 4 | Tap from setlist (not auto-advance) | Explicit song identification. Works with improvisation and reordering. |
| 5 | New venues table | Supports presets, defaults, and history for repeat venues. Sets up PF-Intel integration. |
| 6 | New performance_sessions table | Supports multi-set gigs. Status field drives dashboard phase rendering. |
| 7 | Song tags on LR, synced from GigPrep | Tags are catalog-level data (GigPrep's domain). LR stores them for display/override. No hard dependency. |
| 8 | 5-7 second constraint is sacred | If testing shows it takes longer, reduce inputs (not expand time). The constraint is the design, not the inputs. |

## Open Questions

*None — all key decisions resolved during brainstorm.*

## Feed-Forward

- **Hardest decision:** FAB + bottom sheet vs. Log tab. The tab is simpler to build (existing pattern) but burns 30-40% of the 5-7 second budget on navigation. Chose UX speed over implementation simplicity.
- **Rejected alternatives:** Auto-advance song identification (too rigid for a request-taking performer), tags-only-in-GigPrep (creates a hard dependency), columns-on-gigs (blocks multi-set logging), simulation-based testing (ADHD research loop in disguise — build the feature instead).
- **Least confident:** Whether the FAB bottom sheet with song picker + 3 inputs actually fits in 5-7 seconds. This MUST be tested with a real guitar and a timer before the plan is finalized. If it takes 9+ seconds, drop to 2 inputs (quality + one composite "how did that land?" metric).
