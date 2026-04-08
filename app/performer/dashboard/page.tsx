import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { RequestQueue } from "@/components/request-queue";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { SetlistManager } from "@/components/setlist-manager";
import { PreSetForm } from "@/components/pre-set-form";
import { PostSetForm } from "@/components/post-set-form";
import { SongLogFab } from "@/components/song-log-fab";
import { isAuthenticated } from "@/lib/auth";
import type { Song, Venue, PerformanceSession, SessionStatus } from "@/lib/supabase/types";

// Don't cache — dashboard must always show fresh data
export const dynamic = "force-dynamic";

export default async function PerformerDashboard() {
  if (!(await isAuthenticated())) {
    redirect("/performer");
  }

  const supabase = await createClient();
  const supabaseService = createServiceClient();

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

  // Fetch the most recent session for this gig (session recovery)
  const { data: sessionRow } = await supabaseService
    .from("performance_sessions")
    .select("*")
    .eq("gig_id", gig.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const session = sessionRow as PerformanceSession | null;
  const phase: SessionStatus | "no_session" = session?.status ?? "no_session";

  // Fetch songs + venues in parallel (service client — bypasses RLS)
  const [{ data: songs }, { data: venueRows }] = await Promise.all([
    supabaseService
      .from("songs")
      .select("*")
      .order("title", { ascending: true }),
    supabaseService
      .from("venues")
      .select("*")
      .order("name"),
  ]);

  const allSongs = (songs ?? []) as Song[];
  const allVenues = (venueRows ?? []) as Venue[];

  // ── Pre-set or no session: show setup form ──
  if (phase === "no_session" || phase === "pre_set") {
    return (
      <PreSetForm
        gig={gig}
        session={session}
        songs={allSongs}
        venues={allVenues}
      />
    );
  }

  // ── Post-set: show debrief form ──
  if (phase === "post_set") {
    return (
      <PostSetForm session={session!} />
    );
  }

  // ── Complete: show "Start Next Set" option ──
  if (phase === "complete") {
    return (
      <PreSetForm
        gig={gig}
        session={null}
        songs={allSongs}
        venues={allVenues}
        previousSession={session!}
      />
    );
  }

  // ── Live: show normal dashboard with tabs + FAB ──
  const { data: requests } = await supabase
    .from("song_requests")
    .select("id, song_id, created_at, played_at, vibe, songs(id, title, artist)")
    .eq("gig_id", gig.id)
    .order("created_at", { ascending: false });

  // Fetch song logs for this session (to track what's been played)
  const { data: songLogs } = await supabaseService
    .from("song_logs")
    .select("*")
    .eq("session_id", session!.id)
    .order("set_position", { ascending: true });

  return (
    <>
      <DashboardTabs
        sessionId={session!.id}
        requestsContent={
          <RequestQueue gig={gig} initialRequests={(requests ?? []) as Parameters<typeof RequestQueue>[0]["initialRequests"]} songs={allSongs.map(s => ({ id: s.id, title: s.title, artist: s.artist }))} />
        }
        setlistContent={
          <SetlistManager songs={allSongs} />
        }
      />
      <SongLogFab
        sessionId={session!.id}
        songs={allSongs}
        initialLogs={(songLogs ?? []) as import("@/lib/supabase/types").SongLog[]}
      />
    </>
  );
}
