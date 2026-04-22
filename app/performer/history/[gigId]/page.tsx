import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { isUUID } from "@/lib/validation";
import { getGiftData, type GiftData } from "@/lib/gift-data";
import { VIBE_EMOJI, SONG_QUALITY_LABEL, isVibe } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ gigId: string }>;
}

export default async function GigDetail({ params }: PageProps) {
  if (!(await isAuthenticated())) redirect("/performer");
  const { gigId } = await params;
  if (!isUUID(gigId)) notFound();

  const data = await getGiftData(gigId);
  if (!data) notFound();

  const { gig, requests, sessions, hasStream2, rawRequests } = data;

  return (
    <div
      className="min-h-screen pb-8"
      style={{
        background: `
          radial-gradient(ellipse at 20% 0%, rgba(245, 158, 11, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(245, 158, 11, 0.05) 0%, transparent 50%),
          #0D0D0F
        `,
      }}
    >
      {/* Header */}
      <div className="relative px-5 pt-8 pb-5 overflow-hidden">
        <Link
          href="/performer/history"
          className="inline-flex items-center gap-1 font-body text-caption text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to History
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-title font-bold text-text-primary tracking-tight">
              {gig.venue_name}
            </h1>
            <p className="mt-1 font-body text-caption text-text-secondary">
              {new Date(gig.gig_date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          {requests.total > 0 && (
            <a
              href={`/api/gift/${gig.id}`}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg font-body text-caption text-amber-400 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Gift PDF
            </a>
          )}
        </div>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {/* Stats summary */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Requests" value={requests.total} />
          <StatCard label="Played" value={`${requests.played} (${Math.round(requests.responseRate * 100)}%)`} />
          <StatCard label="Peak Hour" value={requests.peakHour ?? "—"} />
          <StatCard
            label="Vibes"
            value={
              requests.vibes.fire + requests.vibes.more_energy + requests.vibes.softer > 0
                ? `${VIBE_EMOJI.fire}${requests.vibes.fire} ${VIBE_EMOJI.more_energy}${requests.vibes.more_energy} ${VIBE_EMOJI.softer}${requests.vibes.softer}`
                : "—"
            }
          />
        </div>

        {/* Top songs */}
        {requests.topSongs.length > 0 && (
          <section>
            <h2 className="font-display text-song font-bold text-text-primary mb-2">
              Top Requested
            </h2>
            <div className="flex flex-col gap-1">
              {requests.topSongs.map((song, i) => (
                <div
                  key={`${song.title}-${i}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-raised border border-white/[0.04]"
                >
                  <div className="min-w-0">
                    <p className="font-body text-body text-text-primary truncate">{song.title}</p>
                    {song.artist && (
                      <p className="font-body text-caption text-text-secondary truncate">{song.artist}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 ml-3 font-body text-caption text-text-muted">
                    {song.count}x
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Session stats */}
        {hasStream2 && sessions.length > 0 && (
          <section>
            <h2 className="font-display text-song font-bold text-text-primary mb-2">
              Set Details
            </h2>
            <div className="flex flex-col gap-2">
              {sessions.map((sess) => (
                <div
                  key={sess.setNumber}
                  className="p-3 rounded-lg bg-surface-raised border border-white/[0.04]"
                >
                  <p className="font-display font-bold text-body text-text-primary">
                    Set {sess.setNumber}
                    <span className="ml-2 font-body font-normal text-caption text-text-secondary">
                      {sess.configuration}
                      {sess.durationMinutes != null && ` · ${sess.durationMinutes} min`}
                    </span>
                  </p>
                  {sess.songLogs.total > 0 && (
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="font-body text-label text-text-muted">
                        {sess.songLogs.total} songs logged
                      </span>
                      <span className="font-body text-label text-text-muted">
                        {SONG_QUALITY_LABEL.locked_in}: {sess.songLogs.quality.locked_in}
                      </span>
                      <span className="font-body text-label text-text-muted">
                        Vol OK: {sess.songLogs.volumeCorrect}/{sess.songLogs.total}
                      </span>
                      <span className="font-body text-label text-text-muted">
                        Guest ack: {sess.songLogs.guestAck}/{sess.songLogs.total}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Request list — empty state when 0 requests */}
        {requests.total === 0 ? (
          <div className="py-8 text-center">
            <p className="font-body text-body text-text-muted">
              No song requests for this gig.
            </p>
          </div>
        ) : (
          <RequestList requests={rawRequests} />
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ──

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-lg bg-surface-raised border border-white/[0.04]">
      <p className="font-body text-label text-text-muted">{label}</p>
      <p className="font-display text-body font-bold text-text-primary mt-0.5">{value}</p>
    </div>
  );
}

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

function RequestList({ requests }: { requests: GiftData["rawRequests"] }) {
  return (
    <section>
      <h2 className="font-display text-song font-bold text-text-primary mb-2">
        All Requests ({requests.length})
      </h2>
      <div className="flex flex-col gap-1">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-surface-raised border border-white/[0.04]"
          >
            <div className="flex-1 min-w-0">
              <p className="font-body text-body text-text-primary truncate">
                {req.songs?.title ?? "Unknown"}
              </p>
              {req.songs?.artist && (
                <p className="font-body text-caption text-text-secondary truncate">{req.songs.artist}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {req.vibe && isVibe(req.vibe) && (
                <span className="text-sm">{VIBE_EMOJI[req.vibe]}</span>
              )}
              <span className={`px-2 py-0.5 rounded-full font-body text-label ${
                req.played_at
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "bg-white/[0.06] text-text-muted"
              }`}>
                {req.played_at ? "Played" : "Pending"}
              </span>
              <span className="font-body text-label text-text-muted">
                {hourFormatter.format(new Date(req.created_at))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
