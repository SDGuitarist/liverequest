import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface GigSummary {
  id: string;
  venue_name: string;
  gig_date: string;
  request_count: number;
  session_count: number;
}

export default async function GigHistory() {
  if (!(await isAuthenticated())) {
    redirect("/performer");
  }

  const supabase = createServiceClient();

  // Fetch non-active gigs, then get counts per gig
  const { data: rawGigs } = await supabase
    .from("gigs")
    .select("id, venue_name, gig_date")
    .eq("is_active", false)
    .order("gig_date", { ascending: false });

  let gigList: GigSummary[] = [];

  if (rawGigs && rawGigs.length > 0) {
    // Get counts per gig in parallel (N queries, but N is small — typically < 50 gigs)
    const counts = await Promise.all(
      rawGigs.map(async (g) => {
        const [reqResult, sessResult] = await Promise.all([
          supabase.from("song_requests").select("id", { count: "exact", head: true }).eq("gig_id", g.id),
          supabase.from("performance_sessions").select("id", { count: "exact", head: true }).eq("gig_id", g.id).in("status", ["complete", "post_set"]),
        ]);
        return {
          ...g,
          request_count: reqResult.count ?? 0,
          session_count: sessResult.count ?? 0,
        };
      })
    );
    // "Completed gig" = has at least one request or one session
    gigList = counts.filter((g) => g.request_count > 0 || g.session_count > 0);
  }

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
              Download post-service summaries for past gigs
            </p>
          </div>
          <Link
            href="/performer/dashboard"
            className="px-3 py-1.5 rounded-lg font-body text-caption text-text-secondary bg-surface-raised border border-white/[0.06] hover:bg-surface-hover transition-colors"
          >
            Dashboard
          </Link>
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
          gigList.map((gig) => (
            <div
              key={gig.id}
              className="flex items-center gap-3 p-4 rounded-xl bg-surface-raised border border-white/[0.06]"
            >
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
                <div className="flex gap-3 mt-1">
                  {gig.request_count > 0 && (
                    <span className="font-body text-label text-text-muted">
                      {gig.request_count} request{gig.request_count !== 1 ? "s" : ""}
                    </span>
                  )}
                  {gig.session_count > 0 && (
                    <span className="font-body text-label text-text-muted">
                      {gig.session_count} set{gig.session_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              <a
                href={`/api/gift/${gig.id}`}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg font-body text-caption text-amber-400 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Gift PDF
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
