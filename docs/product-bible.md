# LiveRequest™ — Product Bible

**Version:** 1.0
**Status:** Pre-Deployment (Both streams functional, production deployment pending)
**Stack:** Next.js · Supabase (Postgres + Realtime) · Vercel (planned)
**Last Updated:** March 1, 2026

---

## What This Document Is

This is the single source of truth for what LiveRequest is, why it exists, how it works, what it can do now, and what it will do next. It serves two purposes simultaneously: a product vision that captures the philosophy and intent behind every design decision, and a technical reference that reflects the actual shipped state of the application. If something is described here as built, it's built. If it's described as future, it's labeled as such.

---

## The Problem

The performance is invisible to the people paying for it.

The person who books live music — whether that's an F&B director, an event planner, a venue manager, or a private client — almost never witnesses the full performance. They approve the budget, confirm the date, and then rely on anecdotal evidence ("I think people liked it" or "no complaints") to determine whether the investment worked. There's no data, no feedback loop, no way to compare one night to another, and no language to articulate what "good" even means beyond "nobody complained."

Meanwhile, the musician performing has an enormous amount of real-time intelligence — what songs landed, how the room's energy shifted, whether guests were engaged or checked out, what requests came in, how volume felt — but none of that information is captured, structured, or communicated to the decision-maker.

Every other line item in a venue's budget has data behind it. Menu pricing has food cost ratios. Staffing has labor models. Marketing has impressions and conversions. Entertainment has nothing. The result: entertainment gets treated as a cost center rather than a revenue driver. Programming decisions are made on gut feel, inertia, or whoever's cheapest. Good musicians get commoditized because there's no mechanism to demonstrate their value beyond "the vibe was nice."

**The core thesis:** Entertainment spending becomes defensible when it becomes visible. LiveRequest makes it visible.

---

## The Philosophy

Seven principles define what LiveRequest is, what it isn't, and how every decision gets made.

### 1. Technology as Feature, Not Product

LiveRequest isn't a standalone app seeking users. It's a capability embedded within a live music service. It makes Pacific Flow's offering more valuable — it doesn't exist independently of a real musician playing for real people. The technology serves the performance. The performance doesn't serve the technology.

This distinction prevents the most dangerous misunderstanding: that LiveRequest is a tech startup play. It's not. It's a service enhancement that creates a competitive moat for Pacific Flow Entertainment by making every performance measurable, documentable, and defensible.

### 2. Musician as Primary Sensor

The most sophisticated instrument for reading a room is the human being performing in it. LiveRequest treats the musician's observations as the richest data source — not a secondary input to some algorithm. The app structures what the musician already knows and captures it before it's forgotten.

No survey, no IoT sensor, no third-party analytics tool can replicate what a skilled musician observes in real time: the energy shift when a specific song starts, the table that leans in, the bartender who nods, the moment the room goes from background-listening to actively engaged. LiveRequest makes that observation structured and persistent.

### 3. Correlation, Not Causation

LiveRequest will never claim "this song increased revenue by 12%." It identifies patterns — "when we played bolero repertoire, engagement scores were higher and the room felt different" — and lets the decision-maker draw conclusions. Intellectual honesty about what data can and can't prove is baked into the design.

The fastest way to kill credibility with an F&B director or marketing lead is to overclaim. They understand data. They'll respect a system that says "here's what we observed" far more than one that says "here's what we proved."

### 4. Zero Friction for Guests

No app download. No account creation. No login. Scan a QR code, interact, done. The threshold for participation has to be essentially zero, because guests are there to enjoy a meal or celebration — not to use software. Total time investment: under 30 seconds. The QR code is an invitation, not a requirement — and the act of choosing to participate is itself a signal of engagement.

### 5. Zero Disruption for Musicians

If data capture interrupts the performance, the product has failed. Between-song logging must take 5-7 seconds maximum. Pre-set and post-set logging should take 1-3 minutes each. The musician's job is to play beautifully and read the room — everything else is secondary.

This constraint is non-negotiable. It shapes every interface decision: tap-based inputs, binary or three-option choices, pre-loaded information that reduces in-the-moment decisions to confirmations rather than compositions.

### 6. Prove Value by Delivering It, Not Promising It

LiveRequest is deployed silently and its output delivered as an unexpected gift — a summary the client didn't ask for and didn't know was possible. This creates a moment of surprise and demonstrates capability rather than selling a feature.

