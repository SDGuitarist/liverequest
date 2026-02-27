"use client";

import { useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSessionId } from "@/lib/session";
import type { Song } from "@/lib/supabase/types";

type RequestState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "error"; message: string };

interface SongCardProps {
  song: Song;
  gigId: string;
  requestState: RequestState;
  onStateChange: (songId: string, state: RequestState) => void;
  onSuccess: (song: Song) => void;
}

export function SongCard({
  song,
  gigId,
  requestState,
  onStateChange,
  onSuccess,
}: SongCardProps) {
  // useRef gate for double-tap prevention (synchronous, unlike useState)
  const isSubmitting = useRef(false);

  async function handleRequest() {
    // Synchronous guard — prevents double-tap even with React batching
    if (isSubmitting.current) return;
    if (requestState.status === "sent" || requestState.status === "sending")
      return;

    isSubmitting.current = true;
    onStateChange(song.id, { status: "sending" });

    try {
      const supabase = createClient();
      const sessionId = getSessionId();

      const { error } = await supabase.from("song_requests").insert({
        gig_id: gigId,
        song_id: song.id,
        session_id: sessionId,
      });

      if (error) {
        // Unique constraint violation = already requested = treat as success
        if (error.code === "23505") {
          onStateChange(song.id, { status: "sent" });
          onSuccess(song);
        }
        // RLS rejection (gig closed, limit reached, etc.)
        else if (error.code === "42501") {
          onStateChange(song.id, {
            status: "error",
            message: "Requests are closed",
          });
        } else {
          onStateChange(song.id, {
            status: "error",
            message: "Failed — tap to retry",
          });
        }
      } else {
        onStateChange(song.id, { status: "sent" });
        onSuccess(song);
      }
    } catch {
      onStateChange(song.id, {
        status: "error",
        message: "Failed — tap to retry",
      });
    } finally {
      isSubmitting.current = false;
    }
  }

  const isSent = requestState.status === "sent";
  const isSending = requestState.status === "sending";
  const isError = requestState.status === "error";

  return (
    <button
      onClick={handleRequest}
      disabled={isSending || isSent}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-3.5 min-h-[72px] text-left transition-[background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.98] border ${
        isSent
          ? "bg-accent-surface border-accent/20 shadow-[0_0_24px_-8px_rgba(245,158,11,0.15)]"
          : isError
            ? "bg-surface-raised border-danger/20"
            : "bg-surface-raised border-white/[0.06] hover:border-white/[0.12] hover:bg-surface-hover shadow-[0_0_0_0_rgba(245,158,11,0)] hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.08)]"
      }`}
    >
      {/* Left accent bar — gradient fade */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-opacity duration-300 ${
          isSent
            ? "bg-gradient-to-b from-accent/0 via-accent to-accent/0"
            : "opacity-0 group-hover:opacity-100 bg-gradient-to-b from-accent/0 via-accent/40 to-accent/0"
        }`}
      />

      {/* Song info */}
      <div className="flex-1 min-w-0 pl-1">
        <p className="font-display text-song font-bold text-text-primary truncate">
          {song.title}
        </p>
        {song.artist && (
          <p className="font-body text-caption text-text-secondary truncate mt-0.5">
            {song.artist}
          </p>
        )}
        {isError && (
          <p className="font-body text-caption text-danger mt-0.5">
            {requestState.message}
          </p>
        )}
      </div>

      {/* Action indicator */}
      <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-colors">
        {isSending && (
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
        {isSent && (
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
        {isError && (
          <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center">
            <span className="text-danger text-body font-bold">!</span>
          </div>
        )}
        {requestState.status === "idle" && (
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <svg
              className="w-4 h-4 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}
