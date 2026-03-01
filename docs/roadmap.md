# LiveRequest — Feature Roadmap

> Last updated: 2026-03-01
> Governed by: [Product Bible](product-bible.md) — the Bible defines *what matters and why*; this roadmap defines *what's next and when*.

## Current State (Cycle 1 — complete)

The core request loop and data preservation layer are complete and production-ready:
- Audience taps a song from a curated catalog at `/r/alejandro` (hardcoded slug)
- Fullscreen celebration overlay (confetti, mesh gradient, share button)
- Vibe feedback: 🔥 Fire / ⚡ More Energy / 🌙 Softer (three actionable signals)
- Performer sees requests in real-time on `/performer/dashboard`
- Pending/Played sections with mark-as-played, undo, optimistic UI
- Password auth via JWT cookies, RLS security, ISR caching
- Neon Lounge design system, haptic feedback, wake lock

**First live gig: March 6, 2026 at The Blue Note.**

---

## Validation Gate: March 6

The Product Bible (Principle 7) requires real-world validation before building the next layer. March 6 is the first gig with the custom app. Cycle priorities after deployment are provisional — they will be re-evaluated based on what the gig reveals.

**What March 6 validates:**
- Do guests actually scan the QR code and engage?
- Does the performer dashboard work on an iPad music stand during a live set?
- Does venue Wi-Fi hold the Realtime connection?
- Do vibe signals come in, and are they useful?
- What breaks that we didn't anticipate?

**What to observe (manually, not automated):**
- Participation rate (how many guests vs. how many requests)
- Request timing patterns
- Vibe distribution
- Any friction points in the performer flow
- Feedback from venue staff

After March 6, compile the first "gift" manually (see Product Bible: "What the Gift Looks Like Today") and deliver it. Then re-evaluate this roadmap.

---

## Cycle 1 — Stop Losing Data ✅

**Status: Complete.** Shipped and reviewed.

### 1.1 Mark as Played (replace Dismiss) ✅

| Detail | Value |
|---|---|
| **Problem** | Dismiss deletes `song_requests` rows. Data is gone forever. |
| **Fix** | Add `played_at timestamptz` column. Change dismiss API from DELETE to UPDATE (`played_at = now()`). |
| **Dashboard** | Split queue into Pending (`played_at IS NULL`) and Played (grayed out). |
| **Undo** | Tap a played song to move it back to pending (`played_at = NULL`). |
| **Scope** | 1 migration, 1 API route change, 1 component update. |
| **Unlocks** | Session history, response rate, analytics, CSV export — everything downstream. |

### 1.2 Vibe Feedback ✅

| Detail | Value |
|---|---|
| **What** | Three audience feedback buttons on confirmation overlay: 🔥 Fire, ⚡ More Energy, 🌙 Softer. |
| **DB** | `vibe text` column on `song_requests` — constrained to `'fire' | 'more_energy' | 'softer' | null`. |
| **Audience UI** | Three buttons on confirmation overlay. Optional — null if skipped. |
| **Scope** | 1 migration, overlay component update, column-level GRANT + RLS policy. |
| **Unlocks** | Sentiment data, vibe distribution, the first real engagement metric beyond request count. |

---

## Pre-Deploy — Production Deployment

**Goal:** Get the app live for the March 6 gig.
**When:** Before March 6. Blocking everything else.

| Task | Details |
|---|---|
| **Vercel deployment** | Deploy Next.js app, configure environment variables, domain |
| **Dynamic slug management** | Replace hardcoded `/r/alejandro` with slug creation/assignment. Needed before a second venue. Can be Supabase-dashboard-managed for now — no admin UI required. |
| **Pre-deploy checklist** | `npm run build && npm run start` locally, verify env vars, security headers |

---

## Cycle 2 — Musician Intelligence (Stream 2)

**Goal:** Capture structured musician observations — the data that turns a request list into a performance story.
**When:** After March 6 validates the core loop. This is the Bible's highest-priority unbuilt capability.
**Gated by:** March 6 proving that (a) guests engage and (b) the performer dashboard is usable during a live set.

**Why this is Cycle 2 (not Personal Messages):** The Product Bible's go-to-market strategy (silent deploy → deliver a gift) depends on being able to tell the performance story. Guest requests alone show *what was requested*. Musician logging shows *what happened*. The combination is the gift. Personal messages ("This is our anniversary song!") are delightful but don't serve the core thesis of making entertainment spending defensible.

### 2.1 Pre-Set Logging

| Detail | Value |
|---|---|
| **What** | 1-2 minute setup before performing: venue, date, setlist, song tagging |
| **Tagging** | Energy level (Ambient/Medium/High), repertoire type (Instrumental/Vocal-forward/etc.) |
| **DB** | New tables for setlists, song tags, performance sessions |
| **Scope** | Medium — new database schema, new dashboard UI section |

### 2.2 Between-Song Logging

| Detail | Value |
|---|---|
| **What** | Quick-tap logging between songs: quality, volume, guest acknowledgment |
| **Constraint** | 5-7 seconds maximum — non-negotiable. Three binary/ternary inputs. |
| **Design note** | The time constraint is sacred; the specific inputs are negotiable. If real-world testing shows 5-7 seconds is too slow, reduce inputs rather than expand time. |
| **Scope** | Medium — new UI component, needs real-world UX validation |

### 2.3 Post-Set Logging

| Detail | Value |
|---|---|
| **What** | 2-3 minute debrief after performing: deviations, walkups, tips, staff feedback, overall feel |
| **Scope** | Medium — form UI, new database columns |

---

## Cycle 3 — The Gift (Post-Service Summary)

