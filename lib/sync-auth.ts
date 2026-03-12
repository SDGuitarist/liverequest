import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { requireEnv } from "@/lib/env";

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
