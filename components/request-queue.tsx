"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { hapticDismiss } from "@/lib/haptics";
import type { Gig } from "@/lib/supabase/types";

interface SongRequestRow {
  id: string;
  song_id: string;
  created_at: string;
  songs: { id: string; title: string; artist: string | null } | null;
}

interface GroupedSong {
  songId: string;
  title: string;
  artist: string | null;
  count: number;
  latestRequest: string;
}

interface RequestQueueProps {
  gig: Gig;
  initialRequests: SongRequestRow[];
}

function groupRequests(requests: SongRequestRow[]): GroupedSong[] {
  const map = new Map<string, GroupedSong>();

  for (const req of requests) {
    if (!req.songs) continue;
    const existing = map.get(req.song_id);
    if (existing) {
      existing.count++;
      if (req.created_at > existing.latestRequest) {
        existing.latestRequest = req.created_at;
      }
    } else {
      map.set(req.song_id, {
        songId: req.song_id,
        title: req.songs.title,
        artist: req.songs.artist,
        count: 1,
        latestRequest: req.created_at,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function RequestQueue({ gig, initialRequests }: RequestQueueProps) {
  const [requests, setRequests] = useState<SongRequestRow[]>(initialRequests);
  const [requestsOpen, setRequestsOpen] = useState(gig.requests_open);
  const [connected, setConnected] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const seenIds = useRef(new Set(initialRequests.map((r) => r.id)));
  const supabase = useRef(createClient());
  const fetchGen = useRef(0);
  const toggleInFlight = useRef(false);
  const [, setTick] = useState(0);

  // Update relative timestamps every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all requests (used on reconnect and visibility change)
  const fetchRequests = useCallback(async () => {
    const gen = ++fetchGen.current;
    const { data } = await supabase.current
      .from("song_requests")
      .select("id, song_id, created_at, songs(id, title, artist)")
      .eq("gig_id", gig.id)
      .order("created_at", { ascending: false });

    // Discard stale response if a newer fetch was started
    if (gen !== fetchGen.current) return;

    if (data) {
      setRequests(data as SongRequestRow[]);
      seenIds.current = new Set(data.map((r) => r.id));
    }
  }, [gig.id]);

  // Subscribe to realtime — subscribe first, then data is already loaded from server
  useEffect(() => {
    const channel = supabase.current
      .channel("performer-requests")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "song_requests",
          filter: `gig_id=eq.${gig.id}`,
        },
        async (payload) => {
          const newReq = payload.new as { id: string; song_id: string; created_at: string; session_id: string };

          // Deduplicate
          if (seenIds.current.has(newReq.id)) return;
          seenIds.current.add(newReq.id);

          // Fetch the song details for this request
          const { data: song } = await supabase.current
            .from("songs")
            .select("id, title, artist")
            .eq("id", newReq.song_id)
            .single();

          if (song) {
            setRequests((prev) => {
              if (prev.some((r) => r.id === newReq.id)) return prev;
              return [
                {
                  id: newReq.id,
                  song_id: newReq.song_id,
                  created_at: newReq.created_at,
                  songs: song,
                },
                ...prev,
              ];
            });
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        // Re-query on reconnect
        if (status === "SUBSCRIBED") {
          fetchRequests();
        }
      });

    // Re-query when phone unlocked (visibility change)
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchRequests();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      supabase.current.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [gig.id, fetchRequests]);

  // Wake Lock — prevent screen from dimming on music stand
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          const lock = await navigator.wakeLock.request("screen");
          if (cancelled) {
            lock.release();
            return;
          }
          wakeLock = lock;
        }
      } catch {
        // Wake Lock can fail silently (e.g., low battery)
      }
    }

    requestWakeLock();

    // Re-acquire on visibility change (released when tab goes background)
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      wakeLock?.release();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Toggle requests open/closed (via API route — checks performer auth cookie)
  async function handleToggle() {
    if (toggleInFlight.current) return;
    toggleInFlight.current = true;
    setToggling(true);
    const newState = !requestsOpen;

    try {
      const res = await fetch("/api/gig/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: gig.id, requestsOpen: newState }),
      });

      if (res.ok) {
        setRequestsOpen(newState);
      }
    } catch {
      // Silently fail — performer can retry
    }
    setToggling(false);
    toggleInFlight.current = false;
  }

  // Dismiss a song — mark as played, remove from queue
  async function handleDismiss(songId: string) {
    hapticDismiss();
    // Optimistic: remove from local state immediately
    setRequests((prev) => prev.filter((r) => r.song_id !== songId));

    try {
      await fetch("/api/gig/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: gig.id, songId }),
      });
    } catch {
      // If it fails, the next re-query will restore them
    }
  }

  const grouped = groupRequests(requests);
  const totalRequests = requests.length;
  const audienceUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/alejandro`;

  return (
    <div className="min-h-screen pb-8">
      {/* Header with amber glow */}
      <div className="relative px-5 pt-8 pb-5 overflow-hidden">
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[300px] h-[200px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex items-start justify-between">
          <div>
            <h1 className="font-display text-title font-bold text-text-primary tracking-tight">
              LiveRequest
            </h1>
            <p className="mt-1 font-body text-caption text-text-secondary">
              {gig.venue_name}
            </p>
          </div>

          {/* Connection indicator */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              connected
                ? "bg-success/10 border-success/20"
                : "bg-danger/10 border-danger/20"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-success animate-[live-glow_2s_ease-in-out_infinite]" : "bg-danger animate-pulse"
              }`}
            />
            <span
              className={`font-body text-label uppercase tracking-wider ${
                connected ? "text-success" : "text-danger"
              }`}
            >
              {connected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-5 space-y-3 mb-6">
        {/* Toggle requests */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`w-full py-3.5 rounded-xl font-display font-bold text-body transition-colors disabled:opacity-50 ${
            requestsOpen
              ? "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20"
              : "bg-accent text-surface hover:bg-accent-bright shadow-lg shadow-accent/20"
          }`}
        >
          {toggling
            ? "Updating..."
            : requestsOpen
            ? "Close Requests"
            : "Open Requests"}
        </button>

        {/* QR Code toggle */}
        <button
          onClick={() => setShowQR(!showQR)}
          className="w-full py-3.5 rounded-xl font-display font-bold text-body text-text-primary bg-surface-raised border border-white/[0.06] hover:border-white/[0.12] hover:bg-surface-hover transition-colors duration-200"
        >
          {showQR ? "Hide QR Code" : "Show QR Code"}
        </button>

        {/* QR Code display */}
        {showQR && (
          <div className="flex flex-col items-center gap-3 py-6 rounded-xl bg-white shadow-xl shadow-black/20">
            <QRCodeSVG
              value={audienceUrl}
              size={200}
              level="M"
              bgColor="#ffffff"
              fgColor="#0D0D0F"
            />
            <p className="font-body text-caption text-zinc-500 px-6 text-center break-all">
              {audienceUrl}
            </p>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="px-5 mb-3 flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
          <span className="font-display font-bold text-caption text-accent">
            {totalRequests}
          </span>
          <span className="font-body text-caption text-text-secondary">
            request{totalRequests !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-raised border border-white/[0.06]">
          <span className="font-display font-bold text-caption text-text-primary">
            {grouped.length}
          </span>
          <span className="font-body text-caption text-text-secondary">
            song{grouped.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Request queue */}
      <div className="px-5 flex flex-col gap-2">
        {grouped.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-body text-body text-text-muted">
              {requestsOpen
                ? "Waiting for requests..."
                : "Requests are closed"}
            </p>
          </div>
        ) : (
          grouped.map((song, i) => (
            <div
              key={song.songId}
              className="group relative flex items-center gap-3 p-4 rounded-xl bg-surface-raised border border-white/[0.06] hover:border-white/[0.12] transition-[border-color] duration-200 animate-[slide-in-new_0.4s_ease-out_backwards]"
              style={{
                boxShadow: song.count >= 3
                  ? '0 0 24px -8px rgba(245, 158, 11, 0.15)'
                  : 'none',
              }}
            >
              {/* Left accent bar — gradient fade */}
              <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-accent/0 via-accent/40 to-accent/0" />

              {/* Count badge — key forces re-mount on count change for bump animation */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center">
                <span
                  key={song.count}
                  className="font-display font-bold text-xl text-accent animate-[count-bump_0.3s_ease-out]"
                >
                  {song.count}
                </span>
              </div>

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

              {/* Time + Done button */}
              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                <span className="font-body text-caption text-text-muted">
                  {timeAgo(song.latestRequest)}
                </span>
                <button
                  onClick={() => handleDismiss(song.songId)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-body text-caption text-success bg-success/10 border border-success/20 hover:bg-success/20 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Done
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
