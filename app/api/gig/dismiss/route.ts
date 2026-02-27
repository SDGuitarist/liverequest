import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Check performer auth
  const cookieStore = await cookies();
  const auth = cookieStore.get("performer_auth");
  if (!auth || auth.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gigId, songId } = await request.json();

  const supabase = await createClient();
  const { error } = await supabase
    .from("song_requests")
    .delete()
    .eq("gig_id", gigId)
    .eq("song_id", songId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
