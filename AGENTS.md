# Codex Repo Instructions

## Repo Snapshot
- Project: Live musician song request app where guests scan a QR code to request songs and send vibe feedback while performers watch a real-time dashboard.
- Read first: `HANDOFF.md`, `CLAUDE.md`, `docs/reviews/CODEX-REVIEW-GATE.md`, `docs/product-bible.md`, then `docs/plans/`, `docs/brainstorms/`, and `todos/`.
- App routes: `app/`
- Shared UI: `components/`
- Shared logic: `lib/`
- Database and SQL: `supabase/`
- Config: `package.json`, `next.config.ts`, `tsconfig.json`

## Commands
- Start local development: `npm run dev` — runs the Next.js development server.
- Build the app: `npm run build` — creates the production build.
- Start production mode locally: `npm run start` — serves the built app.
- Lint the code: `npm run lint` — runs ESLint.
- Tests: no dedicated test command was detected yet.

## Branch And PR Notes
- Base branch is `main`.
- If PR commands are needed, use `gh pr create --base main`.

## How Codex Should Work Here
- Use Codex for second-opinion planning, branch risk review, plain-English explanation, and Claude Code handoff prompts.
- Planning is analysis only unless I explicitly ask for implementation.
- When asked to plan, name the exact guest flow, performer flow, and API routes in scope.
- When asked to review, use `docs/reviews/CODEX-REVIEW-GATE.md` and focus on auth mistakes, RLS gaps, real-time UI regressions, missing tests, and performer or guest-facing breakage.

## Repo Guardrails
- Auth and RLS are defense in depth here. Never rely on only one layer.
- `lib/auth.ts` uses in-memory token storage, so scaling assumptions are fragile and should be called out clearly.
