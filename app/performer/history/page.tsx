import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { getHistoryStats, responseRate } from "@/lib/history-data";
import { VIBE_EMOJI } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function GigHistory() {
  if (!(await isAuthenticated())) {
    redirect("/performer");
  }

  const gigList = await getHistoryStats();

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
      <div className="relative px-5 pt-8 pb-5 overflow-hidden">
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="font-display text-title font-bold text-text-primary tracking-tight">
              Gig History
            </h1>
            <p className="mt-1 font-body text-caption text-text-secondary">
              View past gig stats and export data
            </p>
          </div>
          <div className="flex items-center gap-2">
            {gigList.length > 0 && (
              <a
                href="/api/export/history"
                className="px-3 py-1.5 rounded-lg font-body text-caption text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors"
              >
                Export CSV
              </a>
            )}
            <Link
              href="/performer/dashboard"
              className="px-3 py-1.5 rounded-lg font-body text-caption text-text-secondary bg-surface-raised border border-white/[0.06] hover:bg-surface-hover transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-2">
        {gigList.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-body text-body text-text-muted">
              No completed gigs yet.
            </p>
          </div>
        ) : (
          gigList.map((gig) => {
            const rate = responseRate(gig.requests);
            const vibeTotal = gig.vibes.fire + gig.vibes.more_energy + gig.vibes.softer;

            return (
              <Link
                key={gig.id}
                href={`/performer/history/${gig.id}`}
                className="block p-4 rounded-xl bg-surface-raised border border-white/[0.06] hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-song text-text-primary truncate">
                      {gig.venue_name}
                    </p>
                    <p className="font-body text-caption text-text-secondary mt-0.5">
                      {new Date(gig.gig_date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <a
                    href={`/api/gift/${gig.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg font-body text-caption text-amber-400 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/20 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Gift
                  </a>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-white/[0.04]">
                  <span className="font-body text-label text-text-muted">
                    {gig.requests.total} request{gig.requests.total !== 1 ? "s" : ""}
                  </span>
                  {gig.requests.total > 0 && (
                    <span className="font-body text-label text-text-muted">
                      {Math.round(rate * 100)}% played
                    </span>
                  )}
                  {gig.sessionCount > 0 && (
                    <span className="font-body text-label text-text-muted">
                      {gig.sessionCount} set{gig.sessionCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {gig.peakHour && (
                    <span className="font-body text-label text-text-muted">
                      Peak {gig.peakHour}
                    </span>
                  )}
                  {vibeTotal > 0 && (
                    <span className="font-body text-label text-text-muted">
                      {gig.vibes.fire > 0 && `${VIBE_EMOJI.fire}${gig.vibes.fire} `}
                      {gig.vibes.more_energy > 0 && `${VIBE_EMOJI.more_energy}${gig.vibes.more_energy} `}
                      {gig.vibes.softer > 0 && `${VIBE_EMOJI.softer}${gig.vibes.softer}`}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
