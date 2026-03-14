"use client";

import { useState, useCallback, useRef } from "react";
import type { Song, SongQuality, VolumeCal, SongLog } from "@/lib/supabase/types";
import {
  SONG_QUALITY_VALUES,
  SONG_QUALITY_LABEL,
  VOLUME_CAL_VALUES,
  VOLUME_CAL_LABEL,
} from "@/lib/supabase/types";
import { hapticSuccess } from "@/lib/haptics";

interface SongLogFabProps {
  sessionId: string;
  songs: Song[];
  initialLogs: SongLog[];
}

export function SongLogFab({ sessionId, songs, initialLogs }: SongLogFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<SongLog[]>(initialLogs);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedSongTitle, setSelectedSongTitle] = useState<string | null>(null);
  const [songQuality, setSongQuality] = useState<SongQuality | null>(null);
  const [volumeCal, setVolumeCal] = useState<VolumeCal | null>(null);
  const [showNotOnList, setShowNotOnList] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [lastLogChip, setLastLogChip] = useState<{ title: string; id: string } | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const chipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const loggedSongIds = new Set(logs.map((l) => l.song_id).filter(Boolean));
  const activeSongs = songs.filter((s) => s.is_active);
  // Show unplayed songs first, then played with muted styling
  const unplayedSongs = activeSongs.filter((s) => !loggedSongIds.has(s.id));
  const playedSongs = activeSongs.filter((s) => loggedSongIds.has(s.id));

  const resetSheet = useCallback(() => {
    setSelectedSongId(null);
    setSelectedSongTitle(null);
    setSongQuality(null);
    setVolumeCal(null);
    setShowNotOnList(false);
    setCustomTitle("");
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resetSheet();
  }, [resetSheet]);

  // Auto-submit when all 3 inputs are selected
  const handleGuestAck = useCallback(
    async (ack: boolean) => {
      if (inFlightRef.current) return;
      if (!songQuality || !volumeCal) return;
      if (!selectedSongId && !selectedSongTitle) return;

      inFlightRef.current = true;
      setLogError(null);

      const songTitle =
        selectedSongTitle ??
        songs.find((s) => s.id === selectedSongId)?.title ??
        "Unknown";

      try {
        const res = await fetch("/api/session/log-song", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            song_id: selectedSongId,
            song_title: selectedSongTitle,
            song_quality: songQuality,
            volume_calibration: volumeCal,
            guest_acknowledgment: ack,
          }),
        });

        if (res.ok) {
          const newLog = await res.json();
          setLogs((prev) => [...prev, newLog]);
          hapticSuccess();

          // Show chip
          setLastLogChip({ title: songTitle, id: newLog.id });
          if (chipTimerRef.current) clearTimeout(chipTimerRef.current);
          chipTimerRef.current = setTimeout(() => setLastLogChip(null), 5000);
          handleClose();
        } else {
          setLogError("Failed to save log. Try again.");
        }
      } catch {
        setLogError("Network error. Try again.");
      } finally {
        inFlightRef.current = false;
      }
    },
    [sessionId, selectedSongId, selectedSongTitle, songQuality, volumeCal, songs, handleClose]
  );

  const handleUndo = useCallback(async () => {
    if (!lastLogChip) return;

    try {
      const res = await fetch("/api/session/undo-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (res.ok) {
        setLogs((prev) => prev.slice(0, -1));
        setLastLogChip(null);
        if (chipTimerRef.current) clearTimeout(chipTimerRef.current);
      }
    } catch {
      // Silent fail
    }
  }, [sessionId, lastLogChip]);

  const selectSong = useCallback((songId: string) => {
    setSelectedSongId(songId);
    setSelectedSongTitle(null);
    setShowNotOnList(false);
  }, []);

  const selectCustomSong = useCallback(() => {
    if (!customTitle.trim()) return;
    setSelectedSongId(null);
    setSelectedSongTitle(customTitle.trim());
    setShowNotOnList(false);
  }, [customTitle]);

  return (
    <>
      {/* Last log chip */}
      {lastLogChip && (
        <div className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-surface-raised border border-white/[0.06] px-4 py-2 shadow-lg transition-[opacity] animate-in fade-in">
          <span className="font-body text-caption text-text-secondary truncate max-w-[200px]">
            Logged: {lastLogChip.title}
          </span>
          <button
            onClick={handleUndo}
            className="font-display text-caption font-bold text-accent hover:text-accent/80"
          >
            Undo
          </button>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-5 z-40 w-14 h-14 rounded-full bg-accent text-white shadow-lg flex items-center justify-center transition-[background-color,transform] active:scale-[0.98]"
        aria-label="Log song"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Bottom sheet backdrop + sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl bg-surface border-t border-white/[0.06] overflow-hidden flex flex-col transition-[transform,opacity]">
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-white/[0.15]" />
            </div>

            {/* Step 1: Song picker (if no song selected) */}
            {!selectedSongId && !selectedSongTitle && (
              <div className="flex-1 overflow-y-auto px-5 pb-safe">
                <h2 className="font-display text-body font-bold text-text-primary mb-3">
                  What did you just play?
                </h2>

                {/* Unplayed songs */}
                <div className="divide-y divide-white/[0.04]">
                  {unplayedSongs.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => selectSong(song.id)}
                      className="w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="font-body text-body text-text-primary">
                        {song.title}
                      </span>
                      {song.artist && (
                        <span className="ml-2 font-body text-caption text-text-muted">
                          {song.artist}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Already played (muted) */}
                {playedSongs.length > 0 && (
                  <>
                    <div className="mt-4 mb-2 font-display text-caption text-text-muted">
                      Already logged
                    </div>
                    <div className="divide-y divide-white/[0.04] opacity-50">
                      {playedSongs.map((song) => (
                        <button
                          key={song.id}
                          onClick={() => selectSong(song.id)}
                          className="w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-colors"
                        >
                          <span className="font-body text-body text-text-primary">
                            {song.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Not on list */}
                {!showNotOnList ? (
                  <button
                    onClick={() => setShowNotOnList(true)}
                    className="w-full mt-4 py-3 rounded-xl border border-dashed border-white/[0.1] text-text-muted font-display text-caption hover:text-text-secondary transition-colors"
                  >
                    Not on list
                  </button>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Song title"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && selectCustomSong()}
                      className="flex-1 rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3 font-body text-body text-text-primary placeholder:text-text-muted"
                    />
                    <button
                      onClick={selectCustomSong}
                      disabled={!customTitle.trim()}
                      className="px-4 py-3 rounded-xl bg-accent text-white font-display font-bold text-caption disabled:opacity-50"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Quick inputs (after song selected) */}
            {(selectedSongId || selectedSongTitle) && (
              <div className="px-5 pb-8">
                <h2 className="font-display text-body font-bold text-text-primary mb-1">
                  {selectedSongTitle ?? songs.find((s) => s.id === selectedSongId)?.title}
                </h2>
                <p className="font-body text-caption text-text-muted mb-5">
                  Tap each row to log
                </p>

                {/* Song Quality */}
                <div className="mb-4">
                  <div className="font-display text-caption text-text-secondary mb-2">
                    Quality
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {SONG_QUALITY_VALUES.map((q) => (
                      <button
                        key={q}
                        onClick={() => setSongQuality(q)}
                        className={`py-3 rounded-lg font-display font-bold text-caption transition-colors ${
                          songQuality === q
                            ? "bg-accent/15 text-accent border border-accent/20"
                            : "bg-surface-raised text-text-muted border border-white/[0.06]"
                        }`}
                      >
                        {SONG_QUALITY_LABEL[q]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume */}
                <div className="mb-4">
                  <div className="font-display text-caption text-text-secondary mb-2">
                    Volume
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {VOLUME_CAL_VALUES.map((v) => (
                      <button
                        key={v}
                        onClick={() => setVolumeCal(v)}
                        className={`py-3 rounded-lg font-display font-bold text-caption transition-colors ${
                          volumeCal === v
                            ? "bg-accent/15 text-accent border border-accent/20"
                            : "bg-surface-raised text-text-muted border border-white/[0.06]"
                        }`}
                      >
                        {VOLUME_CAL_LABEL[v]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error feedback */}
                {logError && (
                  <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/20 text-red-400 font-body text-caption">
                    {logError}
                  </div>
                )}

                {/* Guest Acknowledgment — auto-submits */}
                <div>
                  <div className="font-display text-caption text-text-secondary mb-2">
                    Guest Acknowledged?
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleGuestAck(true)}
                      disabled={!songQuality || !volumeCal}
                      className={`py-3 rounded-lg font-display font-bold text-caption transition-colors ${
                        !songQuality || !volumeCal
                          ? "bg-surface-raised text-text-muted border border-white/[0.06] opacity-50 cursor-not-allowed"
                          : "bg-surface-raised text-text-muted border border-white/[0.06] hover:bg-accent/15 hover:text-accent hover:border-accent/20"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleGuestAck(false)}
                      disabled={!songQuality || !volumeCal}
                      className={`py-3 rounded-lg font-display font-bold text-caption transition-colors ${
                        !songQuality || !volumeCal
                          ? "bg-surface-raised text-text-muted border border-white/[0.06] opacity-50 cursor-not-allowed"
                          : "bg-surface-raised text-text-muted border border-white/[0.06] hover:bg-accent/15 hover:text-accent hover:border-accent/20"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
