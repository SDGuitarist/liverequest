"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
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
  const [, setTick] = useState(0);

  // Update relative timestamps every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all requests (used on reconnect and visibility change)
  const fetchRequests = useCallback(async () => {
    const { data } = await supabase.current
      .from("song_requests")
      .select("id, song_id, created_at, songs(id, title, artist)")
      .eq("gig_id", gig.id)
      .order("created_at", { ascending: false });

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
            setRequests((prev) => [
              {
                id: newReq.id,
                song_id: newReq.song_id,
                created_at: newReq.created_at,
                songs: song,
              },
              ...prev,
            ]);
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

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
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
      wakeLock?.release();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Toggle requests open/closed (via API route — checks performer auth cookie)
  async function handleToggle() {
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
  }

  const grouped = groupRequests(requests);
  const totalRequests = requests.length;
  const audienceUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/alejandro`;

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 className="font-display text-title font-bold text-text-primary">
            LiveRequest
          </h1>
          <p className="mt-1 font-body text-caption text-text-secondary">
            {gig.venue_name}
          </p>
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-2 mt-1">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              connected ? "bg-success" : "bg-danger animate-pulse"
            }`}
          />
          <span className="font-body text-caption text-text-muted">
            {connected ? "Live" : "Reconnecting..."}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 space-y-3 mb-6">
        {/* Toggle requests */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`w-full py-3 rounded-xl font-display font-bold text-body transition-colors disabled:opacity-50 ${
            requestsOpen
              ? "bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30"
              : "bg-accent text-surface hover:bg-accent-bright"
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
          className="w-full py-3 rounded-xl font-display font-bold text-body text-text-primary bg-surface-raised border border-surface-border hover:bg-surface-hover transition-colors"
        >
          {showQR ? "Hide QR Code" : "Show QR Code"}
        </button>

        {/* QR Code display */}
        {showQR && (
          <div className="flex flex-col items-center gap-3 py-4 rounded-xl bg-white">
            <QRCodeSVG
              value={audienceUrl}
              size={200}
              level="M"
              bgColor="#ffffff"
              fgColor="#0D0D0F"
            />
            <p className="font-body text-caption text-zinc-600 px-4 text-center break-all">
              {audienceUrl}
            </p>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="px-4 mb-4">
        <p className="font-body text-caption text-text-muted">
          {totalRequests} request{totalRequests !== 1 ? "s" : ""} &middot;{" "}
          {grouped.length} song{grouped.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Request queue */}
      <div className="px-4 flex flex-col gap-2">
        {grouped.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-body text-body text-text-muted">
              {requestsOpen
                ? "Waiting for requests..."
                : "Requests are closed"}
            </p>
          </div>
        ) : (
          grouped.map((song) => (
            <div
              key={song.songId}
              className="flex items-center gap-3 p-4 rounded-xl bg-surface-raised border border-surface-border"
            >
              {/* Amber bar + count */}
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
                <span className="font-display font-bold text-xl text-accent">
                  {song.count}
                </span>
              </div>

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-song text-text-primary truncate">
                  {song.title}
                </p>
                {song.artist && (
                  <p className="font-body text-caption text-text-secondary truncate">
                    {song.artist}
                  </p>
                )}
              </div>

              {/* Time */}
              <span className="flex-shrink-0 font-body text-caption text-text-muted">
                {timeAgo(song.latestRequest)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
