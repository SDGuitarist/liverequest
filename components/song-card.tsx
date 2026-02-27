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
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 min-h-[60px] text-left transition-all active:scale-[0.98] ${
        isSent
          ? "bg-accent-surface"
          : isError
            ? "bg-surface-raised"
            : "bg-surface-raised hover:bg-surface-hover"
      }`}
    >
      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="font-display text-song font-semibold text-text-primary truncate">
          {song.title}
        </p>
        {song.artist && (
          <p className="font-body text-caption text-text-secondary truncate">
            {song.artist}
          </p>
        )}
      </div>

      {/* Action indicator */}
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
        {isSending && (
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
        {isSent && (
          <svg
            className="w-5 h-5 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {isError && (
          <span className="text-danger text-caption font-semibold">!</span>
        )}
        {requestState.status === "idle" && (
          <svg
            className="w-5 h-5 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        )}
      </div>
    </button>
  );
}
