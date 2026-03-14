import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { isUUID } from "@/lib/validation";
import { revalidatePath } from "next/cache";

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

  // Verify session exists and is in pre_set status
  const { data: session, error: fetchError } = await supabase
    .from("performance_sessions")
    .select("id, status")
    .eq("id", session_id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "pre_set") {
    return NextResponse.json(
      { error: `Cannot go live from status: ${session.status}` },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("performance_sessions")
    .update({ status: "live", started_at: new Date().toISOString() })
    .eq("id", session_id);

  if (error) {
    console.error("go-live failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  revalidatePath("/performer/dashboard");

  return NextResponse.json({ success: true });
}
