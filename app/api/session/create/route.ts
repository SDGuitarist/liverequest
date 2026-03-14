import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { isUUID } from "@/lib/validation";
import { CONFIGURATION_VALUES } from "@/lib/supabase/types";

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

  const { gig_id, venue_id, configuration, genre_style, set_number } =
    body as Record<string, unknown>;

  if (typeof gig_id !== "string" || !isUUID(gig_id)) {
    return NextResponse.json({ error: "Invalid gig_id" }, { status: 400 });
  }
  if (venue_id !== undefined && venue_id !== null && (typeof venue_id !== "string" || !isUUID(venue_id))) {
    return NextResponse.json({ error: "Invalid venue_id" }, { status: 400 });
  }
  if (typeof configuration !== "string" || !CONFIGURATION_VALUES.includes(configuration as never)) {
    return NextResponse.json({ error: "Invalid configuration" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("performance_sessions")
    .insert({
      gig_id,
      venue_id: (venue_id as string) ?? null,
      configuration,
      genre_style: typeof genre_style === "string" ? genre_style.trim() : null,
      set_number: typeof set_number === "number" ? set_number : 1,
      status: "pre_set",
    })
    .select("*")
    .single();

  if (error) {
    console.error("session create failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
