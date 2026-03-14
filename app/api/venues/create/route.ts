import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
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

  const { name, address, notes, default_configuration, default_genre_style } =
    body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (address !== undefined && typeof address !== "string") {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (
    default_configuration !== undefined &&
    default_configuration !== null &&
    !CONFIGURATION_VALUES.includes(default_configuration as never)
  ) {
    return NextResponse.json({ error: "Invalid configuration" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("venues")
    .insert({
      name: name.trim(),
      address: typeof address === "string" ? address.trim() : null,
      notes: typeof notes === "string" ? notes.trim() : null,
      default_configuration: (default_configuration as string) ?? null,
      default_genre_style: typeof default_genre_style === "string" ? default_genre_style.trim() : null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("venue create failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
