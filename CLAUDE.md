# LiveRequest — Claude Code Context

## What This Is

A live musician song request app for Pacific Flow Entertainment. Guests scan a QR code to request songs and send vibe feedback (fire/energy/softer). The performer dashboard shows requests in real time. NOT a DJ app — built for live performers taking audience requests during gigs.

See `docs/product-bible.md` for the full product vision.

## Architecture

```
app/
├── r/[slug]/page.tsx        — Guest request interface (QR code landing)
├── performer/dashboard/     — Performer real-time dashboard
├── api/auth/route.ts        — JWT cookie authentication
├── api/gig/toggle/route.ts  — Mark request as played
├── api/gig/dismiss/route.ts — Soft-delete request
├── api/gig/undo-dismiss/    — Undo soft-delete
├── api/gig/vibe/route.ts    — Vibe feedback endpoint
├── layout.tsx               — Root layout
└── page.tsx                 — Landing/redirect
components/
├── song-list.tsx            — Searchable song list (guest)
├── song-card.tsx            — Individual song card with animations
├── confirmation-overlay.tsx — Post-request overlay with haptics
└── request-queue.tsx        — Performer dashboard queue
lib/
├── auth.ts                  — Crypto token auth (in-memory Set)
├── session.ts               — Session/gig management
├── supabase/                — Supabase client helpers
├── types.ts                 — Shared TypeScript types
├── validation.ts            — Input sanitization
├── haptics.ts               — Haptic feedback API
└── env.ts                   — Environment variable validation
```

## Key Commands

```bash
npm run dev      # Start dev server (Next.js 16)
npm run build    # Production build
npm run lint     # ESLint
```

## Tech Stack

- Next.js 16, React 19, TypeScript
- Supabase (Postgres + Realtime + RLS)
- Tailwind CSS 4 (glassmorphic dark theme)
- Deployment target: Vercel (not yet deployed)

## Key Conventions

- **RLS defense-in-depth** — API routes validate auth AND RLS policies restrict anon access. Never rely on only one layer.
- **Optimistic UI with recovery** — Mark-as-played updates UI immediately, rolls back on error. Self-heal gap: always re-fetch on error, don't leave stale optimistic state.
- **Crypto auth over session tokens** — `lib/auth.ts` uses an in-memory Set of valid tokens. Works for single-instance only; breaks under horizontal scaling.
- **Soft-delete, not hard-delete** — Requests are marked `played_at` (timestamp), never removed from DB.
- **Haptic feedback** — All user confirmations use `navigator.vibrate()` with progressive enhancement.
- **Glassmorphic performance** — Use `transition-[specific-props]` not `transition-all`. Limit `backdrop-blur` layers on mobile.
- **Vibe types are strict** — Use `Vibe` union (`"fire" | "more_energy" | "softer"`), never loose strings.
- **Postgres RPCs only for atomicity** — Use RPCs only when atomicity requires it (e.g., auto-incrementing counters). All RPCs must be typed in `database.types.ts` and created via migrations. Prefer application-layer logic for everything else.
- After `/workflows:compound`, always run `/update-learnings` to propagate lessons to all docs.

## Git Conventions

- Commit style: `type: description` — e.g., `feat(vibe): haptic confirmation + performer vibe display`
- Types: `feat`, `fix`, `docs`, `refactor`
- Small commits (~50-100 lines, one concern each)
- Always commit before multi-file edits

See `LESSONS_LEARNED.md` for development history and patterns from each cycle.

## Three Questions (Mandatory)

Every phase of the compound engineering loop MUST end with three questions answered in its output document before stopping. See global `CLAUDE.md` for the full phase-specific format.

## Session-Closing Handoff (Mandatory)

Before ending ANY session, update `HANDOFF.md` (project root) with: what was done, three questions, next phase, and a copy-paste prompt for the next session. See global `CLAUDE.md` for full format.
