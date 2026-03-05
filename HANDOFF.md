# HANDOFF — LiveRequest

**Date:** 2026-03-05
**Branch:** main
**Phase:** Deploy complete. App is live. Next: Compound phase for deploy, then Cycle 2.

## Current State

LiveRequest is **deployed to production** at **https://liverequest.vercel.app**. All Phase 3 verification checks pass: audience page loads, performer login works with cookie persistence across refreshes, auth rejection works, song request flow verified end-to-end, security headers (HSTS, X-Frame-Options, X-Content-Type-Options) confirmed. First gig is March 6 at The Blue Note.

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm (Cycle 1) | `docs/brainstorms/2026-03-01-cycle1-played-vibes.md` |
| Plan (Cycle 1) | `docs/plans/2026-03-01-cycle1-played-vibes-plan.md` |
| Solution (Cycle 1) | `docs/solutions/cycle1-vibe-review-fixes.md` |
| Brainstorm (Deploy) | `docs/brainstorms/2026-02-28-deploy-vercel-brainstorm.md` |
| Plan (Deploy) | `docs/plans/2026-02-28-feat-deploy-vercel-plan.md` |
| Review Context | `compound-engineering.local.md` |

## Production Details

- **URL:** https://liverequest.vercel.app
- **Vercel project:** `alexguillenmusic-gmailcoms-projects/liverequest`
- **Auth:** `jose` JWT cookies (HS256), 24h expiry, `sameSite: "lax"`
- **Env vars:** 5 set in Vercel (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, PERFORMER_PASSWORD, COOKIE_SECRET)
- **Deploy method:** `npx vercel --prod` or push to `main`

## Deferred Items

- Custom domain (after validating on Vercel subdomain)
- Separate Supabase prod project (using same project for dev/prod for now)
- CI/CD pipeline (manual deploy via push to main)
- Multi-performer support (not needed for solo MVP)
- Dynamic slug management (hardcoded to `/r/alejandro` — breaks at second venue)

## Three Questions

1. **Hardest decision?** Whether the 500 status on raw HTML dashboard requests was a real bug or Next.js streaming behavior. Confirmed it's a Next.js 16 `force-dynamic` quirk — RSC protocol returns 200, browser renders correctly, all functionality works.
2. **What was rejected?** GitHub-connected auto-deploy (used CLI `vercel --prod` instead for immediate control). Also considered separate Supabase prod project — deferred as unnecessary for solo MVP.
3. **Least confident about?** Whether the shared dev/prod Supabase project will cause issues during the gig (e.g., local dev creating test requests that appear on the live dashboard). Mitigated by only having one active gig at a time.

## Prompt for Next Session

```
Read HANDOFF.md for context. This is LiveRequest, a live musician song request app.
App is deployed at https://liverequest.vercel.app — all verification checks passed.
First gig is March 6 at The Blue Note. Run the Compound phase for the deploy work,
then decide on next cycle (Cycle 2: Musician Intelligence, or dynamic slug management).
```
