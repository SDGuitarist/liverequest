import { cookies } from "next/headers";
import crypto from "crypto";

// In-memory token store (fine for single-instance MVP)
const validTokens = new Set<string>();

export function createAuthToken(): string {
  const token = crypto.randomUUID();
  validTokens.add(token);
  return token;
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const auth = cookieStore.get("performer_auth");
  return !!auth && validTokens.has(auth.value);
}
