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
 * Return the calendar date (and weekday) that it currently is in a given IANA
 * timezone for the provided instant (defaults to now).
 *
 * Server-side "today"/"this week" math must be done in the tenant's timezone,
 * not UTC — otherwise a booking made in the early hours of a +5:30 tenant lands
 * in the wrong day's bucket. `weekday` is 0=Sunday … 6=Saturday and is derived
 * from the calendar date, so it is timezone-independent given y/m/d.
 */
export const getZonedDateParts = (
  timezone: string,
  at: Date = new Date()
): { year: number; month: number; day: number; weekday: number } => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, weekday };
};

/**
 * Resolve a tenant-local calendar day ("YYYY-MM-DD") to the half-open UTC range
 * [startOfDay, startOfNextDay) for that day in the given timezone. Used to build
 * timezone-correct `startsAt` filters/counts. `dayOffset` shifts the day (e.g.
 * +1 to get the exclusive upper bound of a `dateTo` filter). Date.UTC normalizes
 * month/year rollovers so adding/subtracting days is safe.
 */
export const zonedDayRangeUtc = (
  year: number,
  month: number, // 1-12
  day: number,
  timezone: string,
  dayOffset = 0
): { start: Date; end: Date } => {
  const base = new Date(Date.UTC(year, month - 1, day + dayOffset));
  const start = zonedWallTimeToUtc(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    0,
    0,
    timezone
  );
  const next = new Date(Date.UTC(year, month - 1, day + dayOffset + 1));
  const end = zonedWallTimeToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    timezone
  );
  return { start, end };
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
 *
 * LIMITATION: wall times that do not exist (spring-forward gap, e.g. 02:30 on a
 * DST start day) or that occur twice (fall-back overlap) are inherently
 * ambiguous; this returns one plausible instant rather than rejecting them. The
 * default tenant zone (Asia/Kolkata) has no DST so this never arises there. For
 * DST-observing zones a slot at such a wall time may render confusingly — keep
 * that in mind if V1 expands beyond non-DST zones.
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
