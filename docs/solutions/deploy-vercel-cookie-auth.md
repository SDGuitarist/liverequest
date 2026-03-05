---
title: "Deploy to Vercel — Cookie Auth Migration"
date: 2026-03-05
category: deployment
tags:
  - deployment
  - auth
  - jose
  - cookies
  - vercel
  - security
severity: critical (blocker)
component:
  - lib/auth.ts
  - app/api/auth/route.ts
  - lib/env.ts
  - next.config.ts
  - .env.example
resolution_time: "~2 sessions"
related_issues:
  - "in-memory-token-cold-start-blocker"
  - "timing-safe-password-comparison"
  - "hsts-header-missing"
commits: ["deployed to liverequest.vercel.app"]
---

# Deploy to Vercel — Cookie Auth Migration

## Problem

LiveRequest was stuck on localhost. The in-memory `Set<string>` token store in `lib/auth.ts` reset on every Vercel serverless cold start, making the performer dashboard unusable in production — the performer would be logged out constantly.

Secondary issues discovered during planning (via deepened research agents):
- Password comparison leaked password length via `timingSafeEqual` short-circuit
- No HSTS header (first HTTP request vulnerable to cookie interception)
- `.env.example` shipped with `changeme` as default password

## Solution

### Auth: In-memory tokens -> jose JWT cookies

Replaced the `Set<string>` token store with stateless JWT cookies using the `jose` library (HS256). This is the approach recommended by the Next.js official authentication guide.

**Key design choices:**
- `jose` over raw `crypto.createHmac` — works in Edge Runtime, handles timing-safe comparison and expiration internally, ~4KB with zero deps
- `sameSite: "lax"` over `"strict"` — allows cookie on bookmarks/shared links (strict blocks the cookie on cross-site top-level navigations, forcing re-login)
- 24-hour expiration — covers a full gig day with margin
- `COOKIE_SECRET` via `requireEnv()` at module level — fails fast at startup

**What changed:**
| File | Change |
|------|--------|
| `lib/auth.ts` | Full rewrite: `SignJWT`/`jwtVerify` replace `Set<string>` |
| `app/api/auth/route.ts` | `signSessionCookie()` replaces `createAuthToken()`, HMAC-both-sides password comparison, `sameSite: "lax"` |
| `lib/env.ts` | Added `COOKIE_SECRET` |
| `next.config.ts` | Added HSTS header |
| `.env.example` | All 5 vars documented with empty values |

### Deploy: Vercel project + env vars

Connected GitHub repo, set 5 environment variables, deployed via `npx vercel --prod`. No `vercel.json` needed — Vercel auto-detects Next.js.

### Verification: All 6 check groups passed

Audience page, performer login (with persistence across refresh), auth rejection, song request flow, QR code URLs, and security headers — all verified on the live URL.

## Why This Approach Won

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **jose JWT cookies** | Next.js recommended, Edge-safe, standard claims, ~20 lines | Async sign, not revocable server-side | Chosen |
| Raw `crypto.createHmac` | No dependency | Breaks in Edge Runtime, custom format, ~55 lines | Rejected |
| Static HMAC cookie | Simplest possible | No server-side expiration | Rejected |
| Supabase Auth | Full auth system | Massive rework for single-performer MVP | Rejected |
| DB-backed tokens | Revocable | DB round-trip on every request, cleanup maintenance | Rejected |

## Risk Resolution

**Brainstorm risk:** "Whether the cookie signing approach will work seamlessly with Next.js 16's server components and API routes."

**Plan mitigation:** Architecture review confirmed `cookies()` from `next/headers` already worked in both contexts. Using `jose` also resolved the Edge Runtime concern (`crypto.createHmac` doesn't work there).

**What actually happened:** No issues. `cookies()` worked identically in Server Components (`performer/dashboard/page.tsx`) and API routes (`api/auth/route.ts`, `api/gig/*`). The feed-forward risk was fully resolved before implementation even started.

**Plan risk #2:** "`jose` `sign()` async latency."

**What actually happened:** Negligible. HMAC-SHA256 is ~0.01-0.05ms. The async wrapper adds no perceptible latency.

**HANDOFF risk:** "Shared dev/prod Supabase project creating test requests visible on live dashboard."

**Status:** Acknowledged, mitigated by single active gig. Will revisit if it causes issues at The Blue Note gig (March 6).

**Lesson learned:** Feed-forward risks are worth tracking even when they resolve easily — they document *why* you're confident, not just *what* you did.

## Patterns Worth Reusing

1. **`jose` for stateless auth in Next.js on Vercel** — proven pattern, use again for any future auth needs
2. **HMAC-both-sides for password comparison** — eliminates length leaks without complex padding
3. **`requireEnv()` at module level** — fail-fast pattern catches missing env vars at startup, not at runtime
4. **Three-phase deploy (fix -> deploy -> verify)** — each phase independently verifiable, easy rollback between phases
5. **Deepened plan with research agents** — caught the Edge Runtime blocker, timing leak, and HSTS gap before any code was written

## Known Limitations (Accepted)

- No session revocation (rotate `COOKIE_SECRET` as workaround)
- 60-second ISR stale window on audience page
- No rate limiting on `/api/auth`
- Shared dev/prod Supabase project
- No custom domain (using Vercel subdomain)
- No CI/CD pipeline (manual deploy)
