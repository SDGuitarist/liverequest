"use client";

import { useEffect, useCallback } from "react";
import type { Song } from "@/lib/supabase/types";

// --- Dynamic mesh gradient utilities ---

interface SongPalette {
  primary: string;   // CSS hsl() color string
  secondary: string; // CSS hsl() color string
  xPos: number;      // 25-75 (percentage for left positioning)
  yPos: number;      // 20-60 (percentage for top positioning)
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getSongPalette(title: string, artist: string | null): SongPalette {
  const hue1 = hashString(title) % 360;
  const hue2 = (hue1 + 40 + hashString(artist ?? "")) % 360;
  return {
    primary: `hsl(${hue1}, 75%, 50%)`,
    secondary: `hsl(${hue2}, 65%, 40%)`,
    xPos: 25 + (hashString(title + "x") % 50),
    yPos: 20 + (hashString(title + "y") % 40),
  };
}

const NOTES = ["♪", "♫", "♬", "♩"];

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
  const palette = getSongPalette(song.title, song.artist);

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
      {/* Dynamic mesh gradient — unique per song */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Orb 1: Song-primary color, large */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[80px] opacity-25"
          style={{
            background: palette.primary,
            top: `${palette.yPos}%`,
            left: `${palette.xPos}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
        {/* Orb 2: Song-secondary color, medium */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-[60px] opacity-15"
          style={{
            background: palette.secondary,
            bottom: "20%",
            right: "15%",
          }}
        />
        {/* Orb 3: Amber brand anchor, center */}
        <div
          className="absolute w-[300px] h-[300px] rounded-full blur-[40px] opacity-10"
          style={{
            background: "#F59E0B",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      {/* Floating musical notes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {NOTES.flatMap((note, ni) =>
          [0, 1].map((ri) => {
            const i = ni * 2 + ri;
            return (
              <span
                key={i}
                className="absolute animate-[float-up_ease-out_forwards] text-amber-400/30"
                style={{
                  left: `${(i / 8) * 100}%`,
                  bottom: "-20px",
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: `${3 + (i % 3)}s`,
                  fontSize: `${0.7 + (i % 3) * 0.4}rem`,
                }}
              >
                {note}
              </span>
            );
          })
        )}
      </div>

      <div className="relative flex flex-col items-center px-8 text-center max-w-sm">
        {/* Checkmark + sonic rings */}
        <div className="relative flex items-center justify-center">
          {/* Sonic rings */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute w-16 h-16 rounded-full border border-amber-400/20 animate-[ring-pulse_1.5s_ease-out_forwards]"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
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
            className="w-full py-3 px-6 rounded-full bg-gradient-to-r from-accent to-accent-bright text-surface font-display font-bold text-body shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.4)] active:scale-[0.98] active:shadow-[0_2px_8px_rgba(245,158,11,0.25)] transition-[box-shadow,transform] duration-200"
          >
            Share
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-3 px-6 rounded-full bg-white/[0.06] border border-white/[0.08] text-text-secondary font-body text-body transition-[color,background-color,transform] duration-200 hover:bg-white/[0.1] hover:text-text-primary active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
