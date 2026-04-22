---
title: "feat: Session History + CSV Export"
type: feat
status: completed
date: 2026-04-21
origin: docs/brainstorms/2026-04-21-cycle4-session-history-csv-export-brainstorm.md
feed_forward:
  risk: "Bulk stats computation (peak hour per gig) may be expensive on list page at scale. Verify with real data."
  verify_first: false
---

# feat: Session History + CSV Export

## Enhancement Summary

**Deepened on:** 2026-04-21
**Review agents used:** TypeScript Reviewer, Performance Oracle, Security Sentinel, Architecture Strategist, Simplicity Reviewer, Context7 (Next.js 16 docs)

### Key Improvements
1. Fixed CSV handler signature (was missing `request` param — would throw ReferenceError)
2. Removed redundant `responseRate` from `GigStats` interface — compute at serialization
3. Added `serializeToCSV` type signature with sanitization logic (was unspecified)
4. Added Next.js 16 `await params` pattern and `notFound()` import for detail page
5. Added `\t`/`\r` to CSV cell sanitization list (Security Sentinel finding)

### Considered and Rejected
- **ISR on history page** (Performance): `cookies()` from auth opts out of static rendering. Needs middleware refactor — out of scope for this cycle.
- **Inline queries, delete `lib/history-data.ts`** (Simplicity): Architecture confirms separation is correct — CSV route and history page share the same aggregation logic.
- **Remove CSV injection prevention** (Simplicity): Security confirms it's the right call. 5 lines of defensive code, zero cost.
- **Sequential queries with gig ID filter** (TypeScript): Adds a network roundtrip. At current scale, 3 parallel unbounded queries is faster than 1 + 2 sequential filtered queries.

## Overview

Enrich the existing `/performer/history` page with per-gig stats, add a detail drill-down page at `/performer/history/[gigId]`, and create a CSV export endpoint at `GET /api/export/history`. No database migrations — all data already exists in the schema.

(see brainstorm: `docs/brainstorms/2026-04-21-cycle4-session-history-csv-export-brainstorm.md`)

## Problem Statement / Motivation

The history page currently shows only venue name, date, request count, session count, and a Gift PDF button. The performer can't see response rates, vibe trends, or peak hours without downloading the full Gift PDF. There's no way to browse individual gig details or export data to a spreadsheet for cross-gig analysis.

## Proposed Solution

### Architecture: Two data paths

1. **Bulk stats** (new `lib/history-data.ts`) — 3 parallel Supabase queries + in-memory aggregation. Serves both the list page and CSV export. Lightweight: no song joins, no song_logs.
2. **Per-gig detail** (existing `lib/gift-data.ts`) — `getGiftData(gigId)` already computes everything the detail page needs. No changes required.

```
lib/history-data.ts  →  getHistoryStats()  →  history list page + CSV export
lib/gift-data.ts     →  getGiftData()      →  detail page (already exists)
```

### New/modified files

| File | Action | Purpose |
|------|--------|---------|
| `lib/history-data.ts` | **New** | Bulk stats: `getHistoryStats()` returns `GigStats[]` |
| `app/performer/history/page.tsx` | **Modify** | Use `getHistoryStats()`, add stats + CSV button |
| `app/performer/history/[gigId]/page.tsx` | **New** | Detail page: request list, session stats, Gift link |
| `app/api/export/history/route.ts` | **New** | CSV download endpoint |

### What must NOT change

- `lib/gift-data.ts` — `getGiftData()` is stable, used by Gift PDF
- `app/api/gift/[gigId]/route.tsx` — Gift PDF route untouched
- Database schema — no migrations, all data exists
- `app/performer/dashboard/page.tsx` — dashboard untouched
- Guest-facing pages (`/r/[slug]`) — untouched

## Technical Approach

### Phase 1: Bulk stats function (`lib/history-data.ts`)

Create `getHistoryStats()` that returns `GigStats[]`:

