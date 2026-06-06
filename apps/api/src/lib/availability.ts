import { zonedWallTimeToUtc } from "@booking-os/utils";

/**
 * Pure availability engine for the public booking flow (F4).
 *
 * Given a tenant's schedule, a service duration, and the bookings already on the
 * books for a calendar day, it returns the bookable time slots for that day as
 * UTC instants. It is deliberately free of any database/Prisma dependency so it
 * can be unit-tested exhaustively and reused on either side of the wire.
 *
 * Time model: the schedule's `workStart`/`workEnd`/`breakTimes` are wall-clock
 * times in the tenant's `timezone`. Bookings are stored as UTC instants. Each
 * generated slot's wall time is resolved to a UTC instant via
 * `zonedWallTimeToUtc` so it can be compared against bookings and `now`, and
 * persisted directly.
 */

export interface AvailabilityScheduleConfig {
  timezone: string;
  /** Keys: mon,tue,wed,thu,fri,sat,sun → whether the tenant works that day. */
  workingDays: Record<string, boolean>;
  /** "HH:MM" wall-clock start of the working day. */
  workStart: string;
  /** "HH:MM" wall-clock end of the working day (appointments must finish by). */
  workEnd: string;
  /** Minutes between slot start times. */
  slotInterval: number;
  /** Wall-clock windows in which no slot may fall (e.g. lunch). */
  breakTimes: { start: string; end: string }[];
  /** Minutes of clearance required around every existing booking. */
  bufferTime: number;
}

export interface BookingInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface AvailableSlot {
  /** UTC instant the slot begins. */
  startsAt: Date;
  /** UTC instant the slot ends. */
  endsAt: Date;
  /** Wall-clock "HH:MM" in the tenant timezone, for display. */
  label: string;
}

export interface GetAvailableSlotsParams {
  /** Calendar day to generate slots for, "YYYY-MM-DD" in the tenant timezone. */
  date: string;
  schedule: AvailabilityScheduleConfig;
  serviceDurationMinutes: number;
  existingBookings: BookingInterval[];
  /** Override "current time" — used by tests and to exclude past slots. */
  now?: Date;
}

// getUTCDay(): 0=Sunday … 6=Saturday → schedule day keys.
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse "HH:MM" into minutes since midnight. */
const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Format minutes since midnight back into a zero-padded "HH:MM". */
const toLabel = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Generate the bookable slots for a single day. Returns an empty array for
 * closed days, fully-booked days, or invalid input — never throws on data.
 */
export function getAvailableSlots(params: GetAvailableSlotsParams): AvailableSlot[] {
  const { date, schedule, serviceDurationMinutes, existingBookings } = params;
  const now = params.now ?? new Date();

  if (!DATE_RE.test(date)) return [];
  if (serviceDurationMinutes <= 0) return [];

  const [year, month, day] = date.split("-").map(Number);

  // Day-of-week of a calendar date is timezone-independent given y/m/d.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const dayKey = WEEKDAY_KEYS[weekday];
  if (!schedule.workingDays?.[dayKey]) return [];

  const workStartMin = toMinutes(schedule.workStart);
  const workEndMin = toMinutes(schedule.workEnd);
  const interval = schedule.slotInterval;
  const duration = serviceDurationMinutes;
  const buffer = schedule.bufferTime ?? 0;
  const breaks = Array.isArray(schedule.breakTimes) ? schedule.breakTimes : [];

  if (interval <= 0 || workStartMin >= workEndMin) return [];

  const slots: AvailableSlot[] = [];

  for (let startMin = workStartMin; startMin + duration <= workEndMin; startMin += interval) {
    const endMin = startMin + duration;

    // Break overlap (wall-clock minutes, same day).
    const onBreak = breaks.some((b) => {
      const bs = toMinutes(b.start);
      const be = toMinutes(b.end);
      return startMin < be && endMin > bs;
    });
    if (onBreak) continue;

    const startH = Math.floor(startMin / 60);
    const startM = startMin % 60;
    const startsAt = zonedWallTimeToUtc(year, month, day, startH, startM, schedule.timezone);
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);

    // Past slots (compare UTC instants).
    if (startsAt.getTime() <= now.getTime()) continue;

    // Existing booking overlap, expanded by the buffer on both sides so there is
    // always `bufferTime` minutes of clearance around a booking.
    const bufferMs = buffer * 60_000;
    const isBooked = existingBookings.some((b) => {
      const blockedStart = b.startsAt.getTime() - bufferMs;
      const blockedEnd = b.endsAt.getTime() + bufferMs;
      return startsAt.getTime() < blockedEnd && endsAt.getTime() > blockedStart;
    });
    if (isBooked) continue;

    slots.push({ startsAt, endsAt, label: toLabel(startMin) });
  }

  return slots;
}
