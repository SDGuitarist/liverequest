# Lessons Learned: LiveRequest

Hub file for lessons across all development cycles. Detailed writeups live in [`docs/solutions/`](docs/solutions/).

## Development History

| Cycle | Feature | Key Lesson |
|-------|---------|------------|
| 1 | Mark as Played + Vibe Feedback | Optimistic UI needs a self-heal gap — always re-fetch on error, don't leave stale state |
| 1 (review) | Vibe type safety + re-render guard | Loose string types compound across call sites; narrow to union types early |
| 1 (cleanup) | Todo status audit + last P1 fix | Verify todo status against source code — filenames lie, frontmatter drifts |
| Design Polish | Glassmorphic dark mode (Phase A) | `transition-all` kills mobile perf — scope to specific properties |
| Design Polish | Delight animations (Phase B) | Always gate animations behind `prefers-reduced-motion` |
| Design Polish | Shareability overlay (Phase C) | Fetch supplemental data (request count) without blocking the overlay render |
| Design Polish | Stagger + haptics (Phase D) | Haptic feedback is progressive enhancement — wrap in feature detection, never assume |
| Diagnostic Fix | RLS, races, security headers | Open anon RLS policies bypass all API auth — RLS is the real security boundary, not route middleware |
| Setlist Mgmt | Setlist toggle + review fixes | RLS policies are invisible query filters — admin views must use service client. Match optimistic UI complexity to actual concurrency level. |

## Top Patterns

Patterns that recurred across 2+ cycles or prevented entire categories of bugs.

| # | Pattern | Cycles | Solution Doc |
|---|---------|--------|-------------|
| 1 | **RLS defense-in-depth** — API auth + RLS policies together; anon RLS = no public writes | Diagnostic, C1 | [diagnostic-fix](docs/solutions/diagnostic-fix-session-rls-races-perf.md) |
| 2 | **Optimistic UI with self-heal** — update UI immediately, roll back on error, re-fetch to close the gap | C1, C1-review | [cycle1-post-review](docs/solutions/cycle1-post-review-fixes.md) |
| 3 | **Narrow types early** — use `VibeType` union, not `string`; loose types compound at every call site | C1-review | [cycle1-vibe-review](docs/solutions/cycle1-vibe-review-fixes.md) |
| 4 | **Scope CSS transitions** — `transition-[opacity,transform]` not `transition-all`; saves mobile GPU budget | Phase A, D | [glassmorphic-perf](docs/solutions/glassmorphic-dark-mode-performance.md) |
| 5 | **Progressive enhancement for haptics** — feature-detect `navigator.vibrate`, never assume support | Phase D | [stagger-haptics](docs/solutions/phase-d-polish-stagger-haptics.md) |
| 6 | **Gate animations on reduced-motion** — every `@keyframes` needs a `prefers-reduced-motion` media query | Phase B, D | [delight-animations](docs/solutions/phase-b-delight-animations.md) |
| 7 | **RLS = invisible query filter** — admin views need `createServiceClient()` to see records RLS hides from `anon`. "No filter" in code ≠ no filter at runtime. | Diagnostic, Setlist | [setlist-review-fixes](docs/solutions/setlist-management-review-fixes.md) |
| 8 | **Match complexity to concurrency** — don't copy patterns from multi-user components (RequestQueue) to single-user ones (SetlistManager). Simple revert-on-error > generation counters for single-performer use. | Setlist | [setlist-review-fixes](docs/solutions/setlist-management-review-fixes.md) |

## Solution Docs Index

| Category | File | Cycle |
|----------|------|-------|
| frontend-patterns | [glassmorphic-dark-mode-performance](docs/solutions/glassmorphic-dark-mode-performance.md) | Design Polish |
| frontend-patterns | [phase-b-delight-animations](docs/solutions/phase-b-delight-animations.md) | Design Polish |
| frontend-patterns | [phase-c-shareability-overlay](docs/solutions/phase-c-shareability-overlay.md) | Design Polish |
| frontend-patterns | [phase-d-polish-stagger-haptics](docs/solutions/phase-d-polish-stagger-haptics.md) | Design Polish |
| security-and-reliability | [diagnostic-fix-session-rls-races-perf](docs/solutions/diagnostic-fix-session-rls-races-perf.md) | Diagnostic Fix |
| runtime-errors | [cycle1-post-review-fixes](docs/solutions/cycle1-post-review-fixes.md) | Cycle 1 |
| code-review | [cycle1-vibe-review-fixes](docs/solutions/cycle1-vibe-review-fixes.md) | Cycle 1 |
| code-review | [setlist-management-review-fixes](docs/solutions/setlist-management-review-fixes.md) | Setlist Mgmt |

## Cross-Tool Workflow (March 2026)

| # | Pattern | Source |
|---|---------|--------|
| 7 | **Two independent reviewers > one self-reviewing tool** — Codex reviews first (fresh eyes, no context bias), then Claude Code reviews with compound learnings researcher. Deduplicate findings across both. | Codex integration setup |
| 8 | **Handoff prompts start with "Read docs/plans/[file].md"** — Codex generates focused Claude Code prompts with exact file paths, scope boundaries, acceptance criteria, and stop conditions. Prevents broad exploration. | Codex `handoff-to-claude-code` skill |

## How to Use

**After a review:** Check Top Patterns before applying fixes — you may be looking at a symptom, not a root cause.

**Starting a new cycle:** Scan the Development History table for lessons from similar features.

**Adding a new entry:** Update the Development History table after each compound phase. Add to Top Patterns if the lesson recurred or prevented a category of bugs.
