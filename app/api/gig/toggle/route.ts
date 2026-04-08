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

  const { gigId, requestsOpen } = body as Record<string, unknown>;
  if (typeof gigId !== "string" || typeof requestsOpen !== "boolean") {
    return NextResponse.json({ error: "Missing gigId or requestsOpen" }, { status: 400 });
  }
  if (!isUUID(gigId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Combined: verify gig is active + update in one query
  const { data, error } = await supabase
    .from("gigs")
    .update({ requests_open: requestsOpen })
    .eq("id", gigId)
    .eq("is_active", true)
    .select("id")
    .single();

  if (error && error.code === "PGRST116") {
    return NextResponse.json({ error: "Gig not found or inactive" }, { status: 404 });
  }
  if (error) {
    console.error("toggle failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Gig not found or inactive" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
