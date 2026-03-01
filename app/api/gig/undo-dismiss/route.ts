import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { isUUID } from "@/lib/validation";

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
  if (!isUUID(gigId) || !isUUID(songId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify performer owns this gig
  const { data: gig } = await supabase
    .from("gigs")
    .select("id")
    .eq("id", gigId)
    .single();
  if (!gig) {
    return NextResponse.json({ error: "Gig not found" }, { status: 404 });
  }

  // Undo: clear played_at to restore to pending (only on already-played rows)
  const { error } = await supabase
    .from("song_requests")
    .update({ played_at: null })
    .eq("gig_id", gigId)
    .eq("song_id", songId)
    .not("played_at", "is", null);

  if (error) {
    console.error("undo-dismiss failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
