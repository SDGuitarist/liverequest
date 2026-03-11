import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RequestQueue } from "@/components/request-queue";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { SetlistManager } from "@/components/setlist-manager";
import { isAuthenticated } from "@/lib/auth";
import type { Song } from "@/lib/supabase/types";

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

  // Fetch initial grouped requests + all songs (including inactive) in parallel
  const [{ data: requests }, { data: songs }] = await Promise.all([
    supabase
      .from("song_requests")
      .select("id, song_id, created_at, played_at, vibe, songs(id, title, artist)")
      .eq("gig_id", gig.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("songs")
      .select("*")
      .order("title", { ascending: true }),
  ]);

  // DB CHECK constraint guarantees vibe is a valid Vibe value — safe to narrow
  return (
    <DashboardTabs
      requestsContent={
        <RequestQueue gig={gig} initialRequests={(requests ?? []) as Parameters<typeof RequestQueue>[0]["initialRequests"]} />
      }
      setlistContent={
        <SetlistManager songs={(songs ?? []) as Song[]} />
      }
    />
  );
}
