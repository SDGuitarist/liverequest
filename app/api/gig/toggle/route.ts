import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Check performer auth
  const cookieStore = await cookies();
  const auth = cookieStore.get("performer_auth");
  if (!auth || auth.value !== "authenticated") {
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

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("gigs")
    .update({ requests_open: requestsOpen })
    .eq("id", gigId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
