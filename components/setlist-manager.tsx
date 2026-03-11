"use client";

import { useState, useRef, useCallback } from "react";
import type { Song } from "@/lib/supabase/types";

interface SetlistManagerProps {
  songs: Song[];
}

export function SetlistManager({ songs: initialSongs }: SetlistManagerProps) {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const inFlight = useRef(new Set<string>());

  const handleToggle = useCallback(async (songId: string, newActive: boolean) => {
    if (inFlight.current.has(songId)) return;
    inFlight.current.add(songId);

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

      if (!res.ok) {
        // Revert optimistic update
        setSongs((prev) =>
          prev.map((s) => (s.id === songId ? { ...s, is_active: !newActive } : s))
        );
      }
    } catch {
      // Revert on network error + self-heal refetch
      setSongs((prev) =>
        prev.map((s) => (s.id === songId ? { ...s, is_active: !newActive } : s))
      );
    } finally {
      inFlight.current.delete(songId);
    }
  }, []);

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
              onClick={() => handleToggle(song.id, !song.is_active)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
                song.is_active ? "bg-accent" : "bg-white/[0.12]"
              }`}
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
