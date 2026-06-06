/**
 * Format a Date as an ISO 8601 string (UTC).
 */
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

/**
 * Return an IANA timezone's current UTC offset, in hours, for the given instant
 * (defaults to now). Uses the platform Intl database so every zone — and DST —
 * is handled correctly, rather than a hardcoded lookup table.
 *
 * Example: getTimezoneOffsetHours("Asia/Kolkata") === 5.5
 */
export const getTimezoneOffsetHours = (
  timezone: string,
  at: Date = new Date()
): number => {
  // Format the same instant in UTC and in the target zone, then diff them.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);

  // Intl can emit hour "24" at midnight; normalize to 0.
  const hour = get("hour") % 24;
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second")
  );

  return (asUtc - Math.floor(at.getTime() / 1000) * 1000) / (1000 * 60 * 60);
};

/**
 * @deprecated Use {@link getTimezoneOffsetHours}. Kept for backwards
 * compatibility; previously only handled Asia/Kolkata.
 */
export const getTimezoneOffset = (timezone: string): number => {
  return getTimezoneOffsetHours(timezone);
};

/**
 * Convert a wall-clock time in a given IANA timezone to the corresponding UTC
 * instant.
 *
 * Bookings are stored as UTC instants, but a tenant's schedule ("09:00–18:00")
 * is expressed in their local wall-clock time. To compare a generated slot
 * against existing bookings (and to persist it), we must resolve e.g.
 * "2026-06-10 09:00 in Asia/Kolkata" to the exact UTC instant.
 *
 * The offset depends on the instant itself (DST), so we approximate first by
 * treating the wall time as if it were UTC, look up the zone offset at that
 * guess, subtract it, then refine once more for instants near a DST boundary
 * where the first guess landed on the wrong side of the transition.
 */
export const zonedWallTimeToUtc = (
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date => {
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute);

  const offset1 = getTimezoneOffsetHours(timezone, new Date(wallAsUtcMs));
  let utcMs = wallAsUtcMs - offset1 * 3_600_000;

  const offset2 = getTimezoneOffsetHours(timezone, new Date(utcMs));
  if (offset2 !== offset1) {
    utcMs = wallAsUtcMs - offset2 * 3_600_000;
  }

  return new Date(utcMs);
};
