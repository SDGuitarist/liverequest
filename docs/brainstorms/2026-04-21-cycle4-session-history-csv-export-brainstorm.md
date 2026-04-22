# Cycle 4 Brainstorm: Session History + CSV Export

**Date:** 2026-04-21
**Status:** Complete
**Next phase:** Plan

---

## What We're Building

Enrich the existing `/performer/history` page and add CSV export. Two deliverables:

### 4.1 — Enriched History Page + Gig Detail View

**List view (existing page, enhanced):**
- Keep current layout: venue name, date, request count, session count, Gift PDF button
- Add inline stats per gig: response rate, vibe breakdown (emoji counts), peak hour
- Add "Export CSV" button alongside the existing Gift PDF button
- Completed gigs only (active gig stays on the dashboard)

**Detail view (new page):**
- Route: `/performer/history/[gigId]`
- Full request list: song title, artist, timestamp, played/pending status, vibe
- Session stats: set number, duration, song quality breakdown, volume, guest acknowledgment
- "View Gift" button linking to the existing Gift PDF for this gig
- Back link to history list

### 4.2 — CSV Export

**Endpoint:** `GET /api/export/history`
- Auth-gated (same `isAuthenticated()` pattern)
- Returns one summary row per completed gig
- Columns: date, venue, total requests, played count, response rate (decimal, e.g. 0.85), peak hour, fire count, energy count, softer count, session count
- Filename: `LiveRequest-History-YYYY-MM-DD.csv`
- Uses `Content-Disposition: attachment` (same pattern as Gift PDF route)
- CSV cell injection prevention: prefix cells starting with `=`, `-`, `+`, `@`, `|` with single quote (lesson from Lead Scraper solution doc)

---

## Why This Approach

### Separate detail page (not accordion or drawer)
- Standard Next.js dynamic route — matches existing `/r/[slug]` pattern
- Clean URLs, back button works, shareable/bookmarkable
- Each gig loads its own data, keeping the history list fast
- iPad music stand UX: no scroll-fighting with drawers, no accordion complexity

### Summary CSV (not per-request detail)
- One row per gig is the right unit for cross-gig analysis in a spreadsheet
- Per-request detail already lives on the detail page (visual) and in the Gift PDF
- Single endpoint, single file — simplest thing that works
- Can add a per-gig detail export later if needed (YAGNI for now)

### "Export All" on history list (not per-gig export)
- One click to get everything — the venue GM use case is "show me all gigs"
- Per-gig export would require navigating to each detail page
- The detail page links to the Gift PDF for single-gig deep dives

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Detail view pattern | New page `/performer/history/[gigId]` | Clean URL, back button, no client-side complexity |
| CSV scope | Summary row per gig | Cross-gig analysis, simplest export |
| Export button location | History list page | One click for all data |
| Active gig in history? | No — completed only | Clean separation; active gig lives on dashboard |
| Gift PDF from detail? | Yes — link on detail page | One place to see everything about a gig |
| Data source for stats | Reuse `getGiftData()` | Already computes all needed stats per gig |

---

## What Already Exists (Reusable)

| Asset | Location | Reuse |
|-------|----------|-------|
| History list page | `app/performer/history/page.tsx` | Enhance with stats + CSV button |
| Gift data aggregator | `lib/gift-data.ts` → `getGiftData()` | Powers both detail page stats and CSV rows |
| Gift PDF download route | `app/api/gift/[gigId]/route.tsx` | Pattern for CSV route (auth + Content-Disposition) |
| Filename sanitization | Gift PDF route | Reuse for CSV filename |
| Glassmorphic card design | History page + dashboard | Reuse for detail page cards |

---

## Edge Cases to Address in Plan

1. **Zero requests gig** — history already filters these out (line 51). Detail page should handle gracefully (empty state).
2. **Gig with no sessions** — possible if requests came in before performer started a session. Show request stats, skip session section.
3. **CSV with no completed gigs** — return empty CSV with headers only, or 404? Prefer headers-only (spreadsheet still opens cleanly).
4. **Large export** — at current scale (<50 gigs) this is a non-issue. If it ever hits 500+ gigs, add date range filtering. YAGNI for now.
5. **Timezone** — use `America/Los_Angeles` explicitly (lesson from Gift PDF). Don't use local timezone.
6. **List view data-fetching** — current history page only fetches `gig_id` from `song_requests`. Showing response rate, vibes, and peak hour per gig requires either calling `getGiftData()` per gig (N*3 queries) or enriching the bulk queries to fetch `played_at` and `vibe` columns and computing stats in-memory. The bulk approach is clearly better for the list page. Plan must decide this explicitly.

---

## Feed-Forward

- **Hardest decision:** Whether CSV should be summary-per-gig or detail-per-request. Summary wins for the venue GM use case (cross-gig spreadsheet analysis), but we lose per-request granularity. The Gift PDF and detail page cover that gap visually.
- **Rejected alternatives:** Accordion detail view (lazy-fetch complexity, no shareable URL), drawer overlay (scroll conflicts on iPad), per-gig CSV export button (requires navigating to each gig).
- **Least confident:** Data-fetching strategy for the list view AND CSV export. Both need per-gig stats, but `getGiftData()` runs 3 queries per gig — fine for the detail page (one gig), expensive for the list/CSV (N gigs). The list page should enrich its existing bulk queries instead. CSV export may need the same bulk approach or a dedicated aggregation query. Plan must resolve this tension explicitly.
