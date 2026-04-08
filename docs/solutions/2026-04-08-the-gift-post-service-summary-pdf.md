---
title: "The Gift — Post-Service Summary PDF Generation"
category: feature-implementation
tags: [react-pdf, pdf-generation, vercel-serverless, supabase-aggregation, get-route, timezone, filename-sanitization]
module: Full Stack (API + Components + Data)
symptom: "No automated way to generate post-gig summaries for venue contacts"
root_cause: "Feature gap — Cycle 3 of the roadmap, building the core go-to-market mechanism"
---

# The Gift — Post-Service Summary PDF Generation

## Problem

After gigs, Alex needs to deliver a professional post-service summary to venue contacts. Previously this required manually compiling data from Supabase. The Gift auto-generates a branded PDF from data already collected by Streams 1 (guest engagement) and 2 (musician intelligence).

## Solution

6 commits implementing the full Gift pipeline: data aggregation → PDF rendering → API route → history page → post-debrief banner. 4 new files + 2 modifications, ~1200 lines added.

### Architecture

```
getGiftData(gigId)          → GiftData object (typed, aggregated)
  ↓
GiftDocument(data)          → React PDF component tree (@react-pdf/renderer)
  ↓
renderToBuffer(document)    → PDF Buffer
  ↓
GET /api/gift/[gigId]       → Response with Content-Type: application/pdf
  ↑                           ↑
  History page (<a> tag)      Post-debrief banner (<a> tag)
```

### Key Implementation Details

**Data Aggregation (`lib/gift-data.ts`):**
- 3 parallel queries via `Promise.all` (gig, requests, sessions) + 1 dependent query (song logs)
- Fail-fast on query errors — throws instead of silently degrading to empty arrays
- Peak hour computed in America/Los_Angeles timezone via `Intl.DateTimeFormat`
- Top 5 songs with ties included at 5th position
- `responseRate = total > 0 ? played / total : 0` (never NaN)
- `GiftData | null` return type — null only for nonexistent gigs

**PDF Component (`components/gift-pdf.tsx`):**
- @react-pdf/renderer with bundled local fonts (Outfit, Sora)
- Text-only branding ("PACIFIC FLOW ENTERTAINMENT" in amber accent)
- Graceful degradation: Stream 2 sections conditionally omitted
- Zero-data gigs show "No guest engagement data was recorded for this event"
- Multi-session gigs aggregate across all complete/post_set sessions

**API Route (`app/api/gift/[gigId]/route.tsx`):**
- First GET route in the codebase (all others are POST)
- Cookie auth works via `sameSite: lax` on top-level navigations
- Filename sanitized: strip non-word chars, trim dots/dashes, fallback to "venue", cap at 80 chars
- `X-Content-Type-Options: nosniff` header
- Single-performer scope fence documented in code comment

**History Page (`app/performer/history/page.tsx`):**
- 3 parallel bulk queries + in-memory aggregation (no per-gig fanout)
- "Completed gig" = `is_active = false` AND at least 1 request or 1 session
- Download link uses `<a href>` for native browser download with cookie delivery

**Post-Debrief Banner (`components/pre-set-form.tsx`):**
- Conditional banner when `previousSession` exists (complete phase)
- Uses existing `gig.id` from props — no new prop needed

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| PDF library | @react-pdf/renderer | React components, server-side renderToBuffer, no headless browser |
| Fonts | Bundled locally in public/fonts/ | Eliminates 300-1200ms CDN fetch on cold start |
| Route method | GET (not POST) | Native browser download behavior (new tab, right-click save) |
| Branding | Text-only (no logo image) | No logo asset exists. Text header is clean and professional for V1. |
| Timezone | Hardcoded America/Los_Angeles | All Pacific Flow gigs are in San Diego. Parameterize for multi-timezone later. |
| History query | 3 bulk queries + in-memory Maps | Avoids N*2 per-gig fanout. Scales to 500+ gigs. |
| Error handling | Fail-fast (throw on query errors) | Prevents misleading degraded PDFs from partial data failures. |