The moment you pitch LiveRequest as a feature in a proposal, it becomes a promise. Promises create expectations. Expectations create evaluation criteria you don't control. Instead: deploy, capture, deliver. Show, don't pitch. The product earns its way into the relationship rather than being sold into it.

### 7. Build Only What's Validated

No speculative feature development. Each phase of LiveRequest is gated by real-world usage proving the previous phase matters. The Google Form version had to prove guests would engage before a custom app got built. The custom app has to prove pattern data is useful before POS integration gets pursued. Every level of technical sophistication must be justified by demonstrated demand from the previous level.

---

## How It Works

LiveRequest operates through two parallel data streams that, when combined, create a picture neither could produce alone. A future third stream becomes available only with venue cooperation.

### Stream 1: Guest Engagement (Outward-Facing)

**The mechanism:** Each performance gets a unique URL — `/r/[slug]` — served via QR code placed in the performance area (table tent, standing sign, or integrated into venue materials). Guests scan with their phone camera. No app download. No account creation. No login.

**Current state:** Routing is currently hardcoded to `/r/alejandro`. Dynamic slug generation per venue or per event is the target architecture — the `[slug]` routing is built, but slug management (creating, assigning, and switching between slugs) is not yet implemented.

**What guests see and can do:**

- A curated song list with search functionality — browse and request songs in real time
- **Vibe feedback** — three sentiment options: 🔥 (fire/loving it), ⚡ (more energy), and 🌙 (softer please). These aren't arbitrary. They map to the three actionable signals a musician can actually respond to mid-performance: keep doing this, push harder, or pull back. Any more granularity would be unusable in real time. Any less would be meaningless. Three options also keep guest interaction to a single tap — no deliberation, pure instinct.
- Confirmation overlay with haptic feedback — tactile acknowledgment that their request was received
- Request limits — prevents spam while keeping the experience open (guards against one guest monopolizing the queue)

**What this captures:**

- Volume and nature of requests (what do guests actually want to hear?)
- **Vibe signal distribution** — the ratio of fire/energy/softer responses is your first real piece of sentiment data. A night that's 80% fire and 20% more-energy tells a fundamentally different story than one that's 50% softer. Over multiple performances, vibe patterns reveal whether your programming calibration is right for a given room.
- Engagement patterns (when during the evening are people most interactive?)
- Request timing (which parts of the set generate the most participation?)

**The guest experience:** Scan → browse → request or send a vibe → feel the haptic confirmation → return to their evening. The QR code is an invitation, not a requirement. Data from guests who choose to participate is itself a signal — the participation rate is a metric.

**Technical reality (current build):**

- Slug-based routing (`/r/[slug]`) serves venue-specific or event-specific request interfaces
- Song list with real-time search
- Request submission with confirmation overlay and haptic feedback
- Request limiting (double-tap guards, rate limiting)
- Input validation and sanitization
- Supabase Postgres backend with Row Level Security (RLS) policies

### Stream 2: Musician Intelligence (Inward-Facing)

**The mechanism:** A performer dashboard at `/performer/dashboard` — the musician's real-time command center during performance.

**What the performer sees and can do:**

- **Pending requests section:** Incoming guest requests appear in real time as they're submitted
- **Played section:** Requests that have been fulfilled, with mark-as-played functionality
- **Undo capability:** Accidentally marked something as played? Reverse it
- **QR display:** Show or share the QR code for the current session directly from the dashboard
- **Wake lock:** Screen stays on during performance — no dimming, no sleeping, no missed requests
- **Connection indicator:** Visual confirmation that the real-time stream is active and healthy

**Real-time architecture:**

- Supabase Postgres Changes subscription pushes new requests to the dashboard instantly
- Deduplication handling prevents duplicate display
- Reconnect handling maintains the stream through network interruptions
- JWT authentication secures the performer session

**Future musician logging (not yet built — roadmap item):**

The original LiveRequest spec defines three logging windows that will be integrated into the performer dashboard:

*Pre-Set Logging (1-2 minutes before performing):*
- Venue selection (loads venue-specific defaults and history)
- Date/time (auto-populated)
- Setlist loading or building
- Song-level tagging: energy level (Ambient, Medium, High) and repertoire type (Instrumental, Instrumental with vocals, Vocal-forward, Traditional/Cultural, Contemporary/Covers)

