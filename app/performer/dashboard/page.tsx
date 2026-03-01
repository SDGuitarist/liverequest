import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RequestQueue } from "@/components/request-queue";
import { isAuthenticated } from "@/lib/auth";

// Don't cache — dashboard must always show fresh data
export const dynamic = "force-dynamic";

export default async function PerformerDashboard() {
  if (!(await isAuthenticated())) {
    redirect("/performer");
  }

  const supabase = await createClient();

  // Fetch the active gig
  const { data: gig } = await supabase
    .from("gigs")
    .select("*")
    .eq("is_active", true)
    .single();

  if (!gig) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8">
        <div className="text-center">
          <h1 className="font-display text-title font-bold text-text-primary">
            No Active Gig
          </h1>
          <p className="mt-3 font-body text-body text-text-secondary">
            Create a gig in Supabase and set is_active = true.
          </p>
        </div>
      </div>
    );
  }

  // Fetch initial grouped requests
  const { data: requests } = await supabase
    .from("song_requests")
    .select("id, song_id, created_at, played_at, songs(id, title, artist)")
    .eq("gig_id", gig.id)
    .order("created_at", { ascending: false });

  return <RequestQueue gig={gig} initialRequests={requests ?? []} />;
}
