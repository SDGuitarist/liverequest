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

  // Atomic: verify session is live + compute next set_position + insert
  // Returns null if session is not live or not found (zero rows from SELECT)
  const { data, error } = await supabase.rpc("insert_song_log", {
    p_session_id: session_id,
    p_song_id: (song_id as string) ?? null,
    p_song_title: typeof song_title === "string" ? song_title.trim() : null,
    p_song_quality: song_quality as string,
    p_volume_calibration: volume_calibration as string,
    p_guest_acknowledgment: guest_acknowledgment as boolean,
  });

  // Handle unique violation (23505) — concurrent insert won the race, retry once
  if (error && error.code === "23505") {
    const { data: retryData, error: retryError } = await supabase.rpc("insert_song_log", {
      p_session_id: session_id,
      p_song_id: (song_id as string) ?? null,
      p_song_title: typeof song_title === "string" ? song_title.trim() : null,
      p_song_quality: song_quality as string,
      p_volume_calibration: volume_calibration as string,
      p_guest_acknowledgment: guest_acknowledgment as boolean,
    });

    if (retryError) {
      console.error("log-song retry failed:", retryError.code, retryError.message);
      return NextResponse.json({ error: "Operation failed" }, { status: 500 });
    }
    if (!retryData) {
      return NextResponse.json({ error: "Session is not live" }, { status: 409 });
    }
    return NextResponse.json(retryData, { status: 201 });
  }

  if (error) {
    console.error("log-song failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  // RPC returns null when session is not live (WHERE clause filters out all rows)
  if (!data) {
    return NextResponse.json({ error: "Session is not live" }, { status: 409 });
  }

  return NextResponse.json(data, { status: 201 });
}
