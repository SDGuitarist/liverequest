import { createClient } from "@/lib/supabase/server";
import { SongList } from "@/components/song-list";

// ISR: regenerate every 60 seconds (song list doesn't change during a set)
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AudiencePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // For MVP: one performer, hardcoded slug. Just validate it matches.
  if (slug !== "alejandro") {
    return (
      <div className="flex min-h-screen items-center justify-center px-8">
        <p className="font-body text-body text-text-secondary text-center">
          Performer not found.
        </p>
      </div>
    );
  }

  // Fetch the active gig
  const { data: gig } = await supabase
    .from("gigs")
    .select("*")
    .eq("is_active", true)
    .single();

  // No active gig or requests closed → fallback
  if (!gig || !gig.requests_open) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8">
        <div className="text-center">
          <h1 className="font-display text-title font-bold text-text-primary">
            LiveRequest
          </h1>
          <p className="mt-3 font-body text-body text-text-secondary">
            No active show right now — check back soon!
          </p>
        </div>
      </div>
    );
  }

  // Fetch active songs, sorted
  const { data: songs } = await supabase
    .from("songs")
    .select("*")
    .eq("is_active", true)
    .order("title", { ascending: true });

  if (!songs || songs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8">
        <p className="font-body text-body text-text-secondary text-center">
          No songs available right now.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="font-display text-title font-bold text-text-primary">
          LiveRequest
        </h1>
        <p className="mt-1 font-body text-caption text-text-secondary">
          {gig.venue_name} &middot; Tap a song to request it
        </p>
      </div>

      <SongList songs={songs} gig={gig} />
    </div>
  );
}
