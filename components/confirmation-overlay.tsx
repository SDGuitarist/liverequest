"use client";

import { useEffect, useCallback } from "react";
import type { Song } from "@/lib/supabase/types";

interface ConfirmationOverlayProps {
  song: Song;
  venueName: string;
  onDismiss: () => void;
}

export function ConfirmationOverlay({
  song,
  venueName,
  onDismiss,
}: ConfirmationOverlayProps) {
  // Fire confetti on mount (dynamic import keeps it out of main bundle)
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let cancelled = false;

    import("canvas-confetti").then((mod) => {
      if (cancelled) return;
      const confetti = mod.default;
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#F59E0B", "#FBBF24", "#B45309", "#FAFAFA"],
        disableForReducedMotion: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: `I requested "${song.title}" on LiveRequest!`,
      text: `I just requested "${song.title}"${song.artist ? ` by ${song.artist}` : ""} at ${venueName}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(
          `${shareData.text}\n${shareData.url}`
        );
        // Brief visual feedback handled by the button itself
      }
    } catch {
      // User cancelled share sheet — do nothing
    }
  }, [song, venueName]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface/95 backdrop-blur-sm">
      {/* Radial amber glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.12) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex flex-col items-center px-8 text-center max-w-sm">
        {/* Checkmark */}
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center animate-scale-in">
          <svg
            className="w-8 h-8 text-accent"
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
        </div>

        {/* Label */}
        <p
          className="mt-4 font-body text-label uppercase tracking-widest text-accent animate-fade-up"
          style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}
        >
          Request Sent
        </p>

        {/* Song name — the hero */}
        <h2
          className="mt-3 font-display text-hero font-bold text-text-primary max-w-[280px] animate-fade-up"
          style={{ animationDelay: "0.2s", animationFillMode: "backwards" }}
        >
          {song.title}
        </h2>

        {/* Artist */}
        {song.artist && (
          <p
            className="mt-2 font-body text-body text-text-secondary animate-fade-up"
            style={{ animationDelay: "0.3s", animationFillMode: "backwards" }}
          >
            {song.artist}
          </p>
        )}

        {/* Venue context */}
        <p
          className="mt-1 font-body text-caption text-text-muted animate-fade-up"
          style={{ animationDelay: "0.35s", animationFillMode: "backwards" }}
        >
          Requested at {venueName}
        </p>

        {/* Action buttons */}
        <div
          className="mt-8 flex flex-col gap-3 w-full animate-fade-up"
          style={{ animationDelay: "0.45s", animationFillMode: "backwards" }}
        >
          <button
            onClick={handleShare}
            className="w-full py-3 px-6 rounded-full bg-accent text-surface font-display font-bold text-body transition-colors hover:bg-accent-bright active:scale-[0.98]"
          >
            Share
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-3 px-6 rounded-full bg-surface-raised text-text-secondary font-body text-body transition-colors hover:bg-surface-hover active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
