import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { isUUID } from "@/lib/validation";
import { SONG_QUALITY_VALUES, VOLUME_CAL_VALUES } from "@/lib/supabase/types";

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

  const { session_id, song_id, song_title, song_quality, volume_calibration, guest_acknowledgment } =
    body as Record<string, unknown>;

  if (typeof session_id !== "string" || !isUUID(session_id)) {
    return NextResponse.json({ error: "Invalid session_id" }, { status: 400 });
  }
  // song_id is nullable (walkup songs use song_title instead)
  if (song_id !== undefined && song_id !== null && (typeof song_id !== "string" || !isUUID(song_id))) {
    return NextResponse.json({ error: "Invalid song_id" }, { status: 400 });
  }
  if (!song_id && (typeof song_title !== "string" || song_title.trim().length === 0)) {
    return NextResponse.json({ error: "song_id or song_title is required" }, { status: 400 });
  }
  if (typeof song_title === "string" && song_title.trim().length > 200) {
    return NextResponse.json({ error: "song_title too long (max 200)" }, { status: 400 });
  }
  if (typeof song_quality !== "string" || !SONG_QUALITY_VALUES.includes(song_quality as never)) {
    return NextResponse.json({ error: "Invalid song_quality" }, { status: 400 });
  }
  if (typeof volume_calibration !== "string" || !VOLUME_CAL_VALUES.includes(volume_calibration as never)) {
    return NextResponse.json({ error: "Invalid volume_calibration" }, { status: 400 });
  }
  if (typeof guest_acknowledgment !== "boolean") {
    return NextResponse.json({ error: "Invalid guest_acknowledgment" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify session is live before accepting logs
  const { data: session } = await supabase
    .from("performance_sessions")
    .select("status")
    .eq("id", session_id)
    .single();

  if (!session || session.status !== "live") {
    return NextResponse.json({ error: "Session is not live" }, { status: 409 });
  }

  // Auto-assign set_position
  const { data: maxPos } = await supabase
    .from("song_logs")
    .select("set_position")
    .eq("session_id", session_id)
    .order("set_position", { ascending: false })
    .limit(1)
    .single();

  const set_position = (maxPos?.set_position ?? 0) + 1;

  const { data, error } = await supabase
    .from("song_logs")
    .insert({
      session_id,
      song_id: (song_id as string) ?? null,
      song_title: typeof song_title === "string" ? song_title.trim() : null,
      song_quality,
      volume_calibration,
      guest_acknowledgment,
      set_position,
    })
    .select("*")
    .single();

  if (error) {
    console.error("log-song failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
