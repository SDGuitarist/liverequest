import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getHistoryStats, responseRate, type GigStats } from "@/lib/history-data";

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/performer", request.url));
  }

  try {
    const stats = await getHistoryStats();
    const csv = serializeToCSV(stats);

    const today = new Date().toISOString().slice(0, 10);
    const filename = `LiveRequest-History-${today}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("CSV export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

// ── CSV Serialization ──

const CSV_HEADERS =
  "Date,Venue,Total Requests,Played,Response Rate,Peak Hour,Fire,More Energy,Softer,Sessions";

// Characters that trigger formula execution in Excel/Sheets
const FORMULA_CHARS = new Set(["=", "+", "-", "@", "|", "\t", "\r"]);

function sanitizeCell(value: string): string {
  const needsPrefix = value.length > 0 && FORMULA_CHARS.has(value[0]);
  const escaped = needsPrefix ? "'" + value : value;
  if (/[,"\n]/.test(escaped)) {
    return '"' + escaped.replace(/"/g, '""') + '"';
  }
  return escaped;
}

function serializeToCSV(stats: GigStats[]): string {
  const BOM = "\uFEFF";
  const rows = stats.map((g) =>
    [
      g.gig_date,
      sanitizeCell(g.venue_name),
      g.requests.total,
      g.requests.played,
      responseRate(g.requests).toFixed(2),
      g.peakHour ?? "",
      g.vibes.fire,
      g.vibes.more_energy,
      g.vibes.softer,
      g.sessionCount,
    ].join(",")
  );
  return BOM + CSV_HEADERS + "\n" + rows.join("\n");
}