```typescript
// lib/history-data.ts
import type { Vibe } from "@/lib/supabase/types";

export interface GigStats {
  id: string;
  venue_name: string;
  gig_date: string;  // ISO 8601 date from Supabase (e.g. "2026-03-06")
  requests: { total: number; played: number };  // responseRate computed at serialization
  vibes: { fire: number; more_energy: number; softer: number };
  peakHour: string | null;  // "8 PM" in America/Los_Angeles, null when 0 requests
  sessionCount: number;
}

// Helper — compute response rate safely at render/serialization time
// Usage: responseRate(stats.requests) → 0.85
export function responseRate(r: { total: number; played: number }): number {
  return r.total > 0 ? r.played / r.total : 0;
}
```

**Data-fetching strategy** (resolves brainstorm Feed-Forward risk):

```typescript
const [gigsResult, allRequests, allSessions] = await Promise.all([
  supabase.from("gigs").select("id, venue_name, gig_date")
    .eq("is_active", false).order("gig_date", { ascending: false }),
  supabase.from("song_requests").select("gig_id, played_at, vibe, created_at"),
  supabase.from("performance_sessions").select("gig_id")
    .in("status", ["complete", "post_set"]),
]);
```

- Enriches the existing history page pattern: adds `played_at`, `vibe`, `created_at` to the requests query (was `gig_id` only)
- Groups by `gig_id` using `Map<string, ...>` (same pattern as current history page)
- Computes response rate, vibe counts, peak hour per gig in-memory
- Filters: `is_active = false` AND (`request_count > 0 || session_count > 0`)
- Peak hour uses `Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "America/Los_Angeles" })` (Gift PDF pattern, `lib/gift-data.ts:150`)

**Files to reference:** `app/performer/history/page.tsx:24-50` (current bulk pattern), `lib/gift-data.ts:77-92` (request stats computation)

### Phase 2: Enrich history list page

Modify `app/performer/history/page.tsx`:

- Replace the 3 inline queries with `getHistoryStats()` call
- Add per-gig stats to each card: response rate badge, vibe emoji counts, peak hour
- Add "Export CSV" `<a href="/api/export/history">` button in the page header (only when `gigList.length > 0`)
- Keep existing Gift PDF button per gig
- Existing page subtitle: update from "Download post-service summaries" to "View past gig stats and export data"
- Each gig card becomes a `<Link>` to `/performer/history/[gigId]` (tappable for detail)

**Design pattern:** Reuse existing glassmorphic card from `page.tsx:91-132`. Add stats row below the existing venue/date/counts.

### Phase 3: Gig detail page (`app/performer/history/[gigId]/page.tsx`)

Server component with:

