import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
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

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("song_requests")
    .update({ vibe })
    .eq("id", requestId);

  if (error) {
    console.error("vibe update failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
