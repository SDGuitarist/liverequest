# Brainstorm: Deploy LiveRequest to Vercel

**Date:** 2026-02-28
**Status:** Complete
**Next phase:** Plan

## What We're Building

Deploy LiveRequest (Next.js 16 + Supabase) to production on Vercel so it can be used at live gigs. This includes fixing the in-memory auth token blocker, configuring environment variables, and verifying the app works end-to-end in a production environment.

## Why Now

All feature tracks are complete (design polish Phases A-D, security/reliability fixes). The app only runs locally. To use it at a real Pacific Flow Entertainment gig, it needs to be live on the internet with a URL audiences can visit.

## Key Decisions

### 1. Auth Token Fix: Cookie-based sessions
**Decision:** Replace the in-memory `Set<string>` token store with signed HTTP-only cookies.

**Why:** The in-memory store resets on every Vercel serverless cold start, logging the performer out constantly. Cookies travel with the request — no database needed, no latency penalty, ~30 lines of code. Industry-standard for single-user password gates.

**Rejected alternatives:**
- **Supabase Auth** — Full auth system. Robust but massive rework for a single-performer MVP. Right move later if multi-performer support is added.
- **Database-backed tokens** — Keeps current flow but adds a Supabase table, DB round-trip on every request, and session cleanup maintenance. Cookies give this for free.

### 2. Domain: Vercel subdomain (for now)
**Decision:** Use the free `liverequest.vercel.app` (or similar) subdomain. Custom domain can be added later.

**Why:** Instant, free, zero config. No reason to buy a domain before validating the app works at a real gig.

### 3. Supabase: Same project for dev and prod
**Decision:** Keep using the current Supabase project for both local development and production.

**Why:** Simpler setup. One set of keys, schema already applied. Can split into separate projects later if needed.

### 4. Performer password
**Decision:** Must be changed from `changeme` before going live. Add as an explicit step in the deployment plan.

## Deployment Checklist (High-Level)

1. Fix auth token blocker (cookie-based sessions)
2. Confirm Supabase schema is applied (should already be done if using existing project)
3. Create Vercel project and connect GitHub repo (`SDGuitarist/liverequest`)
4. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PERFORMER_PASSWORD` (set a strong password — not `changeme`!)
   - `COOKIE_SECRET` (new, for signing session cookies)
5. Deploy and verify:
   - Audience request page loads at `/r/alejandro`
   - QR code generates correct production URL
   - Performer login works and persists across page loads
   - Song requests flow through in realtime
   - RLS policies work correctly in production

## Scope Boundaries (YAGNI)

**In scope:**
- Auth fix (cookie sessions)
- Vercel deploy + env vars
- End-to-end verification

**Out of scope (do later):**
- Custom domain
- Separate Supabase prod project
- CI/CD pipeline
- Monitoring/alerting
- Multi-performer support
- Analytics

## Open Questions

None — all questions resolved during brainstorm.

## Feed-Forward
- **Hardest decision:** Auth token fix approach. Cookie-based sessions won because they're the simplest solution that works with serverless, but they're not revocable server-side (you can't force-logout a session without adding a blocklist).
- **Rejected alternatives:** Supabase Auth (overkill for MVP), database-backed tokens (unnecessary complexity when cookies work).
- **Least confident:** Whether the cookie signing approach will work seamlessly with Next.js 16's server components and API routes — need to verify the cookie is accessible in both contexts during implementation.
