# HANDOFF — LiveRequest

**Date:** 2026-03-05
**Branch:** main
**Phase:** Deploy compound complete. All cycles documented. Ready for next feature.

## Current State

LiveRequest is **deployed and live** at **https://liverequest.vercel.app**. Deploy compound phase complete — solution doc written, learnings propagated. First gig is March 6 at The Blue Note. All Cycle 1 features (mark as played, vibe feedback, optimistic UI) and deploy work are shipped and documented.

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm (Cycle 1) | `docs/brainstorms/2026-03-01-cycle1-played-vibes.md` |
| Plan (Cycle 1) | `docs/plans/2026-03-01-cycle1-played-vibes-plan.md` |
| Solution (Cycle 1) | `docs/solutions/cycle1-vibe-review-fixes.md` |
| Brainstorm (Deploy) | `docs/brainstorms/2026-02-28-deploy-vercel-brainstorm.md` |
| Plan (Deploy) | `docs/plans/2026-02-28-feat-deploy-vercel-plan.md` |
| Solution (Deploy) | `docs/solutions/deploy-vercel-cookie-auth.md` |
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

1. **Hardest decision?** Whether to use raw HMAC, static HMAC, or `jose` for cookie auth. `jose` won — Next.js recommended, Edge-safe, standard JWT claims with less code.
2. **What was rejected?** Raw `crypto.createHmac` (breaks in Edge Runtime), static HMAC (no server-side expiration), Supabase Auth (overkill for MVP), DB-backed tokens (unnecessary round-trips).
3. **Least confident about?** Whether the shared dev/prod Supabase project will cause issues during the first gig (March 6). Mitigated by single active gig at a time.

## Prompt for Next Session

```
Read HANDOFF.md for context. This is LiveRequest, a live musician song request app.
App is deployed at https://liverequest.vercel.app. Deploy compound phase is complete.
First gig is March 6 at The Blue Note. Decide on next cycle: Cycle 2 (Musician Intelligence)
or dynamic slug management. Check docs/roadmap.md for the full roadmap.
```
