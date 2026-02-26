# LiveRequest MVP Brainstorm

**Date:** 2026-02-26
**Author:** Alejandro Guillen + Claude
**Project:** LiveRequest — Audience Song Request Platform
**Company:** Pacific Flow Entertainment

---

## The Vision

LiveRequest is an audience engagement platform for live musicians. Audiences scan a QR code at a venue, browse the performer's setlist, and request songs — creating a direct connection between performer and crowd.

The long-term moat: this interaction generates data that proves music drives venue revenue (sales lift, guest satisfaction, table turnover). No one is collecting this data today.

**This brainstorm scopes the MVP only.** Everything else is future.

---

## MVP Scope: Song Requests

### What It Does

One thing. Audience members request songs from the performer's setlist.

### What It Doesn't Do (Yet)

- No tipping
- No photos
- No audience feedback (energy/mood)
- No venue ROI dashboards
- No performer analytics beyond basic request counts

### The Audience Experience (3 Steps Max)

1. **Scan** — QR code on a table tent, sticker, or screen at the venue
2. **Browse** — See a beautiful list of songs the performer knows
3. **Tap** — Request a song with a single tap

That's it. No sign-up. No email. No login. No forms. Frictionless.

### Design Principles

These came directly from Alejandro and are non-negotiable:

1. **Make it easy** — If it takes more than 10 seconds, it's too complicated
2. **Make it a great experience** — This should feel fun, not like a chore
3. **Make it all about the audience** — They're the star of this interaction
4. **Make it shareable** — Something they'd want to screenshot or tell a friend about
5. **Make it frictionless** — Zero barriers between "scan" and "done"
6. **Single action = data** — Every song request is a data point (who, what, when)

### The Performer Experience

Alejandro needs a simple view during a gig:

- See incoming requests in real-time
- See which songs are most requested (helps set flow)
- Glanceable — he's playing, not staring at a screen

### Data Captured (Passively, From Day One)

Every request automatically records:

- Song requested
- Timestamp
- Session ID (anonymous unique visitor)
- Gig/venue context

This is the seed data for the future ROI story. No extra work needed — it comes free with the MVP.

---

## Key Decisions

### Start From Scratch

Previous attempts exist in Lovable and Replit (possibly with Supabase). Decision: **start fresh and do it right.** No migration, no legacy baggage.

### Web App, Not Native

QR code links to a web URL. No app store download = zero friction. Works on any phone with a browser.

### Song List Is Curated

Alejandro controls the setlist. Audience picks from what's available — no free-text "play Freebird" chaos.

---

## Open Questions

1. **Tech stack?** Needs to be beginner-friendly, deployable, real-time capable. Candidates: Next.js + Supabase on Vercel, or simpler alternatives.
2. **What happens after requesting?** A confirmation screen? A shareable moment ("I just requested [Song] at [Venue]")? Or just a simple "Got it!" with a checkmark?
3. **Request limits?** Can one person request unlimited songs? One per visit? One at a time?
4. **Song list management?** How does Alejandro add/edit/reorder his setlist? Admin panel or just a config file for MVP?
5. **How does the performer view work during a gig?** Phone propped up? Tablet? Laptop on stage?
6. **Multiple gigs/venues?** Does the MVP need to support different QR codes per venue, or is it one universal link?
7. **What does "shareable" look like concretely?** Social share button? Screenshot-worthy confirmation? A live "now playing" vibe?

---

## Deadline

**March 6th, 2026 — first live test at a real gig.**

8 days. This is the forcing function. The MVP must be deployed, QR code printed, and working on phones by this date.

---

## What's NOT in Scope (Parking Lot)

These are real, valuable ideas. They come after the MVP proves itself live.

- Tipping / payments
- Audience photos
- Energy/mood feedback
- Venue ROI dashboard
- Analytics beyond basic counts
- Multi-performer support
- Branding customization per venue
- Integration with venue POS systems

---

## Feed-Forward

- **Hardest decision:** Cutting everything except song requests. The ROI data story is the long-term moat, but the MVP can't serve two masters. Song requests generate the seed data passively — that's enough for now.
- **Rejected alternatives:** (1) Starting with the venue ROI dashboard — too complex, no audience yet. (2) Building on top of the Lovable/Replit code — tech debt from vibe coding would slow us down more than starting fresh. (3) Including tipping in MVP — adds payment processing complexity and regulatory concerns that could delay March 6th.
- **Least confident:** The "shareable" moment. The design principles say the experience should be something the audience wants to share, but we haven't defined what that looks like concretely. A boring "Request submitted" confirmation wastes the one moment we have the audience's full attention. This needs to be nailed in planning.
