---
title: "Vercel Deployment: Serverless Auth Token Persistence & Environment Variable Inlining"
slug: "vercel-deploy-serverless-auth-env-inlining"
date: 2026-02-28
category: integration-issues
tags: [serverless, authentication, environment-variables, vercel-deployment, next-js-bundling, jose, jwt]
severity: critical
component: [lib/auth.ts, app/api/auth/route.ts, lib/supabase/client.ts, next.config.ts, .env.example]
root_cause: "In-memory Set<string> token store incompatible with Vercel serverless cold starts; dynamic process.env key lookup fails Next.js static analysis for NEXT_PUBLIC_* inlining in client bundles"
resolution_time: "single session"
---

# Vercel Deployment: Serverless Auth & Env Var Inlining

## Problem Symptom

Two issues surfaced when deploying LiveRequest to Vercel:

1. **Auth token loss:** The performer got randomly logged out because the in-memory `Set<string>` token store in `lib/auth.ts` resets on every serverless cold start. Sessions don't survive between function invocations.

2. **Client-side crash:** The audience page at `/r/alejandro` threw "Application error: a client-side exception has occurred" because `lib/supabase/client.ts` called `requireEnv("NEXT_PUBLIC_SUPABASE_URL")` — a dynamic key lookup that returns `undefined` in production client bundles.

## Investigation Steps

1. **Auth tokens:** Traced the in-memory `Set<string>` in `lib/auth.ts`. On Vercel, each serverless function invocation can be a cold start with fresh memory. The Set is empty on every new instance — any token stored by a previous instance is gone.

2. **Client env vars:** After deploying the auth fix, `/r/alejandro` crashed with a client-side error. The `requireEnv()` helper uses `process.env[key]` (dynamic lookup). Next.js only inlines `NEXT_PUBLIC_*` variables when accessed as **static strings** like `process.env.NEXT_PUBLIC_SUPABASE_URL`. Dynamic lookups bypass the build-time replacement and return `undefined` in client bundles. This worked in dev mode (Next.js loads real env vars) but broke in production.

3. **Password timing leak:** Found `a.length === b.length` short-circuit before `timingSafeEqual()` in the password comparison — leaks password length via response timing.

## Root Cause

1. **Stateful sessions on stateless infrastructure.** The app assumed request affinity (same instance handles the same user), but serverless functions are ephemeral. Session state must be cryptographically signed and stored client-side.

2. **Dynamic env var access bypasses Next.js static analysis.** `process.env[key]` where `key` is a variable cannot be replaced at build time. Only literal string access (`process.env.NEXT_PUBLIC_FOO`) triggers inlining.

## Working Solution

### 1. JWT Session Cookies with jose

Replaced the in-memory Set with stateless signed cookies:

```typescript
// lib/auth.ts
import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { requireEnv } from '@/lib/env'

const SECRET = new TextEncoder().encode(requireEnv('COOKIE_SECRET'))
const SESSION_DURATION = 24 * 60 * 60 // 24 hours

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

Why `jose`: recommended by Next.js official auth guide, works in Edge Runtime (unlike `crypto.createHmac`), handles timing-safe comparison and expiration internally, ~4KB with zero dependencies.

### 2. Static Env Var Access in Client Code

```typescript
// lib/supabase/client.ts — BEFORE (broken in production)
const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL"); // dynamic lookup

// lib/supabase/client.ts — AFTER (works everywhere)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;   // static string
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
```

### 3. HMAC-Both-Sides Password Comparison

```typescript
// app/api/auth/route.ts
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

const HMAC_KEY = randomBytes(32)

function constantTimeEqual(a: string, b: string): boolean {
  const hmacA = createHmac('sha256', HMAC_KEY).update(a).digest()
  const hmacB = createHmac('sha256', HMAC_KEY).update(b).digest()
  return timingSafeEqual(hmacA, hmacB) // both always 32 bytes, no length leak
}
```

### 4. Cookie & Security Headers

- `sameSite: "lax"` (not "strict") — strict blocks cookies on external navigations (bookmarks, shared links)
- `expires` with absolute Date instead of `maxAge`
- HSTS header added to `next.config.ts`: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `.env.example`: removed `changeme` default, added `COOKIE_SECRET` placeholder

## Key Insight

**Serverless requires stateless authentication.** In-memory state doesn't survive across invocations. The signed cookie IS the session — no server-side store needed.

**Dynamic runtime lookups of compile-time values break build optimization.** Next.js scans for hardcoded `process.env.NEXT_PUBLIC_*` strings to know what to inline. Helper functions that hide the access pattern (`requireEnv(key)`) won't work for client code, even if they work server-side. Always use direct static access for `NEXT_PUBLIC_*` variables.

## Prevention Strategies

1. **Never store auth state in memory on serverless.** Use signed cookies (JWT/HMAC) or an external store (Redis, database).
2. **Never use dynamic env var lookups in client code.** Access `NEXT_PUBLIC_*` as literal strings only.
3. **Always use timing-safe comparison for secrets.** No length checks, no short-circuits — HMAC both sides to normalize.
4. **Default to `sameSite: "lax"` for session cookies.** "strict" breaks too many legitimate navigation flows.
5. **Run `npm run build && npm run start` locally before deploying.** Dev mode masks env var and bundling issues.

## Checklist: Deploying Next.js to Serverless

- [ ] No module-level mutable state for auth (no `Set`, `Map`, global variables)
- [ ] All `NEXT_PUBLIC_*` accessed as static strings in client code (not via helper functions)
- [ ] Password/token comparisons use `timingSafeEqual` with no short-circuits
- [ ] Session cookies: `httpOnly`, `secure`, `sameSite: "lax"`, explicit `expires`
- [ ] Security headers: HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] All env vars set in Vercel before first deploy
- [ ] Production build tested locally (`npm run build && npm run start`)
- [ ] Cold start tested (restart server, verify session persists via cookie)

## Risk Resolution

**Flagged risk (from brainstorm Feed-Forward):** "Cookie signing may not work seamlessly with Next.js 16 server components + API routes."

**What actually happened:** No issue. `cookies()` from `next/headers` already worked in both Server Components and API routes. The `jose` library resolved the Edge Runtime concern (raw `crypto.createHmac` doesn't work there). The real surprise was the `NEXT_PUBLIC_*` dynamic lookup bug — a latent issue unrelated to the flagged risk.

**Lesson:** The risk we tracked was resolved before implementation. The bug that actually bit us (dynamic env var access) was a different class of problem entirely — a build-time vs. runtime distinction that only manifests in production builds. Always test with `npm run build && npm run start` locally before deploying.

## Related Documentation

- **Brainstorm:** [docs/brainstorms/2026-02-28-deploy-vercel-brainstorm.md](../brainstorms/2026-02-28-deploy-vercel-brainstorm.md)
- **Plan:** [docs/plans/2026-02-28-feat-deploy-vercel-plan.md](../plans/2026-02-28-feat-deploy-vercel-plan.md)
- **Previous compound doc:** [docs/solutions/diagnostic-fix-session-rls-races-perf.md](diagnostic-fix-session-rls-races-perf.md) — documented the in-memory token risk as a known limitation
- **Next.js Auth Guide:** https://nextjs.org/docs/app/guides/authentication
- **jose library:** https://github.com/panva/jose
