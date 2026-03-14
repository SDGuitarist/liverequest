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

  const { session_id } = body as Record<string, unknown>;
  if (typeof session_id !== "string" || !isUUID(session_id)) {
    return NextResponse.json({ error: "Invalid session_id" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Find the most recent song_log for this session
  const { data: lastLog, error: fetchError } = await supabase
    .from("song_logs")
    .select("id")
    .eq("session_id", session_id)
    .order("set_position", { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !lastLog) {
    return NextResponse.json({ error: "No log to undo" }, { status: 404 });
  }

  const { error } = await supabase
    .from("song_logs")
    .delete()
    .eq("id", lastLog.id);

  if (error) {
    console.error("undo-log failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
