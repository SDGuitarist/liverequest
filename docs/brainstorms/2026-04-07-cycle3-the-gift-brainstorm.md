# Brainstorm: Cycle 3 — The Gift (Post-Service Summary)

**Date:** 2026-04-07
**Trigger:** Roadmap Cycle 3, gated by Cycle 2 completion. Cycle 2 deployed to production.

## What We're Building

A post-service summary PDF ("The Gift") that Alex delivers to venue contacts after gigs. The summary auto-generates from data already collected by Streams 1 and 2 (guest requests + musician intelligence). The venue manager should be able to scan it in 60 seconds.

**Product Bible alignment:** The Gift is the core go-to-market mechanism. Silent deployment — collect data at every gig without mentioning it, then deliver the summary as an "unexpected gift" to build the venue relationship.

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Automation level | Fully auto-generated, human reviews before sending | Removes friction. Data is already structured. Review step ensures quality. |
| Delivery format | PDF download | Professional deliverable. Can be emailed, printed, or attached to a follow-up. |
| Narrative generation | Structured template with dynamic data | Zero API cost, predictable output, works offline. AI polish is a future enhancement. |
| Trigger | After debrief is submitted | All data is captured by then. Natural end-of-gig workflow. |
| Branding | Pacific Flow Entertainment | Positions the Gift as a professional business deliverable, not a tech platform export. |
| Scope | Gift generation + minimal gig history list | History list gives access to generate Gifts for any past gig, not just the most recent. |

## Why This Approach

**Structured template over AI generation:** The data fields are finite and well-defined (request count, vibe distribution, song quality, timing). A template with dynamic data injection produces consistent, professional output without API costs or latency. The narrative structure can be refined over real gig data. AI generation is a natural upgrade path once the template is validated.

**PDF over copy-paste or shareable link:** A PDF is a tangible deliverable that feels professional. It can be attached to a follow-up email, printed for an in-person handoff, or archived. Copy-paste loses formatting; shareable links require the venue contact to visit a URL (friction).

**Gift + minimal history:** Tight enough to ship quickly (the Gift generation is the real feature), but the history list prevents the "I missed the Gift after my last gig" problem. The history list is a simple data table, not a full analytics page.

## Data Available for the Gift

All data exists in the current schema — no new tables needed.

### From Stream 1 (Guest Engagement)
- Total song requests (`song_requests` count per gig)
- Unique songs requested
- Most-requested songs (grouped by song_id, sorted by count)
- Vibe distribution (fire / more_energy / softer counts)
- Request timing (earliest, latest, peak hour)
- Response rate (played_at IS NOT NULL / total)

### From Stream 2 (Musician Intelligence)
- Set duration (started_at to ended_at)
- Configuration (solo/duo/trio/ensemble)
- Genre/style
- Song quality distribution (off / fine / locked_in counts)
- Volume calibration summary
- Guest acknowledgment rate
- Walkup count
- Tips received (boolean)
- Staff feedback (free text)
- Overall feel (off_night / fine / felt_it)
- Observations (free text)

### From Venue/Gig
- Venue name, address
- Gig date
- Performer name (hardcoded for now: "Alejandro Guillen / Pacific Flow Entertainment")

## PDF Structure (Draft)

```
+----------------------------------------------+
| PACIFIC FLOW ENTERTAINMENT                    |
| Post-Service Summary                         |
| [Venue Name] — [Date]                        |
+----------------------------------------------+
|                                               |
| PERFORMANCE OVERVIEW                          |
| Configuration: Solo | Duration: 2h 15m        |
| Genre: Latin Jazz & Contemporary              |
|                                               |
| GUEST ENGAGEMENT                              |
| 23 song requests from your guests             |
| 18 songs played (78% response rate)           |
| Peak engagement: 8:00-9:00 PM                 |
|                                               |
| TOP REQUESTED                                 |
| 1. Despacito (5 requests)                     |
| 2. Besame Mucho (3 requests)                  |
| 3. Hotel California (3 requests)              |
|                                               |
| AUDIENCE VIBES                                |
| 🔥 Fire: 8  ⚡ Energy: 5  🌙 Softer: 3       |
|                                               |
| PERFORMANCE QUALITY                           |
| Songs logged: 14                              |
| Quality: 10 Locked In, 3 Fine, 1 Off         |
| Volume: Calibrated correctly for 12/14 songs  |
| Guest acknowledgment: 9/14 songs              |
|                                               |
| OBSERVATIONS                                  |
| [Free-text observations from debrief]         |
| [Staff feedback if provided]                  |
|                                               |
| WALKUPS & TIPS                                |
| 4 walkup interactions | Tips received: Yes     |
|                                               |
+----------------------------------------------+
| Generated by LiveRequest for Pacific Flow     |
+----------------------------------------------+
```

## Technical Approach Options

### Option A: Server-side PDF via `@react-pdf/renderer` (Recommended)
- React components render to PDF on the server
- Full control over layout, fonts, colors
- Works in Next.js API routes or Server Components
- ~200KB bundle addition
- Well-maintained, React-native approach

Rejected alternatives: `jsPDF` + `html2canvas` (font issues, less control), Puppeteer/Playwright (not practical on Vercel serverless — binary size limits).

## Minimal Gig History List

A simple page at `/performer/history` showing completed gigs:

| Date | Venue | Requests | Sets | Gift |
|------|-------|----------|------|------|
| Apr 5 | Japanese Garden | 23 | 2 | [Download PDF] |
| Mar 29 | Coasterra | 18 | 1 | [Download PDF] |

Data source: `gigs` table + aggregate counts from `song_requests` and `performance_sessions`. No new tables needed. A gig is "completed" if it has at least one `performance_session` (any status) or at least one `song_request`. Gigs with `is_active = false` and no related data are ignored (never started).

**Single generation path:** Both the post-debrief trigger and the history page "Download PDF" button call the same API route (`/api/gift/generate?gigId=...`). One generation mechanism, two access points.

## What's NOT in Scope

- Email sending (deliver PDF manually via email/DM)
- Venue contact management (no contacts table — manage outside the app)
- AI narrative generation (future enhancement)
- Stream 3 data (venue POS data — requires trust, gated by relationship)
- Analytics dashboard (Cycle 5)
- Session History detail page (Cycle 4 — the history list here is just a table with download buttons)

## Resolved Questions

1. **Gift for gigs with no Stream 2 data:** Gracefully degrade. Show: Performance Overview (venue/date only, no duration/config), Guest Engagement, Top Requested, Audience Vibes. Skip: Performance Quality, Observations, Walkups & Tips. The PDF is shorter but still valuable.
2. **How many top songs to show?** Top 5. If fewer than 5 were requested, show all.

## Open Questions

1. **PDF library choice:** `@react-pdf/renderer` is recommended, but should we verify it works in Vercel serverless (edge runtime limitations)? This is the feed_forward risk to verify first in the plan phase.

## Feed-Forward

- **Hardest decision:** Including the minimal gig history list. It's scope creep vs the "I missed it" problem. Decided to include because it's a simple data table with no new tables or complex UI.
- **Rejected alternatives:** AI narrative generation (API cost + latency for V1), shareable links (friction for venue contacts), copy-paste delivery (loses formatting).
- **Least confident:** Whether `@react-pdf/renderer` works cleanly in Vercel serverless. It uses Node.js APIs that may not be available in Edge Runtime. Need to verify this early in the plan phase.
