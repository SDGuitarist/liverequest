# Review Context — LiveRequest

## Risk Chain

**Brainstorm risk:** Whether @react-pdf/renderer works cleanly in Vercel serverless (Node.js APIs, Edge Runtime limitations).

**Plan mitigation:** Verify on first commit with a minimal test route. Bundle fonts locally to avoid CDN cold-start latency. Fallback to system fonts (Helvetica) if local paths fail.

**Work risk (from Feed-Forward):** Font loading on Vercel's read-only filesystem via `path.join(process.cwd(), 'public/fonts/...')`.

**Review resolution:** 5 findings from Codex review — all applied. Top findings: fail-fast on query errors (silent `?? []` degradation), peak hour in wrong timezone (server UTC vs local Pacific), per-gig query fanout on history page, logo/branding scope mismatch. Self-review confirmed zero-data cases match plan spec.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `lib/gift-data.ts` | New — data aggregation with fail-fast error handling | Query error paths, timezone, top-songs tie logic |
| `components/gift-pdf.tsx` | New — PDF document component with conditional sections | Stream 2 degradation, font registration |
| `app/api/gift/[gigId]/route.tsx` | New — first GET route in codebase | Cookie auth on GET, filename sanitization |
| `app/performer/history/page.tsx` | New — gig history with bulk aggregate queries | Query efficiency, completed-gig definition |
| `components/pre-set-form.tsx` | Modified — download banner added | Uses `<a>` tag (not fetch) for cookie delivery |
| `public/fonts/` | New — bundled TTF files | Vercel filesystem access verified |

## Plan Reference

`docs/plans/2026-04-07-feat-the-gift-post-service-summary-plan.md` (complete)