**Goal:** Generate the deliverable that makes the silent-deployment strategy work.
**When:** After Cycle 2 provides musician logging data to combine with guest engagement data.
**Gated by:** At least 2-3 gigs with full logging to have enough data for a meaningful summary.

| Detail | Value |
|---|---|
| **What** | Compiled narrative summary combining guest engagement (Stream 1) + musician observations (Stream 2) |
| **Format** | Readable one-page document, not a dashboard or spreadsheet |
| **V1** | Manually templated with data auto-populated. Full AI generation is a later optimization. |
| **Delivery** | Email or PDF — the "unexpected gift" described in the Product Bible |
| **Unlocks** | The entire go-to-market strategy. This is how entertainment spending becomes visible. |

**Note:** Until this is built, summaries are compiled manually after each gig. The manual version is sufficient for early deployments — the bar is zero (venues currently receive no data at all).

---

## Cycle 4 — Look Back

**Goal:** View and export past gig data. Turn raw requests into shareable records.
**When:** After ~5 gigs of data with vibes, played status, and logging.

### 4.1 Session History

| Detail | Value |
|---|---|
| **What** | New page listing all past gigs with stats. |
| **Route** | `/performer/history` |
| **List view** | Each gig shows: date, venue, total requests, played count, response rate, vibe breakdown. |
| **Detail view** | Tap a gig to see full request list (pending + played, timestamps, messages, vibes). |
| **Future** | Session reactivation for residencies (reuse a gig and keep building on its data). |

### 4.2 Export to CSV

| Detail | Value |
|---|---|
| **What** | Download a formatted report for any gig. |
| **Route** | `GET /api/gig/export?gigId=xxx` (auth-gated). |
| **Output** | Header (venue, date), stats section (request count, vibe %, response rate), full request list. |
| **Filename** | `LiveRequest-VenueName-2026-03-06.csv` |

---

## Cycle 5 — Understand Your Audience

**Goal:** Turn accumulated data into actionable insights.
**When:** After ~10+ gigs of data. Charts need enough data points to be meaningful.

### 5.1 Analytics Dashboard

| Detail | Value |
|---|---|
| **Route** | `/performer/analytics` |
| **Metrics** | Satisfaction score (0-100, weighted vibe calc), response rate (played/total), requests per hour, peak hour, positive feedback rate. |
| **Charts** | Satisfaction gauge, vibe distribution bar chart, satisfaction trend line across sessions, session performance table. |
| **Filtering** | By time period (7d, 30d, 3mo, all time) and by venue. |

### 5.2 AI-Generated Insights

| Detail | Value |
|---|---|
| **What** | Auto-generated insight cards highlighting patterns in your data. |
| **Examples** | Best-performing venue, most responsive venue, peak performance time, satisfaction trends. |
| **Implementation** | Could use an LLM API call on aggregated stats, or rule-based pattern detection for V1. |
| **Depends on** | Enough data to make insights meaningful (10+ gigs minimum). |

---

## Slot Anywhere — Personal Messages

**Goal:** Make requests more personal and meaningful.
**When:** Low-effort enrichment — slot into any cycle gap when there's a quiet week. Not blocking anything.

### Personal Messages

| Detail | Value |
|---|---|
| **What** | Optional text input on song request: "This is our anniversary song!" |
| **DB** | Add `message text` column to `song_requests` (nullable, max ~200 chars). |
| **Audience UI** | Small text input below the song card or on the confirmation step. |
| **Performer UI** | Show message below song title in the request queue. |
| **Scope** | 1 migration, song card update, queue component update. Small lift. |

---

## Deferred — Not Currently Planned

| Feature | Why deferred |
|---|---|
| **Free-text song requests** | Curated catalog is better UX — no misspellings, no unknown songs, one-tap, automatic dedup/grouping. |
| **Venue presets / gig creation UI** | Supabase dashboard works fine for a solo user. Revisit if multi-performer support is added. |
| **Demo mode** | Only useful if other musicians will use the app. Skip for solo use. |
| **Auto-retry on errors** | Manual "tap to retry" is deliberate — auto-retry causes ghost state bugs. |
| **Guest count / venue revenue fields** | Nice-to-have business metrics. Add to gig creation when an admin UI is built. |
| **Session reactivation** | Useful for residencies but not critical. Can add to session history later. |
| **Venue dashboard** | Read-only engagement view for venue contacts. Requires summary template system and access controls. Build after the gift proves venues want this data. |
| **POS correlation layer** | Stream 3 in the Product Bible. Requires venue opt-in and trust. Only offered after Streams 1+2 prove their value. |
| **Cross-venue analytics** | Requires multi-venue deployment and sufficient data volume. |
| **Guest profiles / preference memory** | Requires repeat guest identification mechanism. |
| **Multi-performer support** | Requires team management, shared event sessions. |

---

## Guiding Principles

1. **The Bible governs.** This roadmap is the tactical execution of the [Product Bible](product-bible.md). If there's a conflict, the Bible wins.

2. **Data capture before data display.** Every gig without the right columns is data lost forever. Capture changes always come before display changes.

3. **One concern per cycle.** Each cycle has a clear theme. Don't mix architectural fixes with new features.

4. **Validate with real gigs.** Ship a cycle, run 1-2 gigs with it, observe what works, then move to the next cycle. Don't build analytics before you have data to analyze. (Product Bible Principle 7)

5. **Keep the audience UX effortless.** No downloads, no accounts, no forms. Every feature addition should maintain the one-tap simplicity.

6. **Curated > free-form.** The fixed song catalog is a feature, not a limitation. It gives the performer control and the audience speed.

7. **The gift is the strategy.** Every cycle should move closer to being able to deliver the post-service summary — the deliverable that makes silent deployment work.
