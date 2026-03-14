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

  // Atomic: only updates if status is still live (no TOCTOU gap)
  const { data, error } = await supabase
    .from("performance_sessions")
    .update({ status: "post_set", ended_at: new Date().toISOString() })
    .eq("id", session_id)
    .eq("status", "live")
    .select("id")
    .single();

  if (error || !data) {
    if (!data && !error) {
      return NextResponse.json(
        { error: "Session not found or not in live status" },
        { status: 409 }
      );
    }
    console.error("end-set failed:", error?.code, error?.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  revalidatePath("/performer/dashboard");

  return NextResponse.json({ success: true });
}
