"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Gig, Song, PerformanceSession, Venue, Configuration } from "@/lib/supabase/types";
import { CONFIGURATION_VALUES, CONFIGURATION_LABEL } from "@/lib/supabase/types";

interface PreSetFormProps {
  gig: Gig;
  session: PerformanceSession | null;
  songs: Song[];
  previousSession?: PerformanceSession;
}

export function PreSetForm({ gig, session, songs, previousSession }: PreSetFormProps) {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | "new" | "">(
    ""
  );
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueAddress, setNewVenueAddress] = useState("");
  const [configuration, setConfiguration] = useState<Configuration>(
    (previousSession?.configuration as Configuration) ?? "solo"
  );
  const [genreStyle, setGenreStyle] = useState(
    previousSession?.genre_style ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    session?.id ?? null
  );

  // Fetch venues on mount
  useEffect(() => {
    fetch("/api/venues/list")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setVenues(data);
      })
      .catch(() => {});
  }, []);

  // When venue changes, apply defaults
  const handleVenueChange = useCallback(
    (venueId: string) => {
      setSelectedVenueId(venueId);
      if (venueId !== "new" && venueId !== "") {
        const venue = venues.find((v) => v.id === venueId);
        if (venue) {
          if (venue.default_configuration) {
            setConfiguration(venue.default_configuration as Configuration);
          }
          if (venue.default_genre_style) {
            setGenreStyle(venue.default_genre_style);
          }
        }
      }
    },
    [venues]
  );

  const handleGoLive = useCallback(async () => {
    setSubmitting(true);
    try {
      let venueId: string | null = null;

      // Create new venue if needed
      if (selectedVenueId === "new" && newVenueName.trim()) {
        const venueRes = await fetch("/api/venues/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newVenueName.trim(),
            address: newVenueAddress.trim() || undefined,
            default_configuration: configuration,
            default_genre_style: genreStyle || undefined,
          }),
        });
        if (!venueRes.ok) {
          setSubmitting(false);
          return;
        }
        const venue = await venueRes.json();
        venueId = venue.id;
      } else if (selectedVenueId && selectedVenueId !== "new") {
        venueId = selectedVenueId;
      }

      // Create session if we don't have one
      let sessionId = currentSessionId;
      if (!sessionId) {
        const sessionRes = await fetch("/api/session/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gig_id: gig.id,
            venue_id: venueId,
            configuration,
            genre_style: genreStyle || undefined,
            set_number: previousSession
              ? previousSession.set_number + 1
              : 1,
          }),
        });
        if (!sessionRes.ok) {
          setSubmitting(false);
          return;
        }
        const newSession = await sessionRes.json();
        sessionId = newSession.id;
        setCurrentSessionId(sessionId);
      }

      // Go live
      const liveRes = await fetch("/api/session/go-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (liveRes.ok) {
        router.refresh();
      } else {
        setSubmitting(false);
      }
    } catch {
      setSubmitting(false);
    }
  }, [
    gig.id,
    selectedVenueId,
    newVenueName,
    newVenueAddress,
    configuration,
    genreStyle,
    currentSessionId,
    previousSession,
    router,
  ]);

  return (
    <div className="min-h-screen px-5 py-6">
      <h1 className="font-display text-title font-bold text-text-primary mb-1">
        {previousSession ? `Set ${previousSession.set_number + 1}` : "Pre-Set Setup"}
      </h1>
      <p className="font-body text-caption text-text-secondary mb-6">
        {gig.venue_name} — {gig.gig_date}
      </p>

      {/* Venue Selector */}
      <div className="mb-5">
        <label className="block font-display text-caption font-bold text-text-secondary mb-2">
          Venue
        </label>
        <select
          value={selectedVenueId}
          onChange={(e) => handleVenueChange(e.target.value)}
          className="w-full rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3 font-body text-body text-text-primary"
        >
          <option value="">Select venue...</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
          <option value="new">+ Add new venue</option>
        </select>

        {selectedVenueId === "new" && (
          <div className="mt-3 space-y-3">
            <input
              type="text"
              placeholder="Venue name *"
              value={newVenueName}
              onChange={(e) => setNewVenueName(e.target.value)}
              className="w-full rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3 font-body text-body text-text-primary placeholder:text-text-muted"
            />
            <input
              type="text"
              placeholder="Address (optional)"
              value={newVenueAddress}
              onChange={(e) => setNewVenueAddress(e.target.value)}
              className="w-full rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3 font-body text-body text-text-primary placeholder:text-text-muted"
            />
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="mb-5">
        <label className="block font-display text-caption font-bold text-text-secondary mb-2">
          Configuration
        </label>
        <div className="grid grid-cols-4 gap-2">
          {CONFIGURATION_VALUES.map((config) => (
            <button
              key={config}
              onClick={() => setConfiguration(config)}
              className={`py-2 rounded-lg font-display font-bold text-caption transition-colors ${
                configuration === config
                  ? "bg-accent/15 text-accent border border-accent/20"
                  : "bg-surface-raised text-text-muted border border-white/[0.06] hover:text-text-secondary"
              }`}
            >
              {CONFIGURATION_LABEL[config]}
            </button>
          ))}
        </div>
      </div>

      {/* Genre/Style */}
      <div className="mb-5">
        <label className="block font-display text-caption font-bold text-text-secondary mb-2">
          Genre / Style
        </label>
        <input
          type="text"
          placeholder="e.g. Bossa Nova, Latin Jazz"
          value={genreStyle}
          onChange={(e) => setGenreStyle(e.target.value)}
          className="w-full rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3 font-body text-body text-text-primary placeholder:text-text-muted"
        />
      </div>

      {/* Setlist Preview */}
      <div className="mb-8">
        <label className="block font-display text-caption font-bold text-text-secondary mb-2">
          Setlist ({songs.filter((s) => s.is_active).length} songs)
        </label>
        <div className="max-h-48 overflow-y-auto rounded-xl bg-surface-raised border border-white/[0.06] divide-y divide-white/[0.04]">
          {songs
            .filter((s) => s.is_active)
            .map((song) => (
              <div key={song.id} className="px-4 py-2 flex items-center justify-between">
                <span className="font-body text-caption text-text-primary truncate">
                  {song.title}
                </span>
                {song.energy_level && (
                  <span className="ml-2 text-text-muted text-xs">
                    {song.energy_level}
                  </span>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Go Live */}
      <button
        onClick={handleGoLive}
        disabled={submitting}
        className="w-full py-4 rounded-xl bg-accent font-display font-bold text-body text-white transition-[background-color,transform] active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
      >
        {submitting ? "Going Live..." : "Go Live"}
      </button>
    </div>
  );
}
