import { Document, Page, View, Text, Font, StyleSheet } from "@react-pdf/renderer";
import path from "path";
import type { GiftData } from "@/lib/gift-data";

// ============================================
// FONT REGISTRATION (local files — no CDN fetch)
// ============================================

const fontsDir = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Outfit",
  fonts: [
    { src: path.join(fontsDir, "Outfit-Medium.ttf"), fontWeight: 500 },
    { src: path.join(fontsDir, "Outfit-Bold.ttf"), fontWeight: 700 },
  ],
});

Font.register({
  family: "Sora",
  fonts: [
    { src: path.join(fontsDir, "Sora-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Sora-SemiBold.ttf"), fontWeight: 600 },
  ],
});

// ============================================
// STYLES
// ============================================

const amber = "#F59E0B";
const dark = "#1F2937";
const muted = "#6B7280";
const light = "#9CA3AF";
const divider = "#E5E7EB";

const s = StyleSheet.create({
  page: { padding: 40, backgroundColor: "#ffffff", fontFamily: "Sora" },

  // Header
  brandName: { fontFamily: "Outfit", fontWeight: 700, fontSize: 20, color: amber, letterSpacing: 1 },
  docTitle: { fontFamily: "Sora", fontWeight: 400, fontSize: 11, color: muted, marginTop: 2 },
  venueDate: { fontFamily: "Outfit", fontWeight: 500, fontSize: 14, color: dark, marginTop: 12 },

  // Section
  divider: { height: 1, backgroundColor: divider, marginVertical: 16 },
  sectionTitle: { fontFamily: "Outfit", fontWeight: 700, fontSize: 13, color: dark, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 },

  // Stats
  row: { flexDirection: "row", gap: 24, marginBottom: 4 },
  statLabel: { fontFamily: "Sora", fontWeight: 400, fontSize: 10, color: muted, width: 140 },
  statValue: { fontFamily: "Sora", fontWeight: 600, fontSize: 10, color: dark },

  // Body text
  body: { fontFamily: "Sora", fontWeight: 400, fontSize: 10, color: dark, lineHeight: 1.6, marginBottom: 4 },
  bodyMuted: { fontFamily: "Sora", fontWeight: 400, fontSize: 10, color: muted, lineHeight: 1.6, marginBottom: 4 },

  // Song list
  songRow: { flexDirection: "row", marginBottom: 3 },
  songRank: { fontFamily: "Sora", fontWeight: 600, fontSize: 10, color: amber, width: 20 },
  songTitle: { fontFamily: "Sora", fontWeight: 600, fontSize: 10, color: dark, flex: 1 },
  songCount: { fontFamily: "Sora", fontWeight: 400, fontSize: 10, color: muted, width: 60, textAlign: "right" },

  // Footer
  footer: { position: "absolute", bottom: 30, left: 40, right: 40 },
  footerText: { fontFamily: "Sora", fontWeight: 400, fontSize: 8, color: light, textAlign: "center" },
});

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ============================================
// DOCUMENT COMPONENT
// ============================================

