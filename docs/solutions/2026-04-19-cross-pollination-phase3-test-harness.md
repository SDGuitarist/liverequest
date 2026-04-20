---
title: Cross-Pollination Phase 3 — LiveRequest Test Harness
date: 2026-04-19
tags: [cross-pollination, hardening, testing, vitest]
apps: [liverequest]
phase: work
---

# Cross-Pollination Phase 3 — LiveRequest Test Harness

## Problem

LiveRequest had zero tests. No test framework, no test runner, no test files. For a deployed production app (Vercel), this meant no automated validation — every deploy was a manual smoke test.

## Challenge: Next.js App Router + Server Components

Next.js 16 App Router API routes use server-only imports (`cookies()` from `next/headers`, `createServiceClient()` with env vars). These can't run in plain Node.js test environments without mocking the entire Next.js server runtime.

## Solution: Test the Logic, Not the Framework

Instead of fighting Next.js server primitives, we tested at two levels:

1. **Pure utility functions** — `isUUID()`, `requireEnv()`, type constants. These have zero framework dependencies.
2. **Validation pattern tests** — Extract the validation logic patterns shared across all 15+ API routes and test them directly: UUID checking, body shape validation, vibe type enforcement, error code handling.

This gives confidence that the validation layer works without requiring a full Next.js test server.

## What We Built

| File | Tests | Coverage |
|------|-------|----------|
| `lib/validation.test.ts` | 9 | UUID regex: valid, invalid, edge cases (SQL injection, path traversal) |
| `lib/env.test.ts` | 4 | requireEnv: exists, missing, empty string |
| `lib/types.test.ts` | 16 | All const arrays (VIBE_VALUES, SESSION_STATUS_VALUES, etc.), label map coverage |
| `lib/api-validation.test.ts` | 22 | Route validation patterns: string/boolean field checks, vibe enforcement, PGRST116 handling, response shape consistency, error message safety |

## Key Pattern: Testing Validation at the Boundary

All LiveRequest API routes follow the same pattern:
1. Check auth (`isAuthenticated()`)
2. Parse JSON body (`request.json()`)
3. Validate field types (`typeof field === "string"`)
4. Validate UUIDs (`isUUID(field)`)
5. Validate enums (`VIBE_VALUES.includes(vibe)`)
6. Call Supabase
7. Handle PGRST116 vs other errors

Steps 3-5 are testable without Next.js. Steps 1, 6-7 need integration tests (future).

## Three Questions

1. **Hardest pattern to extract:** Deciding to test validation patterns instead of route handlers. The temptation was to set up next-test-api-route or similar. But the real risk is "does the validation catch bad input?" not "does Next.js route to the handler?" Next.js routing is tested by Next.js.
2. **What was left out:** Integration tests that actually call API routes with a real Next.js server. These would require `@playwright/test` or `next-test-api-route` and a mock Supabase. Valuable but a larger effort.
3. **What might future sessions miss:** The `lib/auth.ts` module (JWT signing/verification with jose) has zero test coverage. It uses `cookies()` which is server-only, making it hard to unit test. The auth patterns are tested indirectly through the validation pattern tests (e.g., "401 for unauthorized"), but the actual JWT logic is untested.
