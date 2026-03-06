# Codex Review Gate — LiveRequest

Use this before merge or before asking Claude Code to fix review findings.

## Read First

- `HANDOFF.md`
- `CLAUDE.md`
- `docs/product-bible.md`
- the relevant file in `docs/plans/`
- the matching file in `docs/solutions/` if the same area was touched before

## Compare Against

- Base branch: `main` unless the user or repo docs say otherwise

## Always Check

- Auth in API routes and RLS policies both enforce access.
- Guest flow, performer dashboard flow, and real-time updates stay consistent.
- Optimistic UI always has rollback or refetch behavior on failure.
- In-memory session or token assumptions are called out when code increases scaling risk.
- Request, dismiss, undo, play, and vibe mutations do not leak state or break performer visibility.
- Environment and deployment assumptions are explicit.

## Required Checks

- Run `npm run build`.
- Run `npm run lint`.
- No automated test suite is configured here right now, so say that explicitly in every review.
- If auth, cookies, sessions, or Supabase helpers changed: inspect route protection and RLS assumptions directly.
- If performer dashboard or queue behavior changed: call out missing manual smoke tests if they were not run.

## Findings Priorities

1. Broken auth, RLS gaps, or leaked guest or performer data
2. Real-time or optimistic UI regressions that leave the performer dashboard wrong
3. Guest-flow breakage that blocks requests or vibe feedback
4. Missing checks around deployment, sessions, or scaling limits
