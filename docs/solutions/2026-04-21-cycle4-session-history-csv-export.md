---
title: "Session History + CSV Export (Cycle 4)"
date: 2026-04-21
category: feature
tags: [history, csv-export, performer-dashboard, data-access, type-safety]
module: performer/history
symptom: "Performer had no way to review past gig stats or export request data after a session ended"
root_cause: "History page was a stub with no per-gig drill-down or export capability; data access layer only supported the Gift PDF path"
summary: "Added enriched history list with per-gig stats, detail drill-down page, and CSV export endpoint using a dual data-path architecture (bulk getHistoryStats vs per-gig getGiftData)."
---

# Session History + CSV Export (Cycle 4)

## What Was Built

Enriched the existing `/performer/history` page and added two new surfaces:

- **History list** — per-gig stats (response rate, vibe counts, peak hour) inline on each card
- **Detail page** (`/performer/history/[gigId]`) — full request list, session stats, top songs, Gift PDF link
- **CSV export** (`GET /api/export/history`) — one summary row per completed gig with formula injection prevention

New files: `lib/history-data.ts`, `lib/time-utils.ts`, `app/performer/history/[gigId]/page.tsx`, `app/api/export/history/route.ts`

## Key Patterns

### 1. Two-Data-Path Architecture

`getHistoryStats()` fetches lightweight bulk stats for list pages and CSV export. It fires 3 parallel queries (gigs, all requests, all sessions) and aggregates in-memory using `Map` grouping. A separate `getGiftData()` (from Cycle 3) fetches deep per-gig detail for the detail page.

```typescript
// lib/history-data.ts — bulk stats: 3 parallel queries, in-memory grouping
const [gigsResult, allRequests, allSessions] = await Promise.all([
  supabase.from("gigs").select("id, venue_name, gig_date").eq("is_active", false),
  supabase.from("song_requests").select("gig_id, played_at, vibe, created_at"),
  supabase.from("performance_sessions").select("gig_id").in("status", ["complete", "post_set"]),
]);
```

The `GigStats` interface carries just what the list/CSV needs: totals, vibe counts, peak hour, session count. The helper `responseRate()` safely handles division by zero.

**Why two paths:** List pages need aggregates across all gigs (wide, shallow). Detail pages need full request lists for one gig (narrow, deep). One query shape cannot serve both efficiently.

### 2. CSV Formula Injection Prevention

`sanitizeCell` prevents Excel/Sheets formula injection by prefixing dangerous first characters, then quoting if the value contains CSV-special characters.

```typescript
// app/api/export/history/route.ts
const FORMULA_CHARS = new Set(["=", "+", "-", "@", "|", "\t", "\r"]);

function sanitizeCell(value: string): string {
  const needsPrefix = value.length > 0 && FORMULA_CHARS.has(value[0]);
  const escaped = needsPrefix ? "'" + value : value;
  if (/[,"\n]/.test(escaped)) {
    return '"' + escaped.replace(/"/g, '""') + '"';
  }
  return escaped;
}
```

**Key fix from review:** The original code had an early return after prefixing that skipped the quote-wrapping path. If a venue name started with `=` AND contained a comma, the CSV column alignment would break. Fix: prefix first, then check if quoting is needed on the *prefixed* string. Never early-return from a sanitization function.

### 3. Shared Utility Extraction (computePeakHour)

Duplicated peak-hour logic was extracted to `lib/time-utils.ts` during review fixes. Uses `Intl.DateTimeFormat` with an explicit timezone constant.

```typescript
// lib/time-utils.ts
const GIG_TIMEZONE = "America/Los_Angeles";

export function computePeakHour(requests: { created_at: string }[]): string | null {
  if (requests.length === 0) return null;
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric", hour12: false, timeZone: GIG_TIMEZONE,
  });
  // ... count hours via Map, find max, format as "8:00 PM"
}
```

