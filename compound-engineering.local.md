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

## Cross-Tool Review Protocol

Codex is an independent second-opinion agent in this workflow. For reviews:
1. Run Codex `review-branch-risks` first (independent findings)
2. Then run Claude Code `/workflows:review` (compound review with learnings researcher)
3. Merge both finding sets, deduplicate, and apply fix ordering per CLAUDE.md rules

For planning: after Claude's `/workflows:plan`, optionally run Codex `codex-second-opinion-plan` to challenge assumptions and generate a focused handoff prompt.

## Plan Reference

`docs/plans/2026-02-28-feat-deploy-vercel-plan.md` (complete)
