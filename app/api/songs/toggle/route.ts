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

  const { songId, isActive } = body as Record<string, unknown>;
  if (typeof songId !== "string" || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "Missing songId or isActive" }, { status: 400 });
  }
  if (!isUUID(songId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("songs")
    .update({ is_active: isActive })
    .eq("id", songId)
    .select("id");

  if (error) {
    console.error("song toggle failed:", error.code, error.message);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  revalidatePath("/r/alejandro");

  return NextResponse.json({ success: true });
}
