---
title: "Deploy LiveRequest to Vercel"
type: feat
status: active
date: 2026-02-28
deepened: 2026-02-28
origin: docs/brainstorms/2026-02-28-deploy-vercel-brainstorm.md
feed_forward:
  risk: "Cookie signing may not work seamlessly with Next.js 16 server components + API routes"
  verify_first: true
---

# Deploy LiveRequest to Vercel

## Enhancement Summary

**Deepened on:** 2026-02-28
**Sections enhanced:** 7
**Agents used:** security-sentinel, deployment-verification, kieran-typescript-reviewer, architecture-strategist, code-simplicity-reviewer, performance-oracle, pattern-recognition-specialist, best-practices-researcher, Context7 (Next.js 16 docs)

### Key Improvements
1. **Use `jose` library instead of raw HMAC** — Next.js official docs recommend it, it works in Edge Runtime (resolves feed-forward risk), handles timing-safe comparison internally, and is ~4KB with zero dependencies
2. **Added Go/No-Go deployment checklist** with rollback plan and monitoring steps
3. **Added HSTS security header** — one-line addition to `next.config.ts`
4. **Fixed password comparison timing leak** — use HMAC-both-sides approach instead of length-leaking padding

### New Considerations Discovered
- `crypto.createHmac` does NOT work in Vercel Edge Runtime — `jose` avoids this entirely
- `.env.example` should not ship with `changeme` as the password value
- The current timing-safe password comparison leaks password length via short-circuit

---

## Overview

Deploy LiveRequest to production on Vercel so it can be used at live gigs. One code change (replace in-memory auth tokens with signed session cookies using `jose`), then configure Vercel and verify end-to-end.

## Problem Statement / Motivation

The app only runs locally. All feature work is complete (design polish A-D, security/reliability fixes). To use it at a real Pacific Flow Entertainment gig, it needs a public URL audiences can visit. The in-memory auth token store (`Set<string>` in `lib/auth.ts`) resets on every serverless cold start, making the performer dashboard unusable on Vercel (see brainstorm: docs/brainstorms/2026-02-28-deploy-vercel-brainstorm.md).

## Proposed Solution

Three phases, each small and independently verifiable:

1. **Fix auth** — Replace the in-memory token Set with `jose`-signed session cookies (~4 files touched, 1 dependency added)
2. **Deploy** — Create Vercel project, set env vars, push
3. **Verify** — Run the end-to-end checklist from the brainstorm

## Technical Considerations

### Session Cookie Design — `jose` with HS256

**Updated approach (from research):** Use the `jose` library instead of raw `crypto.createHmac`. The Next.js official authentication guide recommends this exact pattern. HS256 (the JWT signing algorithm) IS HMAC-SHA256 under the hood — same cryptographic primitive, but in a standardized wrapper.