export function GiftDocument({ data }: { data: GiftData }) {
  const { gig, requests, sessions, hasStream2 } = data;
  const hasRequests = requests.total > 0;

  // Aggregate session data for multi-set summaries
  const totalDuration = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
  const totalLogs = sessions.reduce((sum, s) => sum + s.songLogs.total, 0);
  const totalLockedIn = sessions.reduce((sum, s) => sum + s.songLogs.quality.locked_in, 0);
  const totalFine = sessions.reduce((sum, s) => sum + s.songLogs.quality.fine, 0);
  const totalOff = sessions.reduce((sum, s) => sum + s.songLogs.quality.off, 0);
  const totalVolumeCorrect = sessions.reduce((sum, s) => sum + s.songLogs.volumeCorrect, 0);
  const totalGuestAck = sessions.reduce((sum, s) => sum + s.songLogs.guestAck, 0);

  // Aggregate debrief data
  const debriefs = sessions.map((s) => s.debrief).filter(Boolean) as NonNullable<typeof sessions[0]["debrief"]>[];
  const totalWalkups = debriefs.reduce((sum, d) => sum + d.walkup_count, 0);
  const anyTips = debriefs.some((d) => d.tips_received);
  const observations = debriefs.map((d) => d.observations).filter(Boolean) as string[];
  const staffFeedback = debriefs.map((d) => d.staff_feedback).filter(Boolean) as string[];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.brandName}>PACIFIC FLOW ENTERTAINMENT</Text>
        <Text style={s.docTitle}>Post-Service Summary</Text>
        <Text style={s.venueDate}>{gig.venue_name} — {formatDate(gig.gig_date)}</Text>

        {/* Performance Overview (Stream 2 only) */}
        {hasStream2 && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Performance Overview</Text>
            <View style={s.row}>
              <Text style={s.statLabel}>Configuration</Text>
              <Text style={s.statValue}>{sessions[0].configuration}{sessions.length > 1 ? ` (${sessions.length} sets)` : ""}</Text>
            </View>
            {totalDuration > 0 && (
              <View style={s.row}>
                <Text style={s.statLabel}>Duration</Text>
                <Text style={s.statValue}>{formatDuration(totalDuration)}</Text>
              </View>
            )}
            {sessions[0].genreStyle && (
              <View style={s.row}>
                <Text style={s.statLabel}>Genre / Style</Text>
                <Text style={s.statValue}>{sessions[0].genreStyle}</Text>
              </View>
            )}
          </>
        )}

        {/* Guest Engagement */}
        {hasRequests && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Guest Engagement</Text>
            <View style={s.row}>
              <Text style={s.statLabel}>Song Requests</Text>
              <Text style={s.statValue}>{requests.total} requests from your guests</Text>
            </View>
            <View style={s.row}>
              <Text style={s.statLabel}>Songs Played</Text>
              <Text style={s.statValue}>{requests.played} ({pct(requests.responseRate)} response rate)</Text>
            </View>
            {requests.peakHour && (
              <View style={s.row}>
                <Text style={s.statLabel}>Peak Engagement</Text>
                <Text style={s.statValue}>{requests.peakHour}</Text>
              </View>
            )}
          </>
        )}

        {/* Top Requested */}
        {requests.topSongs.length > 0 && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Top Requested</Text>
            {requests.topSongs.map((song, i) => (
              <View key={i} style={s.songRow}>
                <Text style={s.songRank}>{i + 1}.</Text>
                <Text style={s.songTitle}>
                  {song.title}{song.artist ? ` — ${song.artist}` : ""}
                </Text>
                <Text style={s.songCount}>{song.count} {song.count === 1 ? "request" : "requests"}</Text>
              </View>
            ))}
          </>
        )}

        {/* Audience Vibes */}
        {(requests.vibes.fire > 0 || requests.vibes.more_energy > 0 || requests.vibes.softer > 0) && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Audience Vibes</Text>
            <View style={s.row}>
              <Text style={s.statLabel}>Fire</Text>
              <Text style={s.statValue}>{requests.vibes.fire}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.statLabel}>More Energy</Text>
              <Text style={s.statValue}>{requests.vibes.more_energy}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.statLabel}>Softer</Text>
              <Text style={s.statValue}>{requests.vibes.softer}</Text>
            </View>
          </>
        )}

        {/* Performance Quality (Stream 2 only) */}
        {hasStream2 && totalLogs > 0 && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Performance Quality</Text>
            <View style={s.row}>
              <Text style={s.statLabel}>Songs Logged</Text>
              <Text style={s.statValue}>{totalLogs}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.statLabel}>Quality</Text>
              <Text style={s.statValue}>{totalLockedIn} Locked In, {totalFine} Fine, {totalOff} Off</Text>
            </View>
            <View style={s.row}>
              <Text style={s.statLabel}>Volume Calibrated</Text>
              <Text style={s.statValue}>{totalVolumeCorrect}/{totalLogs} songs</Text>
            </View>
            <View style={s.row}>
              <Text style={s.statLabel}>Guest Acknowledgment</Text>
              <Text style={s.statValue}>{totalGuestAck}/{totalLogs} songs</Text>
            </View>
          </>
        )}

        {/* Observations & Feedback (Stream 2 only) */}
        {(observations.length > 0 || staffFeedback.length > 0) && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Observations</Text>
            {observations.map((obs, i) => (
              <Text key={`obs-${i}`} style={s.body}>{obs}</Text>
            ))}
            {staffFeedback.map((fb, i) => (
              <Text key={`fb-${i}`} style={s.bodyMuted}>Staff feedback: {fb}</Text>
            ))}
          </>
        )}

        {/* Walkups & Tips (Stream 2 only) */}
        {debriefs.length > 0 && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Walkups & Tips</Text>
            <View style={s.row}>
              <Text style={s.statLabel}>Walkup Interactions</Text>
              <Text style={s.statValue}>{totalWalkups}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.statLabel}>Tips Received</Text>
              <Text style={s.statValue}>{anyTips ? "Yes" : "No"}</Text>
            </View>
          </>
        )}

        {/* No data message */}
        {!hasRequests && !hasStream2 && (
          <>
            <View style={s.divider} />
            <Text style={s.bodyMuted}>No guest engagement data was recorded for this event.</Text>
          </>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated by LiveRequest for Pacific Flow Entertainment</Text>
        </View>
      </Page>
    </Document>
  );
}
