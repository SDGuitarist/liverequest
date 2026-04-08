import { createAnonClient } from "@/lib/supabase/server";
import { SongList } from "@/components/song-list";

// ISR: regenerate every 60 seconds (song list doesn't change during a set)
// force-static ensures Next.js caches despite non-Next.js fetch calls (Supabase client)
export const dynamic = "force-static";
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AudiencePage({ params }: PageProps) {
  const { slug } = await params;
  // Anon client without cookies — respects RLS, doesn't defeat ISR caching
  const supabase = createAnonClient();

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
    <div
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(ellipse at 20% 0%, rgba(245, 158, 11, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(245, 158, 11, 0.05) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(245, 158, 11, 0.03) 0%, transparent 60%),
          #0D0D0F
        `,
      }}
    >
      {/* Header with amber glow */}
      <div className="relative px-5 pt-8 pb-4 overflow-hidden">
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[300px] h-[200px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="font-body text-label uppercase tracking-widest text-accent">
              Live Now
            </span>
          </div>
          <h1 className="mt-2 font-display text-title font-bold text-text-primary tracking-tight">
            LiveRequest
          </h1>
          <p className="mt-1 font-body text-caption text-text-secondary">
            {gig.venue_name} &middot; Tap a song to request it
          </p>
        </div>
      </div>

      <SongList songs={songs} gig={gig} />
    </div>
  );
}