- Auth guard: `isAuthenticated()` → redirect to `/performer` (same as dashboard)
- UUID validation: `isUUID(gigId)` → `notFound()` if invalid (SpecFlow gap #8)
- Data: `getGiftData(gigId)` → `notFound()` if null
- **Back link:** "Back to History" at top (SpecFlow gap #4)
- **Sections:**
  - Header: venue name, date
  - Stats summary: total requests, played count, response rate (via `responseRate()` helper), vibe breakdown, peak hour
  - Request list: song title, artist, timestamp (LA timezone), played/pending badge, vibe emoji
  - Session stats (per set): set number, duration, song quality breakdown, volume, guest ack
  - If `getGiftData().hasStream2` is true, show session details; otherwise skip section
- **Gift link:** "View Gift PDF" button — only shown when `requests.total > 0` (SpecFlow gap #3)
- `export const dynamic = "force-dynamic"` (no cache, same as current history page)

**Next.js 16 pattern** (params is a Promise, must be awaited):

```typescript
import { redirect, notFound } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { isUUID } from "@/lib/validation";
import { getGiftData } from "@/lib/gift-data";

interface PageProps {
  params: Promise<{ gigId: string }>;
}

export default async function GigDetail({ params }: PageProps) {
  if (!(await isAuthenticated())) redirect("/performer");
  const { gigId } = await params;
  if (!isUUID(gigId)) notFound();

  const data = await getGiftData(gigId);
  if (!data) notFound();

  // render...
}
```

**Files to reference:** `app/api/gift/[gigId]/route.tsx:25-31` (auth + UUID pattern), `lib/gift-data.ts:8-32` (GiftData interface)

### Phase 4: CSV export endpoint (`app/api/export/history/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getHistoryStats, responseRate } from "@/lib/history-data";

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    // Redirect instead of raw 401 — this is an <a href> download (SpecFlow gap #2)
    return NextResponse.redirect(new URL("/performer", request.url));
  }
  
  const stats = await getHistoryStats();
  const csv = serializeToCSV(stats);
  
  const today = new Date().toISOString().slice(0, 10);
  const filename = `LiveRequest-History-${today}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
```

**`serializeToCSV` type signature and sanitization logic:**

```typescript
import type { GigStats } from "@/lib/history-data";

const CSV_HEADERS = "Date,Venue,Total Requests,Played,Response Rate,Peak Hour,Fire,More Energy,Softer,Sessions";

// Characters that trigger formula execution in Excel/Sheets
const FORMULA_CHARS = new Set(["=", "+", "-", "@", "|", "\t", "\r"]);

function sanitizeCell(value: string): string {
  if (value.length > 0 && FORMULA_CHARS.has(value[0])) {
    return "'" + value;
  }
  // Wrap in quotes if contains comma, quote, or newline
  if (/[,"\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function serializeToCSV(stats: GigStats[]): string {
  const BOM = "\uFEFF";
  const rows = stats.map((g) =>
    [
      g.gig_date,
      sanitizeCell(g.venue_name),
      g.requests.total,
      g.requests.played,
      responseRate(g.requests).toFixed(2),
      g.peakHour ?? "",
      g.vibes.fire,
      g.vibes.more_energy,
      g.vibes.softer,
      g.sessionCount,
    ].join(",")
  );
  return BOM + CSV_HEADERS + "\n" + rows.join("\n");
}
```

**CSV format:**
- UTF-8 BOM prefix (`\uFEFF`) for Excel compatibility (SpecFlow gap #5)
- Columns: `Date,Venue,Total Requests,Played,Response Rate,Peak Hour,Fire,More Energy,Softer,Sessions`
- Date format: ISO 8601 (`2026-03-06`)
- Response rate: decimal (`0.85`), computed via `responseRate()` helper
- Headers-only CSV when no completed gigs (brainstorm edge case #3)
- Cell injection prevention: prefix cells starting with `=`, `+`, `-`, `@`, `|`, `\t`, `\r` with `'` (Lead Scraper lesson + Security Sentinel addition)

**Filename sanitization:** Reuse pattern from `app/api/gift/[gigId]/route.tsx:11-19`.

**Files to reference:** `app/api/gift/[gigId]/route.tsx` (full download route pattern)

## System-Wide Impact

- **Interaction graph:** History page → `getHistoryStats()` → Supabase (3 queries). Detail page → `getGiftData()` → Supabase (3-4 queries). CSV route → `getHistoryStats()` → Supabase (3 queries). No callbacks, no middleware, no side effects.
- **Error propagation:** `getHistoryStats()` throws on Supabase error → history page shows Next.js error boundary. `getGiftData()` returns null → detail page shows 404. CSV route catches and returns 500.
- **State lifecycle risks:** None — all reads, no writes. No caching, no optimistic UI.
- **API surface parity:** CSV export adds one new GET endpoint. No agent-native gap (endpoint is directly callable by agents/CLI).

## Acceptance Tests

### Happy Path

- WHEN a performer visits `/performer/history` THE SYSTEM SHALL display each completed gig with response rate, vibe emoji counts, and peak hour
- WHEN a performer taps a gig card THE SYSTEM SHALL navigate to `/performer/history/[gigId]` showing full request list and session stats
- WHEN a performer taps "Export CSV" THE SYSTEM SHALL download a CSV file with one summary row per completed gig
- WHEN a performer taps "View Gift PDF" on a detail page THE SYSTEM SHALL navigate to the existing Gift PDF download

### Error Cases

- WHEN a performer visits `/performer/history/not-a-uuid` THE SYSTEM SHALL display a 404 page
- WHEN a performer visits `/performer/history/[valid-uuid-not-found]` THE SYSTEM SHALL display a 404 page
- WHEN an unauthenticated user visits `/performer/history` THE SYSTEM SHALL redirect to `/performer`
- WHEN an unauthenticated user requests `GET /api/export/history` THE SYSTEM SHALL redirect to `/performer`
- WHEN a performer exports CSV with no completed gigs THE SYSTEM SHALL return a CSV with headers only

### Edge Cases

- WHEN a gig has 0 requests but 1+ sessions THE SYSTEM SHALL show the gig in history with "0 requests" and hide the "View Gift PDF" button on detail
- WHEN a CSV cell value starts with `=`, `+`, `-`, `@`, or `|` THE SYSTEM SHALL prefix it with a single quote
- WHEN all timestamps are in the same hour THE SYSTEM SHALL show that hour as peak hour (not null)

### Verification Commands

```bash
npm run build                    # TypeScript compiles
npm test                         # Existing 51 tests still pass
curl -b cookie.txt /api/export/history -o test.csv && head -2 test.csv  # CSV downloads with headers
```

## Dependencies & Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Bulk stats slow at 50+ gigs | Low (current scale: <10 gigs) | Peak hour is the only expensive computation; skip it if profile shows >200ms |
| CSV cell injection | Low (venue names are performer-controlled) | Prefix sanitization on all string cells regardless |
| JWT expiry between page load and CSV click | Low (tokens are long-lived) | Redirect to /performer on auth failure instead of raw 401 |

### Performance Thresholds (from Performance Oracle review)

| Row count | Expected latency | Action needed |
|-----------|-----------------|---------------|
| 500 (now) | <50ms | None |
| 10,000 (100 gigs) | <100ms | None |
| 50,000 (500 gigs) | 200-400ms | Replace bulk fetch with Postgres `GROUP BY` RPC |

- `Intl.DateTimeFormat.format()` is ~1-2 microseconds per call — not a bottleneck even at 10K requests
- **Future optimization:** ISR on history page (`revalidate = 3600`) would eliminate redundant queries for completed gigs. Blocked by `cookies()` in auth — requires middleware refactor. Out of scope for Cycle 4.

## Implementation Order

Commit each phase separately (~50-100 lines each):

1. `lib/history-data.ts` — bulk stats function
2. `app/performer/history/page.tsx` — enrich list with stats + CSV button
3. `app/performer/history/[gigId]/page.tsx` — detail page
4. `app/api/export/history/route.ts` — CSV endpoint

## Sources & References

### Origin

- **Brainstorm:** [docs/brainstorms/2026-04-21-cycle4-session-history-csv-export-brainstorm.md](docs/brainstorms/2026-04-21-cycle4-session-history-csv-export-brainstorm.md) — Key decisions: separate detail page, summary CSV, export-all on list page, completed gigs only, link Gift from detail
- **Roadmap:** [docs/roadmap.md](docs/roadmap.md) lines 136-159 (Cycle 4 spec)

### Internal References

- Bulk query pattern: `app/performer/history/page.tsx:24-50`
- Gift data aggregator: `lib/gift-data.ts:38-141`
- Gift download route: `app/api/gift/[gigId]/route.tsx:11-63`
- Filename sanitization: `app/api/gift/[gigId]/route.tsx:11-19`
- Peak hour computation: `lib/gift-data.ts:143-160`
- Auth guard pattern: `app/performer/dashboard/page.tsx:16-18`

### Institutional Learnings

- Gift PDF solution doc: `docs/solutions/2026-04-08-the-gift-post-service-summary-pdf.md` — GET route, filename sanitization, bulk aggregation, timezone, fail-fast
- Lead Scraper CSV injection: prefix `=+-@|` with `'` (pipe char is easy to miss)
- Safe division: `total > 0 ? played / total : 0` prevents NaN

## Feed-Forward

- **Hardest decision:** Whether to create a shared `getHistoryStats()` function or extend `getGiftData()`. Chose a separate function because the list/CSV need lightweight bulk stats (no song joins, no song_logs), while the detail page needs full per-gig depth. Two data paths, each optimized for its use case.
- **Rejected alternatives:** Calling `getGiftData()` per gig for list/CSV (N*3 queries), inline queries in each consumer (duplication).
- **Least confident:** Whether peak hour computation in the bulk stats function is worth the cost on the list page. It requires grouping all requests by hour per gig in LA timezone. At 10 gigs with 50 requests each, this is 500 iterations — trivial. At 100+ gigs, may need to drop peak hour from the list view and only show it on detail.