*Between-Song Logging (5-7 seconds maximum — non-negotiable constraint):*
- Song quality: Off / Fine / Locked In
- Volume calibration: Too Loud / Right / Too Soft
- Guest acknowledgment: Yes / No (visible or audible room response)

**Design note:** The 5-7 second ceiling is a design constraint, not a solved problem. Three binary/ternary inputs in 5-7 seconds is the hypothesis — it needs to be validated through actual performance use. If real-world testing shows it takes 10-12 seconds or disrupts flow, the inputs get reduced (possibly to a single composite "how did that land?" tap) rather than the time expanding. The constraint is sacred; the specific inputs are negotiable.

*Post-Set Logging (2-3 minutes after performing):*
- Setlist deviations from plan (what changed and why)
- Walkup count (guests who physically approached the performer)
- Tips received (yes/no — not amount)
- Manager or staff feedback (any comments from venue team)
- Overall set feel: Off Night / Fine / Felt It
- Complaints received (yes/no)
- Free-form observations

### Stream 3 (Future — Requires Venue Cooperation): Venue Outcome Data

This stream is not part of the current build. It becomes available only when a venue voluntarily shares operational data they already generate.

**What it would include:**
- Date
- Music night vs. no-music night (control comparison)
- Covers (guest count)
- Total sales
- Average check
- Table turn time (if tracked)

**What it enables:** The musician data tells you *why* the room felt different. The venue data tells you *what* changed in measurable terms. Cross-referencing the two creates the closest thing the industry has to entertainment ROI — not as a hard number, but as a pattern that decision-makers can evaluate.

**Why it's gated:** Asking a venue for POS data before they trust you is a relationship violation. This only gets offered after the venue has seen the value of Streams 1 and 2 and wants to go deeper.

---

## The Tagging Taxonomy (Designed — Not Yet in Database or UI)

The following taxonomy is the target classification system for when musician logging is built into the dashboard. It defines the structured vocabulary that will make cross-performance pattern analysis possible. None of this is currently implemented in the app — it's the spec for Stream 2's logging interface.

Every performance will be tagged across four dimensions:

**Configuration:** Solo, Duo, Trio, Full Ensemble (4+)

**Genre/Style:** Spanish/Classical Guitar, Baja-Coastal, Bolero/Romántico, Flamenco, Mariachi, Latin Jazz, Bossa Nova, Contemporary Latin, Custom

**Energy Level:** Ambient, Medium, High

**Repertoire Type:** Instrumental, Instrumental with vocals, Vocal-forward, Traditional/Cultural, Contemporary/Covers

Over time, this taxonomy enables queries like: "On nights with ambient-energy instrumental duos, what was the average engagement rate compared to high-energy vocal-forward trios?" That kind of analysis is impossible without structured tagging from the start.

---

## The Output: What Decision-Makers Will Receive

### The Vision (When Both Streams Are Active)

The end-state deliverable is a **post-service summary** — a compiled, narrative-style report that synthesizes guest engagement data and musician observation logs into something readable and actionable.

This isn't a spreadsheet. At full capability, it's a document that says something like:

*"During Friday's 6-9 PM service, 23 guests engaged with LiveRequest. The most-requested genre was bolero, with 'Bésame Mucho' appearing 4 times. Engagement peaked between 7:15-8:00 PM, which aligned with the transition from early diners to the second seating. The musician noted the room shifted from ambient to interactive around 7:30 when a table of six began making requests. Volume was calibrated correctly throughout — no complaints, two compliments to the bartender about the music. Overall set feel: Locked In."*

That paragraph contains more actionable intelligence about entertainment value than most venues have ever received from any provider. It transforms a musician from "the guitar guy on Fridays" into a programming partner who provides measurable insight.

**This summary format is not yet built.** It requires Stream 2 (musician logging) to be integrated into the dashboard, plus a summary generation layer. Both are on the roadmap.

### What the Gift Looks Like Today (Stream 1 Only)

With only guest engagement data (requests + vibe feedback), the first deliverable is simpler but still unprecedented in this industry. No venue has ever received *any* structured data about guest interaction with live entertainment. The bar is zero.

**What you can deliver now, manually compiled:**

- Total guest engagements for the performance period
- Most-requested songs (ranked)
- Request timing patterns (when during the set guests were most active)
- Vibe feedback distribution (how many guests sent fire/more energy/softer signals)
- Peak engagement windows
- Any notable patterns (e.g., "requests clustered around the 7:30-8:00 window" or "bolero repertoire generated 3x the requests of bossa nova")

