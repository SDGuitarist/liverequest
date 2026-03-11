"use client";

import { useState, useRef, useCallback } from "react";
import type { Song } from "@/lib/supabase/types";

interface SetlistManagerProps {
  songs: Song[];
}

export function SetlistManager({ songs: initialSongs }: SetlistManagerProps) {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [inFlightIds, setInFlightIds] = useState<Set<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  // Generation counter — bumped on every toggle. Self-heal refetches only
  // apply if the generation hasn't changed since the heal was scheduled.
  const generationRef = useRef(0);
  const healTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-fetch all songs from the server to self-heal stale optimistic state.
  // Only applies the result if no newer toggle has fired since scheduling.
  const refetchSongs = useCallback(async (expectedGen: number) => {
    try {
      const res = await fetch("/api/songs/list");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && generationRef.current === expectedGen) {
          setSongs(data);
        }
      }
    } catch {
      // Silent — self-heal is best-effort
    }
  }, []);

  const revertAndHeal = useCallback((songId: string, newActive: boolean) => {
    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, is_active: !newActive } : s))
    );
    const gen = generationRef.current;
    if (healTimerRef.current) clearTimeout(healTimerRef.current);
    healTimerRef.current = setTimeout(() => refetchSongs(gen), 2000);
  }, [refetchSongs]);

  const handleToggle = useCallback(async (songId: string, newActive: boolean) => {
    if (inFlight.current.has(songId)) return;
    inFlight.current.add(songId);
    setInFlightIds((prev) => new Set(prev).add(songId));

    // Bump generation — any pending self-heal from an older toggle is now stale
    generationRef.current++;
    if (healTimerRef.current) {
      clearTimeout(healTimerRef.current);
      healTimerRef.current = null;
    }

    // Optimistic update
    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, is_active: newActive } : s))
    );

    try {
      const res = await fetch("/api/songs/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, isActive: newActive }),
      });

      // Only keep optimistic state if API explicitly confirms success
      let confirmed = false;
      if (res.ok) {
        try {
          const json = await res.json();
          confirmed = json?.success === true;
        } catch {
          // JSON parse failure — treat as unconfirmed
        }
      }

      if (!confirmed) {
        revertAndHeal(songId, newActive);
      }
    } catch {
      // Network error — revert + self-heal
      revertAndHeal(songId, newActive);
    } finally {
      inFlight.current.delete(songId);
      setInFlightIds((prev) => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
    }
  }, [revertAndHeal]);

  const activeCount = songs.filter((s) => s.is_active).length;

  return (
    <div className="px-5 pt-4 pb-8">
      {/* Summary */}
      <p className="font-body text-caption text-text-secondary mb-4">
        {activeCount} of {songs.length} songs active
      </p>

      {/* Song list */}
      <div className="flex flex-col gap-2">
        {songs.map((song) => (
          <div
            key={song.id}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-[border-color,opacity] duration-200 ${
              song.is_active
                ? "bg-surface-raised border-white/[0.06]"
                : "bg-surface-raised/50 border-white/[0.04] opacity-60"
            }`}
          >
            {/* Song info */}
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-song text-text-primary truncate">
                {song.title}
              </p>
              {song.artist && (
                <p className="font-body text-caption text-text-secondary truncate mt-0.5">
                  {song.artist}
                </p>
              )}
            </div>

            {/* Toggle switch */}
            <button
              role="switch"
              aria-checked={song.is_active}
              aria-label={`${song.is_active ? "Hide" : "Show"} ${song.title}`}
              disabled={inFlightIds.has(song.id)}
              onClick={() => handleToggle(song.id, !song.is_active)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
                song.is_active ? "bg-accent" : "bg-white/[0.12]"
              } disabled:opacity-50 disabled:cursor-wait`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  song.is_active ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
