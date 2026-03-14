---
title: "feat: GigPrep ↔ LiveRequest M2M sync integration"
type: feat
status: active
date: 2026-03-11
origin: docs/brainstorms/2026-03-11-gigprep-sync-integration-brainstorm.md
feed_forward:
  risk: "Guest page freshness after sync — page is dynamic due to cookies(), but caching behavior should be smoke-tested manually"
  verify_first: true
---

# feat: GigPrep ↔ LiveRequest M2M sync integration

## Overview

Commit the existing untracked M2M sync code (two API endpoints + shared auth module) after applying two fixes identified in the brainstorm. The code was written in a prior session and is ~95% ready. (See brainstorm: `docs/brainstorms/2026-03-11-gigprep-sync-integration-brainstorm.md`)

## What Exactly Is Changing

Two fixes to existing untracked code, then commit everything:

### Fix 1: Remove `revalidatePath` call (sync route)

**File:** `app/api/songs/sync/route.ts`
**Lines:** 2 (import) and 174 (call)
**Change:** Delete the `import { revalidatePath } from "next/cache"` and the `revalidatePath("/r/alejandro")` call inside the `idsToActivate.size > 0` block.

**Why the call is a no-op (plain-English explanation):**
The guest page (`/r/[slug]/page.tsx`) has `export const revalidate = 60` on line 5, which would normally enable ISR (regenerate every 60 seconds). However, the page also calls `createClient()` from `lib/supabase/server.ts`, which calls `cookies()` from `next/headers`. The Next.js docs state: *"cookies is a Dynamic API... Using it in a layout or page will opt a route into dynamic rendering."* This means the `revalidate = 60` config is effectively overridden — the guest page renders fresh on every request, not from a static cache. Since there is no static/ISR cache for this path, `revalidatePath("/r/alejandro")` has nothing to invalidate and is a no-op. Additionally, the call hardcodes a slug. (See brainstorm: Key Decision #2)

**Note:** `app/api/songs/toggle/route.ts:43` also calls `revalidatePath("/r/alejandro")`. That call is equally a no-op for the same reason, but it is out of scope for this plan — we are not modifying the toggle route.

**Verification required:** After removing the call, run a manual guest-page freshness smoke test (see Acceptance Criteria below) to confirm the page still shows updated song state immediately after a sync request. This is the plan's primary risk area.

### Fix 2: SHA-256 hash before timing-safe comparison (sync-auth)

**File:** `lib/sync-auth.ts`
**Lines:** 10-19 (replace the comparison logic)
**Change:** Instead of comparing raw buffers with an early length check, SHA-256 hash both the expected and provided keys, then compare the fixed-length hashes with `timingSafeEqual`.

Before (vulnerable):
```typescript
const expected = Buffer.from(requireEnv("SYNC_API_KEY"), "utf8");
const provided = Buffer.from(apiKey, "utf8");

if (expected.length !== provided.length) {
  return false;  // ← leaks key length
}

return timingSafeEqual(expected, provided);
```

After (fixed):
```typescript
import { createHash, timingSafeEqual } from "node:crypto";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isValidSyncApiKey(apiKey: string | null): boolean {
  if (!apiKey) {
    return false;
  }

  const expected = sha256(requireEnv("SYNC_API_KEY"));
  const provided = sha256(apiKey);

  return timingSafeEqual(expected, provided);
}
```

**Why:** The early `length !== length` return leaks whether the provided key is the correct length (length-oracle attack). SHA-256 produces fixed 32-byte output regardless of input length, making `timingSafeEqual` safe. (See brainstorm: Key Decision #3. Confirmed by institutional learnings: "HMAC both sides to normalize length before `timingSafeEqual`")

### Files to commit (all untracked/modified)

| File | Status | Description |
|------|--------|-------------|
| `app/api/songs/sync/route.ts` | New (after fix 1) | Setlist push endpoint |
| `app/api/songs/played/route.ts` | New | Played songs pull endpoint |
| `lib/sync-auth.ts` | New (after fix 2) | API key auth module |
| `.env.example` | Modified | Added `SYNC_API_KEY` variable |

## What Must NOT Change

- **Existing API routes** (`app/api/gig/*`, `app/api/songs/list`, `app/api/songs/toggle`, `app/api/auth`) — no modifications
- **Guest page** (`app/r/[slug]/page.tsx`) — no modifications. The page is dynamically rendered (due to `cookies()` call) despite the `revalidate = 60` export.
- **Performer dashboard** — no modifications
- **`lib/auth.ts`** (cookie auth) — completely separate from M2M auth, do not touch
- **RLS policies** — no Supabase migration needed, service client bypasses RLS
- **Sync model** — additive only (activate songs, never deactivate). Do not add deactivation logic.

## How We'll Know It Worked

1. **`npm run build` passes** — no TypeScript errors, no import issues
2. **`npm run lint` passes** — no lint violations introduced
3. **Note:** This repo has no automated test suite. All verification is manual.
4. **Manual curl test (sync endpoint):**
   ```bash
   curl -X POST http://localhost:3000/api/songs/sync \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $SYNC_API_KEY" \
     -d '{"songs": [{"title": "Fly Me to the Moon", "artist": "Frank Sinatra"}]}'
   ```
   Expected: 200 with `matched` or `already_active` or `unmatched` category
5. **Manual curl test (played endpoint):**
   ```bash
   curl http://localhost:3000/api/songs/played \
     -H "X-API-Key: $SYNC_API_KEY"
   ```
   Expected: 200 with gig metadata + played_events (or 404 if no active gig)
6. **Auth rejection test:**
   ```bash
   curl -X POST http://localhost:3000/api/songs/sync \
     -H "X-API-Key: wrong-key" \
     -d '{"songs": []}'
   ```
   Expected: 401
7. **Guest-page freshness smoke test (primary risk verification):**
   After a successful sync (step 4), open `http://localhost:3000/r/alejandro` in a browser. Confirm the synced song now appears as active. Reload the page and verify it still shows the correct state. This confirms the guest page reflects database changes without `revalidatePath`.

## Most Likely Way This Plan Is Wrong

**Primary risk: Guest-page freshness after removing `revalidatePath`.** The analysis says the guest page is already dynamically rendered (because `cookies()` opts out of static caching), so `revalidatePath` is a no-op and removing it should be safe. But if there is a Next.js caching layer we haven't accounted for (e.g., a CDN edge cache in production, or a future change that removes the `cookies()` call from `createClient`), the guest page could serve stale data after a sync. This is why the manual guest-page freshness smoke test (step 7 above) is mandatory before committing. If the smoke test fails, the fix should be reverted — keep `revalidatePath` as a safety net until the caching behavior is better understood.

**Secondary sanity check: SHA-256 hash with unusual API key values.** The SHA-256 fix hashes both sides with `createHash("sha256").update(value, "utf8").digest()`. For any non-empty string API key, both sides hash the same UTF-8 bytes before comparison, so behavior is identical to the current raw comparison. Worth a quick sanity check during testing that the env var is set cleanly (no trailing whitespace or newline from copy-paste), but this is low risk for normal string values.

## Acceptance Criteria

- [ ] `revalidatePath` import and call removed from `app/api/songs/sync/route.ts`
- [ ] `lib/sync-auth.ts` uses SHA-256 hashing before `timingSafeEqual`
- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes with no errors
- [ ] Guest-page freshness smoke test passes (step 7 above) — guest page shows synced song state after a sync request
- [ ] All four files committed with descriptive commit message
- [ ] `.env.example` includes `SYNC_API_KEY` (already done)
- [ ] Note: this repo has no automated test suite — all verification is manual

## Known Limitations (Not Fixing Now)

From SpecFlow analysis — documented, not blocking:

- **No payload size limit** on `songs` array — acceptable since caller is our own tooling
- **Normalization is trim+lowercase only** — no Unicode normalization or internal whitespace collapsing. Could cause false negatives with unusual song titles. Document for GigPrep client.
- **No success logging** — only errors are logged. Add operational logging in a future pass.
- **`song_id` not in played response** — GigPrep must re-match by title+artist. Trivial to add later if needed.
- **`jsonNoStore` duplicated** in both route files — intentional per YAGNI (brainstorm Decision #4)
- **No startup validation** of `SYNC_API_KEY` — `requireEnv` throws on first request, not at boot. Acceptable for now.

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-03-11-gigprep-sync-integration-brainstorm.md](docs/brainstorms/2026-03-11-gigprep-sync-integration-brainstorm.md) — Key decisions carried forward: additive sync model, revalidatePath removal, SHA-256 hash fix
- **Institutional learnings:** `docs/solutions/integration-issues/vercel-deployment-in-memory-tokens-env-vars.md` — timing-safe comparison pattern
- **Institutional learnings:** `docs/solutions/diagnostic-fix-session-rls-races-perf.md` — RLS + service client architecture
- **Guest page rendering:** `app/r/[slug]/page.tsx:5` has `export const revalidate = 60`, but line 13 calls `createClient()` → `cookies()`, which opts the route into dynamic rendering per [Next.js cookies() docs](https://nextjs.org/docs/app/api-reference/functions/cookies). The `revalidate` export is effectively overridden.
- **revalidatePath behavior:** [Next.js revalidatePath docs](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) — invalidates cached data for a path; has no effect on already-dynamic routes.
- **toggle route also calls revalidatePath:** `app/api/songs/toggle/route.ts:43` — same no-op call, out of scope for this plan

## Feed-Forward

- **Hardest decision:** Whether to add `song_id` to the played endpoint response now. Decided against — it changes the GigPrep client contract and this plan is about fixing + committing existing code, not feature additions.
- **Rejected alternatives:** Adding startup env validation (over-engineering for 1 env var), adding payload size limit (YAGNI — we control the caller), Unicode normalization (premature complexity).
- **Least confident:** Whether removing `revalidatePath` truly has no effect on guest-page freshness. The analysis (cookies() → dynamic rendering → no cache to invalidate) is sound, but Next.js caching has multiple layers and the behavior could differ in production (e.g., Vercel edge cache). The mandatory smoke test (step 7) is the safety net. Secondary concern: SHA-256 hash with unusual API key values, but this is low risk for normal strings.
