import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { isUUID } from "@/lib/validation";
import { OVERALL_FEEL_VALUES, type PostSetData } from "@/lib/supabase/types";
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

  const { session_id, debrief } = body as Record<string, unknown>;
  if (typeof session_id !== "string" || !isUUID(session_id)) {
    return NextResponse.json({ error: "Invalid session_id" }, { status: 400 });
  }
  if (typeof debrief !== "object" || debrief === null) {
    return NextResponse.json({ error: "Missing debrief data" }, { status: 400 });
  }

  const d = debrief as Record<string, unknown>;

  // Validate required fields
  if (typeof d.overall_feel !== "string" || !OVERALL_FEEL_VALUES.includes(d.overall_feel as never)) {
    return NextResponse.json({ error: "Invalid overall_feel" }, { status: 400 });
  }
  if (typeof d.walkup_count !== "number" || d.walkup_count < 0) {
    return NextResponse.json({ error: "Invalid walkup_count" }, { status: 400 });
  }
  if (typeof d.tips_received !== "boolean") {
    return NextResponse.json({ error: "Invalid tips_received" }, { status: 400 });
  }
  if (typeof d.complaints_received !== "boolean") {
    return NextResponse.json({ error: "Invalid complaints_received" }, { status: 400 });
  }
  if (!Number.isInteger(d.walkup_count) || d.walkup_count > 500) {
    return NextResponse.json({ error: "Invalid walkup_count" }, { status: 400 });
  }

  // Length caps on free-text fields
  const MAX_TEXT = 2000;
  for (const field of ["setlist_deviations", "staff_feedback", "observations"] as const) {
    if (typeof d[field] === "string" && (d[field] as string).length > MAX_TEXT) {
      return NextResponse.json({ error: `${field} too long (max ${MAX_TEXT})` }, { status: 400 });
    }
  }

  const postSetData: PostSetData = {
    version: 1,
    setlist_deviations: typeof d.setlist_deviations === "string" ? d.setlist_deviations : null,
    walkup_count: d.walkup_count,
    tips_received: d.tips_received,
    staff_feedback: typeof d.staff_feedback === "string" ? d.staff_feedback : null,
    overall_feel: d.overall_feel as PostSetData["overall_feel"],
    complaints_received: d.complaints_received,
    observations: typeof d.observations === "string" ? d.observations : null,
  };

  const supabase = createServiceClient();

  // Atomic CAS: update only if status is post_set (matches go-live/end-set pattern)
  const { data, error } = await supabase
    .from("performance_sessions")
    .update({ post_set_data: postSetData, status: "complete" })
    .eq("id", session_id)
    .eq("status", "post_set")
    .select("id")
    .single();

  if (!data && !error) {
    return NextResponse.json(
      { error: "Session not found or not in post_set status" },
      { status: 409 }
    );
  }
  if (error) {
    console.error("submit-debrief failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  revalidatePath("/performer/dashboard");

  return NextResponse.json({ success: true });
}
