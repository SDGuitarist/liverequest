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

  // Verify performer owns this gig
  const { data: gig } = await supabase
    .from("gigs")
    .select("id")
    .eq("id", gigId)
    .eq("is_active", true)
    .single();
  if (!gig) {
    return NextResponse.json({ error: "Gig not found or inactive" }, { status: 404 });
  }

  const { error } = await supabase
    .from("gigs")
    .update({ requests_open: requestsOpen })
    .eq("id", gigId);

  if (error) {
    console.error("toggle failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
