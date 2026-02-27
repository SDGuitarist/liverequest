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

  const { gigId, requestsOpen } = await request.json();

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
