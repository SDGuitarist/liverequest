import { createServiceClient } from "@/lib/supabase/server";
import { isVibe } from "@/lib/supabase/types";

// ============================================
// TYPES
// ============================================

export interface GigStats {
  id: string;
  venue_name: string;
  gig_date: string;
  requests: { total: number; played: number };
  vibes: { fire: number; more_energy: number; softer: number };
  peakHour: string | null;
  sessionCount: number;
}

/** Compute response rate safely — 0 when no requests */
export function responseRate(r: { total: number; played: number }): number {
  return r.total > 0 ? r.played / r.total : 0;
}

// ============================================
// DATA AGGREGATION
// ============================================

const GIG_TIMEZONE = "America/Los_Angeles";

export async function getHistoryStats(): Promise<GigStats[]> {
  const supabase = createServiceClient();

  // 3 parallel bulk queries — same pattern as existing history page
  const [gigsResult, allRequests, allSessions] = await Promise.all([
    supabase
      .from("gigs")
      .select("id, venue_name, gig_date")
      .eq("is_active", false)
      .order("gig_date", { ascending: false }),
    supabase
      .from("song_requests")
      .select("gig_id, played_at, vibe, created_at"),
    supabase
      .from("performance_sessions")
      .select("gig_id")
      .in("status", ["complete", "post_set"]),
  ]);

  if (gigsResult.error) throw gigsResult.error;
  if (allRequests.error) throw allRequests.error;
  if (allSessions.error) throw allSessions.error;

  if (!gigsResult.data || gigsResult.data.length === 0) return [];

  // Group requests by gig_id
  const requestsByGig = new Map<
    string,
    { played_at: string | null; vibe: string | null; created_at: string }[]
  >();
  for (const r of allRequests.data ?? []) {
    const list = requestsByGig.get(r.gig_id) ?? [];
    list.push(r);
    requestsByGig.set(r.gig_id, list);
  }

  // Count sessions by gig_id
  const sessionCounts = new Map<string, number>();
  for (const s of allSessions.data ?? []) {
    sessionCounts.set(s.gig_id, (sessionCounts.get(s.gig_id) ?? 0) + 1);
  }

  // Build stats per gig — filter out gigs with 0 requests AND 0 sessions
  const stats: GigStats[] = [];

  for (const gig of gigsResult.data) {
    const requests = requestsByGig.get(gig.id) ?? [];
    const sessCount = sessionCounts.get(gig.id) ?? 0;

    if (requests.length === 0 && sessCount === 0) continue;

    const played = requests.filter((r) => r.played_at !== null).length;
    const vibes = { fire: 0, more_energy: 0, softer: 0 };
    for (const r of requests) {
      if (r.vibe && isVibe(r.vibe)) {
        vibes[r.vibe]++;
      }
    }

    stats.push({
      id: gig.id,
      venue_name: gig.venue_name,
      gig_date: gig.gig_date,
      requests: { total: requests.length, played },
      vibes,
      peakHour: computePeakHour(requests),
      sessionCount: sessCount,
    });
  }

  return stats;
}

// ============================================
// HELPERS
// ============================================

function computePeakHour(
  requests: { created_at: string }[]
): string | null {
  if (requests.length === 0) return null;

  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: GIG_TIMEZONE,
  });

  const hourCounts = new Map<number, number>();
  for (const r of requests) {
    const localHour = parseInt(hourFormatter.format(new Date(r.created_at)), 10);
    hourCounts.set(localHour, (hourCounts.get(localHour) ?? 0) + 1);
  }

  let peakHour = 0;
  let peakCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > peakCount) {
      peakHour = hour;
      peakCount = count;
    }
  }

  const ampm = peakHour >= 12 ? "PM" : "AM";
  const displayHour = peakHour % 12 || 12;
  return `${displayHour}:00 ${ampm}`;
}
