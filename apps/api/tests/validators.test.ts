import { describe, it, expect } from "vitest";
import {
  serviceCreateSchema,
  scheduleUpdateSchema,
  validateScheduleCoherence,
} from "../src/lib/validators";

describe("serviceCreateSchema", () => {
  it("accepts a valid service", () => {
    const parsed = serviceCreateSchema.parse({ name: "Haircut", durationMinutes: 30, price: 600 });
    expect(parsed.name).toBe("Haircut");
    expect(parsed.isStaffService).toBe(false);
  });

  it("rejects out-of-range duration", () => {
    expect(() => serviceCreateSchema.parse({ name: "X", durationMinutes: 1, price: 0 })).toThrow();
  });

  it("rejects negative price", () => {
    expect(() => serviceCreateSchema.parse({ name: "X", durationMinutes: 30, price: -1 })).toThrow();
  });
});

describe("scheduleUpdateSchema", () => {
  it("rejects malformed time", () => {
    expect(() => scheduleUpdateSchema.parse({ workStart: "9am" })).toThrow();
  });

  it("rejects a week with no active days", () => {
    expect(() => scheduleUpdateSchema.parse({ workingDays: { mon: false, tue: false } })).toThrow();
  });

  it("accepts a valid partial update", () => {
    expect(scheduleUpdateSchema.parse({ slotInterval: 45 }).slotInterval).toBe(45);
  });
});

describe("validateScheduleCoherence", () => {
  it("passes for a coherent schedule", () => {
    expect(
      validateScheduleCoherence({
        workStart: "09:00",
        workEnd: "18:00",
        breakTimes: [{ start: "12:00", end: "13:00" }],
      })
    ).toBeNull();
  });

  it("rejects start >= end", () => {
    expect(
      validateScheduleCoherence({ workStart: "18:00", workEnd: "09:00", breakTimes: [] })
    ).toMatch(/before work end/);
  });

  it("rejects overlapping breaks", () => {
    expect(
      validateScheduleCoherence({
        workStart: "09:00",
        workEnd: "18:00",
        breakTimes: [
          { start: "12:00", end: "13:00" },
          { start: "12:30", end: "14:00" },
        ],
      })
    ).toMatch(/overlap/);
  });

  it("rejects breaks outside working hours", () => {
    expect(
      validateScheduleCoherence({
        workStart: "09:00",
        workEnd: "18:00",
        breakTimes: [{ start: "08:00", end: "08:30" }],
      })
    ).toMatch(/within working hours/);
  });
});
