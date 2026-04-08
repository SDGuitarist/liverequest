import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { isUUID } from "@/lib/validation";
import { VIBE_VALUES, type Vibe } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { requestId, vibe } = body as Record<string, unknown>;
  if (typeof requestId !== "string" || typeof vibe !== "string") {
    return NextResponse.json({ error: "Missing requestId or vibe" }, { status: 400 });
  }
  if (!isUUID(requestId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }
  if (!VIBE_VALUES.includes(vibe as Vibe)) {
    return NextResponse.json({ error: "Invalid vibe value" }, { status: 400 });
  }

  // Anon client — RLS enforces: vibe IS NULL (no re-setting), column-level
  // GRANT UPDATE (vibe) only, WITH CHECK (vibe in (...)).
  const supabase = createAnonClient();

  // CAS-style: select the updated row to distinguish "no row matched RLS"
  // from a real DB error. RLS blocks updates where vibe is already set.
  const { data, error } = await supabase
    .from("song_requests")
    .update({ vibe })
    .eq("id", requestId)
    .select("id")
    .single();

  if (error && error.code === "PGRST116") {
    // PGRST116 = "The result contains 0 rows" — RLS filtered the update
    // (vibe already set, or request not found)
    return NextResponse.json({ error: "Vibe already set or request not found" }, { status: 409 });
  }

  if (error) {
    console.error("vibe update failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
