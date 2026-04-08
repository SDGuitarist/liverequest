import { createServiceClient } from "@/lib/supabase/server";
import type { PostSetData } from "@/lib/supabase/types";

// ============================================
// GIFT DATA TYPES
// ============================================

export interface GiftData {
  gig: { id: string; venue_name: string; gig_date: string };
  requests: {
    total: number;
    played: number;
    responseRate: number; // played / total, 0 when total === 0
    peakHour: string | null; // "8:00 PM", null when no requests
    topSongs: { title: string; artist: string | null; count: number }[];
    vibes: { fire: number; more_energy: number; softer: number };
  };
  sessions: {
    setNumber: number;
    configuration: string;
    genreStyle: string | null;
    durationMinutes: number | null;
    songLogs: {
      total: number;
      quality: { off: number; fine: number; locked_in: number };
      volumeCorrect: number;
      guestAck: number;
    };
    debrief: PostSetData | null;
  }[];
  hasStream2: boolean;
}

// ============================================
// DATA AGGREGATION
// ============================================

export async function getGiftData(gigId: string): Promise<GiftData | null> {
  const supabase = createServiceClient();

  // Parallel queries — 3 independent, 1 dependent on sessions
  const [gigResult, requestsResult, sessionsResult] = await Promise.all([
    supabase.from("gigs").select("id, venue_name, gig_date").eq("id", gigId).single(),
    supabase.from("song_requests").select("id, song_id, created_at, played_at, vibe, songs(title, artist)").eq("gig_id", gigId),
    supabase.from("performance_sessions").select("*").eq("gig_id", gigId).in("status", ["complete", "post_set"]).order("set_number"),
  ]);

  if (gigResult.error || !gigResult.data) return null;

  const gig = gigResult.data;
  const requests = requestsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];

  // Dependent query: song logs for fetched sessions
  const sessionIds = sessions.map((s) => s.id);
  const logsResult = sessionIds.length > 0
    ? await supabase.from("song_logs").select("*").in("session_id", sessionIds)
    : { data: [] as { session_id: string; song_quality: string; volume_calibration: string; guest_acknowledgment: boolean }[] };
  const allLogs = logsResult.data ?? [];

  // ── Request aggregation ──
  const played = requests.filter((r) => r.played_at !== null).length;
  const total = requests.length;

  // Peak hour
  const peakHour = computePeakHour(requests);

  // Top 5 songs (filter out null song_id as safety guard)
  const topSongs = computeTopSongs(requests);

  // Vibe distribution
  const vibes = { fire: 0, more_energy: 0, softer: 0 };
  for (const r of requests) {
    if (r.vibe === "fire") vibes.fire++;
    else if (r.vibe === "more_energy") vibes.more_energy++;
    else if (r.vibe === "softer") vibes.softer++;
  }

  // ── Session aggregation ──
  const sessionData = sessions.map((s) => {
    const sessionLogs = allLogs.filter((l) => l.session_id === s.id);
    const quality = { off: 0, fine: 0, locked_in: 0 };
    let volumeCorrect = 0;
    let guestAck = 0;

    for (const log of sessionLogs) {
      if (log.song_quality === "off") quality.off++;
      else if (log.song_quality === "fine") quality.fine++;
      else if (log.song_quality === "locked_in") quality.locked_in++;
      if (log.volume_calibration === "right") volumeCorrect++;
      if (log.guest_acknowledgment) guestAck++;
    }

    // Duration in minutes
    let durationMinutes: number | null = null;
    if (s.started_at && s.ended_at) {
      durationMinutes = Math.round(
        (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000
      );
    }

    return {
      setNumber: s.set_number,
      configuration: s.configuration,
      genreStyle: s.genre_style,
      durationMinutes,
      songLogs: { total: sessionLogs.length, quality, volumeCorrect, guestAck },
      debrief: s.status === "complete" && s.post_set_data
        ? (s.post_set_data as unknown as PostSetData)
        : null,
    };
  });

  return {
    gig: { id: gig.id, venue_name: gig.venue_name, gig_date: gig.gig_date },
    requests: {
      total,
      played,
      responseRate: total > 0 ? played / total : 0,
      peakHour,
      topSongs,
      vibes,
    },
    sessions: sessionData,
    hasStream2: sessionData.length > 0,
  };
}

// ============================================
// HELPERS
// ============================================

function computePeakHour(
  requests: { created_at: string }[]
): string | null {
  if (requests.length === 0) return null;

  const hourCounts = new Map<number, number>();
  for (const r of requests) {
    const hour = new Date(r.created_at).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  let peakHour = 0;
  let peakCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > peakCount) {
      peakHour = hour;
      peakCount = count;
    }
  }

  // Format as "8:00 PM"
  const ampm = peakHour >= 12 ? "PM" : "AM";
  const displayHour = peakHour % 12 || 12;
  return `${displayHour}:00 ${ampm}`;
}

function computeTopSongs(
  requests: { song_id: string; songs: { title: string; artist: string | null } | null }[]
): { title: string; artist: string | null; count: number }[] {
  const songCounts = new Map<string, { title: string; artist: string | null; count: number }>();

  for (const r of requests) {
    if (!r.song_id || !r.songs) continue; // safety guard for null song_id
    const existing = songCounts.get(r.song_id);
    if (existing) {
      existing.count++;
    } else {
      songCounts.set(r.song_id, {
        title: r.songs.title,
        artist: r.songs.artist,
        count: 1,
      });
    }
  }

  return Array.from(songCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