**Why Intl over Date methods:** `getHours()` uses the server's local timezone. `Intl.DateTimeFormat` with explicit `timeZone` is deterministic regardless of where the server runs (Vercel edge, local dev, etc.).

### 4. isVibe Type Guard

Replaces unsafe `as Vibe` casts with a runtime-checked type guard derived from the const array.

```typescript
// lib/supabase/types.ts
export function isVibe(v: string): v is Vibe {
  return (VIBE_VALUES as readonly string[]).includes(v);
}
```

Usage: `if (r.vibe && isVibe(r.vibe)) { vibes[r.vibe]++; }` — TypeScript narrows `r.vibe` to `Vibe` inside the block, no cast needed. The guard is reusable anywhere DB strings need narrowing to the union type.

## Review Findings and Resolutions

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| 028 | Detail page queried requests twice (getGiftData + separate RequestList query) | P2 | Added `rawRequests` field to GiftData, pass as props |
| 029 | sanitizeCell formula prefix skipped CSV quoting | P2 | Apply prefix first, then check quoting on escaped value |
| 030 | Unused VOLUME_CAL_LABEL import + unsafe `as Vibe` casts | P2 | Removed import, added `isVibe()` type guard |
| 031 | computePeakHour duplicated between gift-data.ts and history-data.ts | P3 | Extracted to `lib/time-utils.ts` |

**Agent convergence:** 3 agents independently flagged the redundant query (#028). 2 agents independently flagged the sanitizeCell bypass (#029). High-confidence findings.

## Prevention Strategies

1. **Redundant queries** — Before adding any Supabase query, check whether the parent data source already supplies the needed data. Rule: one page = one data-fetching call unless joins are impossible.

2. **Sanitization bypasses** — Never early-return from a sanitization function. Structure as a pipeline: every input passes through all transformations sequentially. No "if clean, skip" branches.

3. **Unsafe type casts** — For every union type, co-locate a type guard in the same file as the type definition. Treat bare `as` casts as a code smell during review.

4. **Duplicated utilities** — Before writing any new utility function, grep the codebase for the function name and its likely synonyms. If a match exists, extract to `lib/` and import.

## Performance Notes

| Scale | Expected latency | Action |
|-------|-----------------|--------|
| 500 rows (now) | <50ms | None |
| 10,000 rows (100 gigs) | <100ms | None |
| 50,000 rows (500 gigs) | 200-400ms | Replace bulk fetch with Postgres GROUP BY RPC |

Future optimization: ISR on history page (`revalidate = 3600`) would eliminate redundant queries. Blocked by `cookies()` in auth — requires middleware refactor.

## Related Documentation

- [Cycle 3: The Gift PDF](2026-04-08-the-gift-post-service-summary-pdf.md) — origin of bulk aggregation, timezone handling, fail-fast patterns reused here
- [Security/Race Condition Fixes](diagnostic-fix-session-rls-races-perf.md) — RLS defense-in-depth context
- [Deploy: Vercel Cookie Auth](deploy-vercel-cookie-auth.md) — auth context for new API routes
- [Cycle 4 Brainstorm](../brainstorms/2026-04-21-cycle4-session-history-csv-export-brainstorm.md)
- [Cycle 4 Plan](../plans/2026-04-21-feat-session-history-csv-export-plan.md) (deepened with 5 review agents)

## Feed-Forward

- **Hardest decision:** Whether to modify `getGiftData()` (adding `rawRequests`) or keep it untouched. The plan said "must not change" but the review found a redundant query that required it. Review findings override plan constraints when they identify real bugs.
- **Rejected alternatives:** Inline queries in each consumer (duplication), calling getGiftData() per gig for list/CSV (N*3 queries), ISR on history page (blocked by cookies() auth).
- **Least confident:** The `rawRequests` addition to GiftData is additive and non-breaking, but it increases the data transferred for Gift PDF renders that don't need individual rows. At current scale this is negligible. Monitor if GiftData responses grow large.
