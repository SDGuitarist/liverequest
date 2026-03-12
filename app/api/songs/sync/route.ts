import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isValidSyncApiKey } from "@/lib/sync-auth";

export const dynamic = "force-dynamic";

type CatalogSong = {
  id: string;
  title: string;
  artist: string | null;
  is_active: boolean;
};

type SyncSongInput = {
  title: string;
  artist: string;
};

type SyncSongMatch = {
  song_id: string;
  title: string;
  artist: string;
};

type SyncSongAmbiguous = SyncSongInput & {
  matches: SyncSongMatch[];
};

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function toInputSong(
  value: Record<string, unknown>,
): SyncSongInput | null {
  if (typeof value.title !== "string" || value.title.trim() === "") {
    return null;
  }

  if (
    value.artist !== undefined &&
    value.artist !== null &&
    typeof value.artist !== "string"
  ) {
    return null;
  }

  return {
    title: value.title.trim(),
    artist: typeof value.artist === "string" ? value.artist.trim() : "",
  };
}

function parseSongs(body: unknown): SyncSongInput[] | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const songs = (body as { songs?: unknown }).songs;
  if (!Array.isArray(songs)) {
    return null;
  }

  const parsed: SyncSongInput[] = [];
  for (const item of songs) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const song = toInputSong(item as Record<string, unknown>);
    if (!song) {
      return null;
    }
    parsed.push(song);
  }

  return parsed;
}

function toMatch(song: CatalogSong): SyncSongMatch {
  return {
    song_id: song.id,
    title: song.title,
    artist: song.artist?.trim() ?? "",
  };
}

export async function POST(request: NextRequest) {
  if (!isValidSyncApiKey(request.headers.get("x-api-key"))) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }

  const songs = parseSongs(body);
  if (songs === null) {
    return jsonNoStore(
      { error: "Body must be { songs: [{ title, artist? }] }" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("songs")
    .select("id, title, artist, is_active");

  if (error) {
    console.error("song sync fetch failed:", error.code, error.message);
    return jsonNoStore({ error: "Operation failed" }, { status: 500 });
  }

  const catalog = (data ?? []) as CatalogSong[];
  const matched: SyncSongMatch[] = [];
  const alreadyActive: SyncSongMatch[] = [];
  const unmatched: SyncSongInput[] = [];
  const ambiguous: SyncSongAmbiguous[] = [];
  const idsToActivate = new Set<string>();

  for (const song of songs) {
    const matches = catalog.filter(
      (catalogSong) =>
        normalizeValue(catalogSong.title) === normalizeValue(song.title) &&
        normalizeValue(catalogSong.artist) === normalizeValue(song.artist),
    );

    if (matches.length === 0) {
      unmatched.push(song);
      continue;
    }

    if (matches.length > 1) {
      ambiguous.push({
        ...song,
        matches: matches.map(toMatch),
      });
      continue;
    }

    const match = matches[0];
    if (match.is_active) {
      alreadyActive.push(toMatch(match));
      continue;
    }

    matched.push(toMatch(match));
    idsToActivate.add(match.id);
  }

  if (idsToActivate.size > 0) {
    const { error: updateError } = await supabase
      .from("songs")
      .update({ is_active: true })
      .in("id", Array.from(idsToActivate));

    if (updateError) {
      console.error("song sync update failed:", updateError.code, updateError.message);
      return jsonNoStore({ error: "Operation failed" }, { status: 500 });
    }

  }

  return jsonNoStore({
    matched,
    already_active: alreadyActive,
    unmatched,
    ambiguous,
  });
}