## Risk Resolution

| Flagged Risk | What Happened | Lesson |
|-------------|---------------|--------|
| @react-pdf/renderer cold start on Vercel | **Resolved in commit 1** — deployed a test route with Font.register() using local paths. Route loaded cleanly (401 auth error, not 500 import error). Fonts work on Vercel's read-only filesystem via `path.join(process.cwd(), 'public/fonts/...')`. | Verify new library compatibility with a minimal deployed route before building the full feature. One commit for verification, then build on confirmed ground. |
| Logo asset loading on Vercel filesystem | **Scope narrowed** — V1 uses text-only branding. No logo PNG exists. Codex review caught the branding/feed-forward mismatch. Plan, acceptance criteria, and risk table updated to match reality. | Don't claim verification of something you didn't build. Align docs to implementation, not aspirations. |
| Peak hour in wrong timezone | **Caught in Codex review** — original implementation used `new Date().getHours()` which runs in server timezone (UTC on Vercel). Fixed to use `Intl.DateTimeFormat` with `America/Los_Angeles`. | Any date formatting in serverless must specify timezone explicitly. Server runtime timezone is not your user's timezone. |
| History page per-gig query fanout | **Caught in Codex review** — original N*2 per-gig count queries replaced with 3 bulk queries + in-memory aggregation. | Prefer bulk fetch + client-side grouping over per-item queries. The Supabase JS client doesn't support GROUP BY aggregates natively — work around it with bulk select + Map. |
| Silently degraded PDF on partial query failure | **Caught in Codex review** — `requestsResult.data ?? []` swallowed errors. Fixed to throw on non-gig query errors. | `?? []` on Supabase results hides real errors. Check `.error` before using `.data` — the fallback should be a throw, not empty data. |

## Top Patterns (new)

| # | Pattern | Description |
|---|---------|-------------|
| 1 | **Bundled fonts for serverless PDF** | Download TTF files into `public/fonts/`, register with `path.join(process.cwd(), ...)`. Never use CDN URLs in serverless — cold-start latency. |
| 2 | **GET route for file downloads** | Use GET + `<a href>` for native browser download. Cookie auth works via `sameSite: lax` on top-level navigations. Don't use `fetch()` for downloads. |
| 3 | **Fail-fast data aggregation** | Check `.error` on every Supabase result. Throw on non-primary query failures — don't let `?? []` produce misleading empty-data output. |
| 4 | **Explicit timezone in serverless** | Use `Intl.DateTimeFormat` with a named timezone for any user-facing time display. Vercel runs in UTC — `new Date().getHours()` is wrong. |
| 5 | **Bulk fetch + in-memory grouping** | When Supabase JS can't do GROUP BY, fetch all rows and aggregate in-memory with Maps. Better than N per-item count queries. |
| 6 | **Filename sanitization allowlist** | `[^\w\s\-().]` strips everything except safe chars. Trim leading/trailing dots/dashes. Fallback to "venue" if empty. |

## Prevention

- Before using `new Date().getHours()` or `.toLocaleTimeString()` in serverless, ask: "What timezone will this run in?" If it's Vercel, it's UTC.
- Before using `?? []` on a Supabase result, check `.error` first. Silent degradation is worse than a 500.
- When building file-download routes, use GET + `<a>` tag. POST + fetch + blob is unnecessary complexity.
- When a plan says "verify X on first commit," actually do it on the first commit. Don't defer verification behind implementation.

## Feed-Forward

- **Hardest decision:** Using GET instead of POST for the PDF route. Breaks the codebase's POST-only convention but enables native browser downloads. Worth it for file-serving.
- **Rejected alternatives:** Client-side PDF (exposes data), cached PDFs (V1 complexity), AI narrative generation (API cost), per-set breakdowns (complex layout).
- **Least confident:** The history page's bulk query fetches ALL requests and ALL sessions (not filtered to inactive gigs). At scale (10,000+ requests), this could be slow. An RPC with proper joins would fix it, but it's not needed at current volume.
