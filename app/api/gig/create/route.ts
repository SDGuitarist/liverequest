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

  const { venue_name, gig_date } = body as Record<string, unknown>;
  if (typeof venue_name !== "string" || !venue_name.trim()) {
    return NextResponse.json({ error: "Missing venue_name" }, { status: 400 });
  }
  if (typeof gig_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(gig_date)) {
    return NextResponse.json(
      { error: "Missing or invalid gig_date (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // Deactivate any currently active gig (only one can be active)
  await supabase
    .from("gigs")
    .update({ is_active: false })
    .eq("is_active", true);

  // Create the new gig as active
  const { data, error } = await supabase
    .from("gigs")
    .insert({
      venue_name: venue_name.trim(),
      gig_date,
      is_active: true,
      requests_open: false,
    })
    .select("id, venue_name, gig_date, is_active")
    .single();

  if (error) {
    console.error("gig create failed:", error.code, error.message);
    return NextResponse.json({ error: "Gig creation failed" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