**The format:** A short, manually written narrative (email or one-page document) that presents this data in plain language. Not a dashboard. Not a spreadsheet. A readable summary that a venue manager can scan in 60 seconds and immediately understand.

**Why this still works:** The silent deployment philosophy doesn't require a polished automated report. It requires a surprising delivery of insight the venue didn't expect. A manually compiled summary of guest engagement data clears that bar — because the current bar is nothing.

---

## Current Build State

### What's Shipped (Functional, Pre-Deployment)

| Component | Status | Details |
|-----------|--------|---------|
| Guest request interface | ✅ Functional | `/r/alejandro` (hardcoded slug) — song list with search, request limits, confirmation overlay, vibe feedback (🔥/⚡/🌙), haptics |
| Performer dashboard | ✅ Functional | `/performer/dashboard` — pending/played sections, mark-as-played, undo, QR display, wake lock, connection indicator |
| Real-time stream | ✅ Functional | Supabase Postgres Changes subscription with deduplication and reconnect handling |
| Security layer | ✅ Functional | RLS policies, JWT auth, input validation, double-tap guards |
| Database | ✅ Functional | Supabase Postgres with structured schema |

### What's Next (Roadmap)

| Component | Priority | Dependencies |
|-----------|----------|--------------|
| Production deployment | **Immediate** | Vercel deployment, domain configuration, environment variables |
| Dynamic slug management | **Immediate** | Admin interface for creating/assigning/switching slugs per venue or event |
| Musician logging (pre/between/post-set) | High | Requires dashboard UI expansion, new database tables, UX validation of 5-7 second constraint |
| Post-service summary generation | High | Requires logging data + engagement data aggregation |
| Venue dashboard (read-only engagement view) | Medium | Requires summary template system, access controls |
| POS correlation layer | Low | Requires venue opt-in, data import pipeline |
| Cross-venue analytics | Future | Requires multi-venue deployment, sufficient data volume |
| Guest profiles and preference memory | Future | Requires repeat guest identification mechanism |
| Multi-performer support | Future | Requires team management, shared event sessions |

---

## What LiveRequest Is NOT

These boundaries are deliberate and permanent:

- **Not a tipping platform.** Tips are between the guest and the musician. LiveRequest doesn't intermediate that transaction.
- **Not a review system.** It captures real-time sentiment during the experience, not retrospective judgment after it.
- **Not a marketplace.** It doesn't connect musicians with venues. It enhances an existing booking relationship.
- **Not a standalone product seeking users or acquisition.** It's a feature of a service business, designed to make that service more valuable.
- **Not a surveillance tool.** Musician logging is self-reported observation, not monitoring. Guest participation is voluntary. Venue data sharing is opt-in.
- **Not a replacement for reading the room.** Technology captures what the musician already knows. It doesn't substitute for the skill of performing.

---

## Language Discipline

The product has a tiered language framework governing what can be claimed at each stage. This discipline protects credibility — the fastest way to kill a data product is to overclaim before the data supports it.

### Now (Current Build — Safe to Claim)

- "QR-enabled song requests and feedback"
- "Real-time guest engagement"
- "Guest vibe capture" (three-option sentiment: fire/more energy/softer)
- "Request pattern tracking"

### Soon (In Active Development)

- "Post-service summary insights"
- "Structured performance logging"
- "Consistent engagement reporting across nights"
- "Energy and repertoire pattern analysis"

### Later (Only When Demonstrably True)

- "Correlates with dwell time and spend"
- "F&B lift analysis"
- "Cross-venue programming intelligence"

### Never (Until Built, Deployed, and Proven)

- Automated ROI reporting
- Revenue attribution
- Statistical proof of lift
- Specific revenue percentage guarantees
- "AI-powered" (unless actual AI capabilities are integrated and functional)

---

## Deployment Philosophy

### Silent Deployment

Deploy LiveRequest at every performance. Don't ask permission. Don't mention it in proposals or outreach. The value is proven by delivery, not promised in pitch.

**During performance:** QR code is present. Guests interact or don't. Data accumulates.

**After a performance period:** Deliver an engagement summary as an unexpected gift — a document the venue contact didn't ask for and didn't know was possible.

**The script:**

