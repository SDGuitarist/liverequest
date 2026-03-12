import { NextRequest, NextResponse } from "next/server";

import { isValidSyncApiKey } from "@/lib/sync-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PlayedRow = {
  song_id: string;
  played_at: string | null;
};

type SongRow = {
  id: string;
  title: string;
  artist: string | null;
};

type GroupedPlayedEvent = {
  title: string;
  artist: string;
  played_at: string;
  request_count: number;
};

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(request: NextRequest) {
  if (!isValidSyncApiKey(request.headers.get("x-api-key"))) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: activeGig, error: activeGigError } = await supabase
    .from("gigs")
    .select("id, venue_name, gig_date")
    .eq("is_active", true)
    .maybeSingle();

  if (activeGigError) {
    console.error(
      "played sync active gig fetch failed:",
      activeGigError.code,
      activeGigError.message,
    );
    return jsonNoStore({ error: "Operation failed" }, { status: 500 });
  }

  if (!activeGig) {
    return jsonNoStore({ error: "No active gig" }, { status: 404 });
  }

  const { data: requestRows, error: requestRowsError } = await supabase
    .from("song_requests")
    .select("song_id, played_at")
    .eq("gig_id", activeGig.id)
    .not("played_at", "is", null);

  if (requestRowsError) {
    console.error(
      "played sync request fetch failed:",
      requestRowsError.code,
      requestRowsError.message,
    );
    if (requestRowsError.code === "42703") {
      return jsonNoStore(
        {
          error:
            "LiveRequest database is missing song_requests.played_at. Apply the existing played_at migration first.",
        },
        { status: 500 },
      );
    }
    return jsonNoStore({ error: "Operation failed" }, { status: 500 });
  }

  const playedRows = (requestRows ?? []) as PlayedRow[];
  const songIds = Array.from(new Set(playedRows.map((row) => row.song_id)));
  const songMap = new Map<string, SongRow>();

  if (songIds.length > 0) {
    const { data: songs, error: songsError } = await supabase
      .from("songs")
      .select("id, title, artist")
      .in("id", songIds);

    if (songsError) {
      console.error("played sync song fetch failed:", songsError.code, songsError.message);
      return jsonNoStore({ error: "Operation failed" }, { status: 500 });
    }

    for (const song of (songs ?? []) as SongRow[]) {
      songMap.set(song.id, song);
    }
  }

  const groupedEvents = new Map<string, GroupedPlayedEvent>();

  for (const row of playedRows) {
    if (!row.played_at) {
      continue;
    }

    const song = songMap.get(row.song_id);
    if (!song) {
      continue;
    }

    const key = `${row.song_id}::${row.played_at}`;
    const existing = groupedEvents.get(key);

    if (existing) {
      existing.request_count += 1;
      continue;
    }

    groupedEvents.set(key, {
      title: song.title,
      artist: song.artist?.trim() ?? "",
      played_at: row.played_at,
      request_count: 1,
    });
  }

  const playedEvents = Array.from(groupedEvents.values()).sort(
    (left, right) => Date.parse(left.played_at) - Date.parse(right.played_at),
  );

  return jsonNoStore({
    gig_id: activeGig.id,
    venue_name: activeGig.venue_name,
    gig_date: activeGig.gig_date,
    played_events: playedEvents,
  });
}
