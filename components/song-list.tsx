"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import type { Song, Gig } from "@/lib/supabase/types";
import { SongCard, IDLE_STATE } from "./song-card";
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

const REQUEST_LIMIT = 5;

export function SongList({ songs, gig }: SongListProps) {
  const [search, setSearch] = useState("");
  const [requestStates, setRequestStates] = useState<
    Record<string, RequestState>
  >({});
  const [overlaySong, setOverlaySong] = useState<Song | null>(null);
  const [requestCount, setRequestCount] = useState<number | null>(null);

  // Pessimistic counter — reserves slots before async insert completes
  const pendingCount = useRef(0);
  const totalSent = Object.values(requestStates).filter(
    (s) => s.status === "sent"
  ).length;

  const filteredSongs = useMemo(() => {
    const q = search.toLowerCase();
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(q) ||
        (song.artist && song.artist.toLowerCase().includes(q))
    );
  }, [songs, search]);

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
    setRequestCount(null); // Reset — count will arrive async
  }, []);

  const handleCountUpdate = useCallback((count: number) => {
    setRequestCount(count);
  }, []);

  const atLimit = totalSent + pendingCount.current >= REQUEST_LIMIT;

  return (
    <>
      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 px-5 pt-3 pb-3 bg-surface/72 backdrop-blur-[24px] backdrop-saturate-150 border-b border-white/[0.06]">
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search songs or artists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white/[0.04] text-text-primary font-body text-body placeholder:text-text-muted border border-white/[0.06] focus:border-accent/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.06)] focus:outline-none transition-[border-color,background-color,box-shadow] duration-200"
          />
        </div>
        {atLimit ? (
          <div className="mt-2.5 mx-auto w-fit px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
            <p className="text-center font-body text-caption text-accent">
              You&apos;ve used all {REQUEST_LIMIT} requests!
            </p>
          </div>
        ) : totalSent > 0 ? (
          <div className="mt-2.5 mx-auto w-fit px-3 py-1 rounded-full bg-surface-raised border border-white/[0.06]">
            <p className="text-center font-body text-caption text-text-secondary">
              {REQUEST_LIMIT - totalSent} request{REQUEST_LIMIT - totalSent !== 1 ? "s" : ""} remaining
            </p>
          </div>
        ) : null}
      </div>

      {/* Song count */}
      <div className="px-5 pt-3 pb-1">
        <p className="font-body text-caption text-text-muted">
          {filteredSongs.length} song{filteredSongs.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Song list */}
      <div className="px-5 pb-8 flex flex-col gap-2.5">
        {filteredSongs.length === 0 ? (
          <p className="text-center text-text-muted font-body text-body py-12">
            No songs found
          </p>
        ) : (
          filteredSongs.map((song, i) => {
            const state = requestStates[song.id] ?? IDLE_STATE;
            // If at limit and this song hasn't been sent yet, show as idle but won't submit
            const effectiveState =
              atLimit && state.status === "idle"
                ? ({ status: "sent" } as RequestState)
                : state;

            return (
              <div
                key={song.id}
                className="stagger-item"
                style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}
              >
                <SongCard
                  song={song}
                  gigId={gig.id}
                  requestState={effectiveState}
                  onStateChange={handleStateChange}
                  onSuccess={handleSuccess}
                  onCountUpdate={handleCountUpdate}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation overlay */}
      {overlaySong && (
        <ConfirmationOverlay
          song={overlaySong}
          venueName={gig.venue_name}
          requestCount={requestCount}
          onDismiss={() => setOverlaySong(null)}
        />
      )}
    </>
  );
}