> "I tracked guest engagement throughout the pilot using my LiveRequest system — song requests, feedback, sentiment patterns. Attached is a summary of what I noticed. If it's useful for your team, great. If not, no worries — I wanted you to have it either way."

**If they want more:**

> "If you're curious whether certain programming correlates with guest spend, I can show you that too. I'd just need your nightly POS data for the tables that engaged. If that's more than you want to track, no problem — the pilot works either way."

### When to Mention LiveRequest

- **Never** in initial outreach emails
- **Never** in proposals or one-sheets
- **Never** to venue contacts during relationship formation
- **Only** after a performance period, as a delivered gift
- **Only** in conversations where the venue has expressed interest in measurement
- **Exception:** Conversations with data-literate contacts (marketing directors, revenue managers) where measurement capability is a strategic differentiator — but even then, describe it as "a guest engagement system that captures real-time data" not as an AI-powered dashboard

---

## Research Context

Industry research validates the thesis that LiveRequest is designed to test at specific properties:

| Metric | Industry Finding | Source |
|--------|------------------|--------|
| Per-table spending | 20-30% increase with live music | Case studies |
| Dwell time | 80% of guests stay longer | BMI/NRG 2023 |
| Additional purchases | 60% buy more F&B | BMI/NRG 2023 |
| Brand-fit music lift | 9.1% sales increase | HUI Research |
| Random music decline | 4.3% sales drop vs. silence | HUI Research |

**How to use this research:** As context for why measurement matters, never as a promise of what LiveRequest will prove. The research explains the *hypothesis*. LiveRequest tests whether it holds at a specific property with specific programming.

**The conversation pivot:**

> "I can't promise you'll see exactly what the research shows. Every property is different. What I can do is run a pilot and actually measure guest engagement — requests, feedback, what's resonating. Then you have your own data, not industry averages."

---

## The Competitive Dimension

No competitor in the live entertainment market — agency, independent musician, or band — offers anything like this. Entertainment booking is universally a black box: book, pay, hope it went well. LiveRequest transforms entertainment from a soft expense that's hard to justify into a documented investment with visible returns.

The honest caveat: this is a differentiator in concept that is now being validated in code. The hypothesis is that venues will value this data. That hypothesis needs validation through deployment, which is why the silent-deployment-then-gift strategy exists — it lets the product prove itself without requiring the venue to believe in it upfront.

---

## The Bigger Vision

At scale, LiveRequest creates something that doesn't exist in live entertainment: a structured performance intelligence layer. Over time, with enough data across enough venues and enough configurations, you can answer questions like:

- What programming style produces the highest guest engagement in fine-dining contexts?
- Does energy level correlate with dwell time in lounge settings?
- Which repertoire types generate the most walkups?
- How does ensemble configuration affect average check?
- What time windows generate peak engagement across venue types?

No one in the live entertainment space is capturing this data systematically. The long-term competitive moat isn't the QR code itself — it's the compounding intelligence generated over hundreds of performances across dozens of venues. That intelligence informs better programming decisions, which produces better outcomes, which generates more data, which compounds further.

The technology serves the music. The music generates the data. The data improves the programming. The cycle continues.

---

## Integration Points

### Setlist Architect (Future)

When Setlist Architect reaches production, LiveRequest request data feeds back into song intelligence: "Bésame Mucho requested 47 times at weddings" becomes actionable programming data. Requests that match the repertoire get flagged. Requests for songs not in the library generate a "most requested songs I don't play" report.

### Client Portal (Future)

Post-event LiveRequest summaries surface in the client portal — the client logs in and sees what their guests loved. This closes the loop: intake → planning → performance → measured outcome, all in one place.

### Pacific Flow Team Expansion (Future)

When Pacific Flow scales beyond Alex as sole performer, LiveRequest provides consistent data capture across all team members. The methodology standardizes quality. The data proves it.

---

## Cross-Reference (Pacific Flow Project Files)

These are files in the Pacific Flow Entertainment Claude Project that contain related information:

| Need | File |
|------|------|
| F&B research and positioning claims | Strategic_Positioning |
| Conversation ammunition and templates | Copy_Bank |
| Programming details and pricing | Programming_Catalog |
| Venue relationships and contacts | Contacts_CRM |
| Venue-specific deployment strategy | Venue_Playbooks |
| Current tasks and deadlines | Action_Tracker |
| Ready-to-send outreach | Outreach_Drafts |
