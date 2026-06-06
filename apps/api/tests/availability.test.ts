import { describe, it, expect } from "vitest";
import {
  getAvailableSlots,
  type AvailabilityScheduleConfig,
} from "../src/lib/availability";

// Asia/Kolkata is UTC+5:30 with no DST, which makes the UTC arithmetic in these
// assertions easy to reason about: 09:00 IST === 03:30 UTC.
const baseSchedule: AvailabilityScheduleConfig = {
  timezone: "Asia/Kolkata",
  workingDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false },
  workStart: "09:00",
  workEnd: "18:00",
  slotInterval: 30,
  breakTimes: [],
  bufferTime: 0,
};

// A fixed "now" far in the past so generated slots are never treated as past,
// except in the test that specifically exercises the past-slot filter.
const longAgo = new Date("2000-01-01T00:00:00Z");

// 2026-06-08 is a Monday; 2026-06-07 is a Sunday.
const MONDAY = "2026-06-08";
const SUNDAY = "2026-06-07";

describe("getAvailableSlots", () => {
  it("returns empty array for a closed day", () => {
    const slots = getAvailableSlots({
      date: SUNDAY, // sun: false
      schedule: baseSchedule,
      serviceDurationMinutes: 30,
      existingBookings: [],
      now: longAgo,
    });
    expect(slots).toEqual([]);
  });

  it("returns empty array when the day is fully booked", () => {
    // One booking spanning the entire 09:00–18:00 working day.
    const fullDay = {
      startsAt: new Date("2026-06-08T03:30:00Z"), // 09:00 IST
      endsAt: new Date("2026-06-08T12:30:00Z"), // 18:00 IST
    };
    const slots = getAvailableSlots({
      date: MONDAY,
      schedule: baseSchedule,
      serviceDurationMinutes: 30,
      existingBookings: [fullDay],
      now: longAgo,
    });
    expect(slots).toEqual([]);
  });

  it("respects a lunch break 13:00–14:00", () => {
    const schedule = { ...baseSchedule, breakTimes: [{ start: "13:00", end: "14:00" }] };
    const slots = getAvailableSlots({
      date: MONDAY,
      schedule,
      serviceDurationMinutes: 30,
      existingBookings: [],
      now: longAgo,
    });
    const labels = slots.map((s) => s.label);
    // 13:00 and 13:30 starts collide with the break; 12:30 (ends 13:00) and
    // 14:00 are fine.
    expect(labels).toContain("12:30");
    expect(labels).toContain("14:00");
    expect(labels).not.toContain("13:00");
    expect(labels).not.toContain("13:30");
  });

  it("excludes slots in the past", () => {
    // now = 10:30 IST → 05:00 UTC. Slots starting at/ before 10:30 are excluded.
    const now = new Date("2026-06-08T05:00:00Z");
    const slots = getAvailableSlots({
      date: MONDAY,
      schedule: baseSchedule,
      serviceDurationMinutes: 30,
      existingBookings: [],
      now,
    });
    const labels = slots.map((s) => s.label);
    expect(labels).not.toContain("09:00");
    expect(labels).not.toContain("10:00");
    expect(labels).not.toContain("10:30");
    expect(labels).toContain("11:00");
  });

  it("respects service duration (a 60-min service needs a 60-min window)", () => {
    const slots = getAvailableSlots({
      date: MONDAY,
      schedule: baseSchedule, // 09:00–18:00, 30-min interval
      serviceDurationMinutes: 60,
      existingBookings: [],
      now: longAgo,
    });
    const labels = slots.map((s) => s.label);
    // Last start must leave room to finish by 18:00 → 17:00, not 17:30.
    expect(labels).toContain("17:00");
    expect(labels).not.toContain("17:30");
    // Each slot is a full hour long.
    const first = slots[0];
    expect(first.endsAt.getTime() - first.startsAt.getTime()).toBe(60 * 60_000);
  });

  it("applies buffer time around existing bookings", () => {
    // Booking 09:00–09:30 IST with a 15-minute buffer blocks [08:45, 09:45].
    const schedule = { ...baseSchedule, slotInterval: 15, bufferTime: 15 };
    const slots = getAvailableSlots({
      date: MONDAY,
      schedule,
      serviceDurationMinutes: 15,
      existingBookings: [
        {
          startsAt: new Date("2026-06-08T03:30:00Z"), // 09:00 IST
          endsAt: new Date("2026-06-08T04:00:00Z"), // 09:30 IST
        },
      ],
      now: longAgo,
    });
    const labels = slots.map((s) => s.label);
    expect(labels).not.toContain("09:00");
    expect(labels).not.toContain("09:30"); // ends 09:45, still inside buffer
    expect(labels).toContain("09:45"); // first slot clear of the buffer
  });

  it("maps wall-clock slots to correct UTC instants", () => {
    const slots = getAvailableSlots({
      date: MONDAY,
      schedule: baseSchedule,
      serviceDurationMinutes: 30,
      existingBookings: [],
      now: longAgo,
    });
    // 09:00 IST === 03:30 UTC.
    expect(slots[0].label).toBe("09:00");
    expect(slots[0].startsAt.toISOString()).toBe("2026-06-08T03:30:00.000Z");
  });
});
