"use client";

import { useState, useRef, useCallback } from "react";
import type { Song, Gig } from "@/lib/supabase/types";
import { SongCard } from "./song-card";
import { ConfirmationOverlay } from "./confirmation-overlay";

type RequestState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "error"; message: string };

interface SongListProps {
  songs: Song[];
  gig: Gig;
}

const REQUEST_LIMIT = 2;

export function SongList({ songs, gig }: SongListProps) {
  const [search, setSearch] = useState("");
  const [requestStates, setRequestStates] = useState<
    Record<string, RequestState>
  >({});
  const [overlaySong, setOverlaySong] = useState<Song | null>(null);

  // Pessimistic counter — reserves slots before async insert completes
  const pendingCount = useRef(0);
  const totalSent = Object.values(requestStates).filter(
    (s) => s.status === "sent"
  ).length;

  const filteredSongs = songs.filter((song) => {
    const q = search.toLowerCase();
    return (
      song.title.toLowerCase().includes(q) ||
      (song.artist && song.artist.toLowerCase().includes(q))
    );
  });

  const handleStateChange = useCallback(
    (songId: string, state: RequestState) => {
      if (state.status === "sending") {
        pendingCount.current++;
      }
      if (
        state.status === "sent" ||
        state.status === "error" ||
        state.status === "idle"
      ) {
        pendingCount.current = Math.max(0, pendingCount.current - 1);
      }
      setRequestStates((prev) => ({ ...prev, [songId]: state }));
    },
    []
  );

  const handleSuccess = useCallback((song: Song) => {
    setOverlaySong(song);
  }, []);

  const atLimit = totalSent + pendingCount.current >= REQUEST_LIMIT;

  return (
    <>
      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 bg-surface/80 backdrop-blur-xl">
        <input
          type="text"
          placeholder="Search songs or artists..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-surface-raised text-text-primary font-body text-body placeholder:text-text-muted border border-surface-border focus:border-accent focus:outline-none transition-colors"
        />
        {atLimit && (
          <p className="mt-2 text-center font-body text-caption text-accent">
            You&apos;ve used all {REQUEST_LIMIT} requests!
          </p>
        )}
      </div>

      {/* Song list */}
      <div className="px-4 pb-8 flex flex-col gap-2">
        {filteredSongs.length === 0 ? (
          <p className="text-center text-text-muted font-body text-body py-12">
            No songs found
          </p>
        ) : (
          filteredSongs.map((song) => {
            const state = requestStates[song.id] ?? { status: "idle" };
            // If at limit and this song hasn't been sent yet, show as idle but won't submit
            const effectiveState =
              atLimit && state.status === "idle"
                ? ({ status: "sent" } as RequestState)
                : state;

            return (
              <SongCard
                key={song.id}
                song={song}
                gigId={gig.id}
                requestState={effectiveState}
                onStateChange={handleStateChange}
                onSuccess={handleSuccess}
              />
            );
          })
        )}
      </div>

      {/* Confirmation overlay */}
      {overlaySong && (
        <ConfirmationOverlay
          song={overlaySong}
          venueName={gig.venue_name}
          onDismiss={() => setOverlaySong(null)}
        />
      )}
    </>
  );
}
