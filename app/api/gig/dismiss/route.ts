import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { gigId, songId } = body as Record<string, unknown>;
  if (typeof gigId !== "string" || typeof songId !== "string") {
    return NextResponse.json({ error: "Missing gigId or songId" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("song_requests")
    .delete()
    .eq("gig_id", gigId)
    .eq("song_id", songId);

  if (error) {
    console.error("Supabase error:", error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