**Why `jose` over raw HMAC:**
- Recommended by Next.js official docs ([authentication guide](https://nextjs.org/docs/app/guides/authentication))
- Works in both Node.js serverless AND Edge Runtime (uses Web Crypto API internally)
- Built-in `iat` (issued-at) and `exp` (expiration) claims — no custom timestamp parsing
- Handles timing-safe comparison internally — no manual `timingSafeEqual` needed
- ~4KB, zero dependencies, maintained by a single expert (Filip Skokan)
- Resolves the feed-forward risk: raw `crypto.createHmac` does NOT work in Edge Runtime

**Why NOT raw HMAC (original plan):**
- `crypto.createHmac` fails in Vercel Edge Runtime — if any route ever uses Edge, auth breaks
- Requires designing a custom payload format (`{timestamp}:{nonce}:{hmac}`)
- Manual `timingSafeEqual` with Buffer length guards
- More code to maintain with more room for subtle bugs

**Why NOT a static HMAC (simplest possible):**
- The simplicity reviewer suggested `HMAC("performer")` as a static cookie value
- This works but loses server-side expiration (relies entirely on browser `maxAge`)
- For MVP, this is a valid tradeoff — but `jose` gives us expiration for free with barely more code

### Cookie Configuration

```typescript
cookieStore.set('session', sessionToken, {
  httpOnly: true,      // Prevents JavaScript access (XSS protection)
  secure: true,        // HTTPS only (conditional on NODE_ENV for local dev)
  sameSite: 'lax',     // CSRF protection without breaking navigation
  path: '/',           // Available on all routes
  expires: expiresAt,  // Absolute expiration (24 hours)
});
```

### Research Insights — Cookie Configuration

**sameSite "lax" rationale (confirmed by all reviewers):**
Change from `"strict"` to `"lax"`. With `"strict"`, navigating to `/performer/dashboard` from a bookmark, text message, or email link fails the auth check on first load (cookie isn't sent on cross-site top-level navigations). `"lax"` sends the cookie on GET navigations but still blocks cross-site POST. Since all mutations are POST requests behind auth checks, this is sufficient. Add a code comment explaining this choice.

**Browser defaults:** Since 2020, Chrome and Edge treat cookies without `SameSite` as `Lax` by default. Setting it explicitly is still best practice.

### Architecture — No Server State

After this change, the auth system is fully stateless. No in-memory store, no database table, no session cleanup. The signed cookie IS the session. This is the correct architecture for Vercel serverless.

**Architecture review confirmed:** The change preserves Single Responsibility (lib/auth.ts stays focused), Dependency Inversion (consumers depend on `isAuthenticated()` abstraction), and Separation of Concerns (auth logic stays in lib/auth.ts, Supabase in lib/supabase/). The `validTokens` Set is a Mutable Server Singleton anti-pattern — removing it is the correct fix.

---

## Phase 1: Auth Token Fix (Session Cookies)

### 1.0 Install `jose`

```bash
npm install jose
```

This is the only new dependency. ~4KB, zero transitive dependencies.

### 1.1 Add `COOKIE_SECRET` to environment setup

**Files:**
- `lib/env.ts` — Add `COOKIE_SECRET` to `requireEnv()` usage
- `.env.example` — Add `COOKIE_SECRET` placeholder AND fix `PERFORMER_PASSWORD`
- `.env.local` — Add a local dev secret

**Updated `.env.example` format (from security review):**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Auth
PERFORMER_PASSWORD=              # REQUIRED: set a strong password (16+ chars)
COOKIE_SECRET=                   # REQUIRED: run `openssl rand -base64 32`
```

**Security fix:** Remove `changeme` as the default password value. Empty values cause `requireEnv()` to fail fast instead of silently running with a weak password.

**Secret generation:** Use `openssl rand -base64 32` (produces 44 chars = 32 bytes base64-encoded). This is what the Next.js auth guide recommends. Minimum 32 bytes for HMAC-SHA256 security.

### 1.2 Rewrite `lib/auth.ts`

**Current code** (lines 1-17): In-memory `Set<string>` with `createAuthToken()` and `isAuthenticated()`.

**New code using `jose`:**

```typescript
import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { requireEnv } from '@/lib/env'

const SECRET = new TextEncoder().encode(requireEnv('COOKIE_SECRET'))
const SESSION_DURATION = 24 * 60 * 60 // 24 hours in seconds

export async function signSessionCookie(): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(SECRET)
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const auth = cookieStore.get('performer_auth')
  if (!auth) return false

  try {
    await jwtVerify(auth.value, SECRET, { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}
```

### Research Insights — Implementation Details

**From TypeScript reviewer:**
- Use module-level `requireEnv('COOKIE_SECRET')` — fails fast at startup, not on first login attempt
- Only export `signSessionCookie` and `isAuthenticated` — keep internals private
- `import 'server-only'` prevents accidental client-side import (Next.js convention)

**From pattern recognition:**
- `signSessionCookie()` fits the existing `verbNoun` camelCase convention (`createAuthToken`, `requireEnv`, `getSessionId`)
- `lib/auth.ts` is the correct module — no need for a separate `lib/crypto.ts` (YAGNI)
- The function signature change (`createAuthToken` → `signSessionCookie`) is the only consumer-visible change

**From simplicity reviewer:**
- The `jose` approach is ~20 lines vs the original plan's ~55 lines for raw HMAC
- `jwtVerify` handles timing-safe comparison, expiration checking, and format validation internally — no manual parsing needed
- The `Set<string>` is completely removed — zero server state

**Note:** `signSessionCookie()` becomes async (returns `Promise<string>` instead of `string`) because `jose`'s `sign()` is async. The caller in `app/api/auth/route.ts` already uses `await` in an async handler, so this is a trivial change.

### 1.3 Update `app/api/auth/route.ts`

- Replace `createAuthToken()` call with `await signSessionCookie()`
- Change `sameSite: "strict"` → `sameSite: "lax"` (line 51)
- Use `expires` instead of `maxAge` (Next.js auth guide convention)
- Standardize `PERFORMER_PASSWORD` to use `requireEnv()` at module level instead of manual `process.env` check
- Remove the dynamic `await import("crypto")` — no longer needed since `jose` handles crypto

**Fix password comparison timing leak (from security review):**

The current code at line 27-39 has a length-leak side channel — `a.length === b.length` short-circuits before `timingSafeEqual`. Fix by HMAC-ing both sides before comparing:

```typescript
import { createHmac, randomBytes } from 'node:crypto'

const HMAC_KEY = randomBytes(32) // one-time per process

function constantTimeEqual(a: string, b: string): boolean {
  const hmacA = createHmac('sha256', HMAC_KEY).update(a).digest()
  const hmacB = createHmac('sha256', HMAC_KEY).update(b).digest()
  return timingSafeEqual(hmacA, hmacB)
}
```

Both HMAC outputs are always exactly 32 bytes. No length leak, no padding needed.

**Add sameSite comment (from pattern reviewer):**

```typescript
// "lax" allows the cookie on top-level GET navigations from external
// origins (bookmarks, shared links). "strict" would force re-login on
// every external navigation. All mutations require POST, so "lax" CSRF
// protection is sufficient.
sameSite: 'lax',
```

### 1.4 Add HSTS header (from security review)

One-line addition to `next.config.ts` security headers:

```typescript
{
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload",
},
```

Without HSTS, the first HTTP request before redirect is vulnerable to cookie interception. This is a one-line fix with significant security value.

### 1.5 Verify auth consumers still work

These files call `isAuthenticated()` — the function signature doesn't change, so no modifications needed, but verify they still work:
- `app/api/gig/dismiss/route.ts` (line 6)
- `app/api/gig/toggle/route.ts` (line 6)
- `app/performer/dashboard/page.tsx` (line 10)

**Feed-forward risk resolution (confirmed by architecture review):** The `cookies()` function from `next/headers` is already used in both Server Components and API routes in the current codebase. The concern in the brainstorm's Feed-Forward is already resolved by the existing code pattern. No issue here.

### 1.6 Test locally

- `npm run build` — verify build succeeds with new code
- Start dev server with `COOKIE_SECRET` set in `.env.local`
- Log in as performer → verify cookie is set (check browser dev tools > Application > Cookies)
- **Reload dashboard → verify still authenticated** (critical test — proves cookies work without server state)
- Open incognito window → visit `/performer/dashboard` → verify redirect to login (not authenticated)
- Test audience page at `/r/alejandro` → verify no auth required, page loads
- Submit a song request from audience page → verify it appears on performer dashboard in realtime

### Research Insights — Performance

**From performance oracle:**
- HMAC-SHA256 (which HS256 uses) takes ~0.01-0.05ms on modern hardware — effectively free
- `requireEnv()` caching is unnecessary — `process.env[key]` is an O(1) property lookup
- `force-dynamic` on performer dashboard is correct (one consumer, Realtime corrects staleness immediately)
- No middleware needed at this scale (3 routes, 1 performer)
- At 10x scale (10 performers, 1000 audience), the architecture still holds — ISR absorbs audience load, Realtime bypasses Vercel

---

## Phase 2: Deploy to Vercel

### 2.1 Create Vercel project

- Connect GitHub repo `SDGuitarist/liverequest`
- Vercel auto-detects Next.js — no `vercel.json` needed
- Framework preset: Next.js (auto-detected)

### 2.2 Set environment variables in Vercel dashboard

All five vars must be set **before the first build** (`NEXT_PUBLIC_*` vars are inlined at build time):

| Variable | Scope | How to get | Verification |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All environments | Supabase dashboard → Settings → API | Starts with `https://`, ends with `.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All environments | Supabase dashboard → Settings → API | Starts with `eyJ` (JWT format) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | Supabase dashboard → Settings → API | Different from anon key |
| `PERFORMER_PASSWORD` | Production only | Choose a strong password (16+ chars) | NOT `changeme` |
| `COOKIE_SECRET` | Production only | Run `openssl rand -base64 32` | 44-character base64 string |

### 2.3 Deploy

- Push to `main` branch (or trigger deploy from Vercel dashboard)
- Verify build succeeds in Vercel build logs
- If build fails: check that `NEXT_PUBLIC_*` vars are set (they're required at build time by `requireEnv()`)

### Research Insights — Deployment

**From deployment verification agent:**

**Watch for in build logs:**
- No `Missing required environment variable` errors
- No TypeScript compilation errors
- Build completes with "Generating static pages" step succeeding
- Final output shows route list including `/r/[slug]`, `/performer`, `/performer/dashboard`, `/api/auth`

---

## Phase 3: End-to-End Verification

Run these checks on the live Vercel URL (see brainstorm: docs/brainstorms/2026-02-28-deploy-vercel-brainstorm.md, lines 50-55):

### Check 1 — Audience Page
- [ ] `https://<vercel-domain>/r/alejandro` loads without errors
- [ ] Song list renders (Supabase connection works)
- [ ] No console errors about missing env vars

### Check 2 — Performer Login (Critical)
- [ ] Login works at `https://<vercel-domain>/performer`
- [ ] **Refresh the page → still logged in** (proves cookies survive cold starts)
- [ ] **Close tab, reopen, navigate to dashboard → still logged in** (24h cookie persistence)

### Check 3 — Auth Rejection
- [ ] Incognito window at `/performer/dashboard` → redirects to `/performer`
- [ ] `curl -X POST https://<vercel-domain>/api/gig/toggle -H "Content-Type: application/json" -d '{"gigId":"fake","requestsOpen":true}'` → returns 401

### Check 4 — Song Request Flow
- [ ] Submit request from audience page → appears on performer dashboard in realtime
- [ ] Dismiss request from dashboard → disappears
- [ ] Toggle requests open/closed works

### Check 5 — QR Code and URLs
- [ ] QR code on performer dashboard shows the production URL (not localhost)
- [ ] Visiting `/r/anything-else` shows "Performer not found"

### Check 6 — Security Headers
```bash
curl -I https://<vercel-domain>/r/alejandro
```
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

---

## Go/No-Go Deployment Checklist

*From deployment verification agent*

**NO-GO conditions (do not deploy if any are true):**
- [ ] Auth fix code has NOT been merged to `main`
- [ ] Any of the 5 environment variables are missing from Vercel
- [ ] `PERFORMER_PASSWORD` is still `changeme`
- [ ] `npm run build` fails locally with the new code
- [ ] Performer login does not persist across page refresh locally

**GO conditions (all must be true):**
- [ ] Auth fix code builds successfully (`npm run build`)
- [ ] All 5 env vars set in Vercel for Production environment
- [ ] `PERFORMER_PASSWORD` is a strong, non-default password
- [ ] Local testing confirms: login persists, audience page works, auth rejection works

## Rollback Plan

**This is a code-only deployment with no database migrations.** Rollback is safe and instant.

**Option A — Vercel Dashboard (fastest, ~1 minute):**
1. Go to Vercel dashboard → Deployments
2. Find the previous successful deployment
3. Click three dots → "Promote to Production"

**Option B — Git revert:**
```bash
git revert HEAD
git push origin main
```

**Note:** Reverting to the old in-memory auth means the performer gets logged out on cold starts. The app still works — you just have to re-login more often.

---

## Acceptance Criteria

- [x] In-memory `Set<string>` is completely removed from `lib/auth.ts`
- [x] Auth uses `jose` (HS256/JWT) with `COOKIE_SECRET` env var
- [x] `isAuthenticated()` verifies JWT signature AND checks expiration (built into `jwtVerify`)
- [x] Cookie `sameSite` is `"lax"` (not `"strict"`) with explanatory comment
- [x] `PERFORMER_PASSWORD` uses `requireEnv()` pattern at module level
- [x] Password comparison uses HMAC-both-sides (no length leak)
- [x] HSTS header added to `next.config.ts`
- [x] `.env.example` documents all 5 env vars with empty values (no `changeme`)
- [ ] App is deployed and accessible at a Vercel URL
- [ ] All Phase 3 verification checks pass

## Dependencies & Risks

**Dependencies:**
- GitHub repo (`SDGuitarist/liverequest`) must be accessible to Vercel
- Supabase project must be running with schema applied (already done)
- `jose` npm package (zero transitive dependencies, ~4KB)

**Risks:**
- ~~**Feed-forward risk (from brainstorm):** Cookie signing with `next/headers` `cookies()` in both Server Components and API routes.~~ **RESOLVED:** Architecture review confirmed `cookies()` already works in both contexts in the current codebase. Using `jose` also resolves the Edge Runtime concern.
- **COOKIE_SECRET rotation:** Rotating the secret invalidates all sessions instantly. Acceptable for single-performer MVP — just re-login.

## Known MVP Limitations (Out of Scope)

These are acknowledged trade-offs, not bugs (see brainstorm: docs/brainstorms/2026-02-28-deploy-vercel-brainstorm.md, lines 57-69):

- **No session revocation** — Can't force-logout without rotating COOKIE_SECRET
- **60-second ISR stale window** — Audience page at `/r/[slug]` uses `revalidate = 60`; after toggling requests closed, cached page persists for up to 60 seconds
- **No rate limiting on `/api/auth`** — Brute-force protection relies on strong password. If needed later, add Vercel Edge Middleware with `@upstash/ratelimit` (~5 attempts per IP per minute)
- **No CSP header** — Existing gap, not introduced by deployment. Would need to allowlist `wss://*.supabase.co` for Realtime
- **Preview deployments share production Supabase** — Acceptable for single developer
- **No custom domain** — Using Vercel subdomain for now
- **No CI/CD pipeline** — Manual deploy via push to main
- **No monitoring/alerting** — MVP, visual checks only
- **Cookie not bound to client identity** — Any valid cookie works from any device. Low risk for single-performer MVP. If needed later, reduce `maxAge` to 4-8 hours (gig-length)

## Monitoring — First 24 Hours

*From deployment verification agent*

| When | What to check | Where |
|---|---|---|
| Deploy + 1 hour | Audience page loads, performer still logged in | Visit the URLs |
| Deploy + 4 hours | Same checks, no elevated error rates | Vercel dashboard → Functions |
| First live gig | Login works on phone, QR code works, requests flow in realtime | At the gig |

## Success Metrics

- Performer can log in, manage requests, and stay logged in across page reloads during a full gig (~3-4 hours)
- Audience can scan QR code, see song list, and submit requests without errors
- Zero cold-start logout events (the whole point of the auth fix)

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-28-deploy-vercel-brainstorm.md](docs/brainstorms/2026-02-28-deploy-vercel-brainstorm.md) — Key decisions carried forward: cookie-based auth (not Supabase Auth or DB tokens), Vercel subdomain (no custom domain), same Supabase project for dev/prod

### Internal References

- **Compound doc (security fixes):** [docs/solutions/diagnostic-fix-session-rls-races-perf.md](docs/solutions/diagnostic-fix-session-rls-races-perf.md) — RLS fixes, `requireEnv()` pattern, in-memory token risk documentation
- Auth implementation: `lib/auth.ts` (entire file — rewrite)
- Auth route: `app/api/auth/route.ts` (entire file — update)
- Env helper: `lib/env.ts` (add COOKIE_SECRET)
- Security headers: `next.config.ts` (add HSTS)

### External References

- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) — Official recommendation for `jose` + cookie sessions
- [jose library (panva/jose)](https://github.com/panva/jose) — HS256 JWT signing/verification
- [Node.js Crypto docs](https://nodejs.org/api/crypto.html) — `timingSafeEqual` reference
- [Vercel Edge Runtime limitations](https://vercel.com/docs/functions/runtimes/edge) — `crypto.createHmac` not available

### Research Agents

- Security sentinel: auth bypass risks, OWASP compliance, timing leaks
- Deployment verification: Go/No-Go checklist, rollback plan, monitoring
- TypeScript reviewer: code structure, type safety, module patterns
- Architecture strategist: stateless auth soundness, principle compliance
- Simplicity reviewer: YAGNI analysis, complexity reduction
- Performance oracle: serverless latency, scaling analysis
- Pattern recognition: naming conventions, module placement, consistency
- Best practices researcher: jose vs raw HMAC, cookie standards, Edge Runtime

## Feed-Forward
- **Hardest decision:** Whether to use raw HMAC, static HMAC, or `jose`. Went with `jose` because it's what Next.js officially recommends, it resolves the Edge Runtime concern from the brainstorm, and it gives us standard JWT claims (iat, exp) with less custom code than raw HMAC.
- **Rejected alternatives:** Raw `crypto.createHmac` with custom `{timestamp}:{nonce}:{hmac}` format (doesn't work in Edge Runtime, more code), static `HMAC("performer")` (loses server-side expiration, simplicity reviewer's suggestion but jose is barely more complex with better guarantees), middleware-based auth (not worth it for 4 consumers).
- **Least confident:** Whether the `jose` `sign()` async call adds meaningful latency compared to synchronous `crypto.createHmac`. Performance oracle says HMAC-SHA256 is ~0.01-0.05ms, so the async wrapper should be negligible, but verify with a local benchmark if concerned.
