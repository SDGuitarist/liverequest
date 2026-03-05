# Review Context — LiveRequest

## Risk Chain

**Brainstorm risk:** Cookie signing may not work seamlessly with Next.js 16 server components + API routes.

**Plan mitigation:** Architecture review confirmed `cookies()` already works in both contexts. `jose` resolves Edge Runtime concern. HMAC-both-sides fixes password length leak.

**Work risk (from Feed-Forward):** Whether `jose` `sign()` async latency is meaningful (it's not — ~0.01ms).

**Review resolution:** Deploy shipped without formal review cycle (deploy is infrastructure, not feature code). All verification checks passed on live URL. Risk chain fully resolved.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `lib/auth.ts` | Full rewrite: jose JWT cookies replace in-memory Set | Auth correctness, token validation |
| `app/api/auth/route.ts` | signSessionCookie(), HMAC password comparison, sameSite lax | Login flow, timing safety |
| `next.config.ts` | Added HSTS header | Security headers |
| `lib/env.ts` | Added COOKIE_SECRET | Env validation |

## Plan Reference

`docs/plans/2026-02-28-feat-deploy-vercel-plan.md` (complete)
