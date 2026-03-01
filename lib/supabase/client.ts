import { createBrowserClient } from "@supabase/ssr";
import { Database } from "./database.types";

// NEXT_PUBLIC_* vars must be accessed as static strings —
// Next.js inlines them at build time and dynamic lookups
// (like requireEnv) return undefined in client bundles.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient<Database>(url, key);
}
