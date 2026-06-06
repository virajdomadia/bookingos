import { z } from "zod";

/**
 * Single source of truth for request validation shared across create/update
 * handlers. Keeping these here removes the duplicated inline checks that used
 * to live in every route and drift apart over time.
 */

const HHMM = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Use HH:MM (00:00–23:59)");

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use hex format #RRGGBB");

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(1, "Service name must be 1-100 characters").max(100, "Service name must be 1-100 characters"),
  durationMinutes: z.number().int().min(5, "Duration must be 5-480 minutes").max(480, "Duration must be 5-480 minutes"),
  price: z.number().min(0, "Price must be a non-negative number"),
  isStaffService: z.boolean().optional().default(false),
});

export const serviceUpdateSchema = z.object({
  name: z.string().trim().min(1, "Service name must be 1-100 characters").max(100, "Service name must be 1-100 characters").optional(),
  durationMinutes: z.number().int().min(5, "Duration must be 5-480 minutes").max(480, "Duration must be 5-480 minutes").optional(),
  price: z.number().min(0, "Price must be a non-negative number").optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Tenant branding
// ---------------------------------------------------------------------------

export const tenantUpdateSchema = z.object({
  name: z.string().trim().min(1, "Tenant name must be 1-100 characters").max(100, "Tenant name must be 1-100 characters").optional(),
  logoUrl: z.string().url("Invalid logo URL").max(2048).nullable().optional(),
  primaryColor: hexColor.optional(),
});

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export const breakTimeSchema = z
  .object({ start: HHMM, end: HHMM })
  .refine((b) => b.start < b.end, { message: "Break start must be before break end" });

const ianaTimezone = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid timezone identifier" }
  );

// Exactly the seven day keys the availability engine reads — a free-form
// `record(boolean)` let arbitrary keys through (e.g. `{ funday: true }`), which
// would silently produce wrong availability.
const workingDaysSchema = z
  .object({
    mon: z.boolean(),
    tue: z.boolean(),
    wed: z.boolean(),
    thu: z.boolean(),
    fri: z.boolean(),
    sat: z.boolean(),
    sun: z.boolean(),
  })
  .strict()
  .refine((d) => Object.values(d).some(Boolean), {
    message: "At least one working day must be active",
  });

export const scheduleUpdateSchema = z.object({
  timezone: ianaTimezone.optional(),
  workStart: HHMM.optional(),
  workEnd: HHMM.optional(),
  slotInterval: z.number().int().min(5, "Slot interval must be between 5 and 120 minutes").max(120, "Slot interval must be between 5 and 120 minutes").optional(),
  bufferTime: z.number().int().min(0).max(120).optional(),
  breakTimes: z.array(breakTimeSchema).max(20).optional(),
  workingDays: workingDaysSchema.optional(),
});

export interface EffectiveSchedule {
  workStart: string;
  workEnd: string;
  breakTimes: { start: string; end: string }[];
}

/**
 * Cross-field checks that can only be evaluated once the incoming partial
 * update is merged with the persisted schedule. Guards against partial updates
 * that would leave the schedule incoherent (e.g. updating only workStart so
 * that it ends up after the existing workEnd) and rejects overlapping breaks
 * and breaks outside working hours.
 */
export function validateScheduleCoherence(s: EffectiveSchedule): string | null {
  if (s.workStart >= s.workEnd) {
    return "Work start must be before work end";
  }

  const breaks = [...s.breakTimes].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < breaks.length; i++) {
    const b = breaks[i];
    if (b.start < s.workStart || b.end > s.workEnd) {
      return "Break times must fall within working hours";
    }
    if (i > 0 && b.start < breaks[i - 1].end) {
      return "Break times must not overlap";
    }
  }

  return null;
}
