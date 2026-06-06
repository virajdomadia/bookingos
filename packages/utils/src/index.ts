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
