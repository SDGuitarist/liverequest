// Pacific Flow gigs are in America/Los_Angeles.
const GIG_TIMEZONE = "America/Los_Angeles";

/**
 * Find the peak request hour from a list of timestamped items.
 * Returns formatted string like "8:00 PM" in the gig timezone, or null if empty.
 */
export function computePeakHour(
  requests: { created_at: string }[]
): string | null {
  if (requests.length === 0) return null;

  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: GIG_TIMEZONE,
  });

  const hourCounts = new Map<number, number>();
  for (const r of requests) {
    const localHour = parseInt(hourFormatter.format(new Date(r.created_at)), 10);
    hourCounts.set(localHour, (hourCounts.get(localHour) ?? 0) + 1);
  }

  let peakHour = 0;
  let peakCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > peakCount) {
      peakHour = hour;
      peakCount = count;
    }
  }

  const ampm = peakHour >= 12 ? "PM" : "AM";
  const displayHour = peakHour % 12 || 12;
  return `${displayHour}:00 ${ampm}`;
}
