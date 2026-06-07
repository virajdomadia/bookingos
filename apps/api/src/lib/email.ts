import { Resend } from "resend";
import prisma from "./prisma.js";
import { withTenant } from "./tenantDb.js";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const FROM = process.env.EMAIL_FROM ?? "BookingOS <onboarding@resend.dev>";

let resend: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn("[email] RESEND_API_KEY not set — email sending disabled");
}

// ============================================================================
// Types
// ============================================================================

export type BookingEmailData = {
  id: string;
  cancelToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerNotes?: string | null;
  adminNotes?: string | null;
  startsAt: Date;
  endsAt: Date;
  service: { name: string; durationMinutes: number; price: number };
};

export type TenantEmailData = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  /** IANA timezone the booking's wall-clock time must be rendered in. */
  timezone: string;
};

// ============================================================================
// ICS generator
// ============================================================================

function makeICS(booking: BookingEmailData, tenantName: string): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BookingOS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@bookingos`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(booking.startsAt)}`,
    `DTEND:${fmt(booking.endsAt)}`,
    `SUMMARY:${esc(`${booking.service.name} at ${tenantName}`)}`,
    `DESCRIPTION:${esc(`Booked by ${booking.customerName}. Awaiting confirmation.`)}`,
    "STATUS:TENTATIVE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// ============================================================================
// Template helpers
// ============================================================================

// Bookings are stored as UTC instants of a tenant-local wall time. These MUST
// render in the tenant's timezone, otherwise customers are told a time off by
// the zone offset (e.g. 09:00 IST would show as 03:30).
function fmtDate(d: Date, tz: string): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
}

function fmtTime(d: Date, tz: string): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });
}

/**
 * Escape user-supplied text before interpolating it into an HTML email body.
 * Customer name/email/phone/notes come from the unauthenticated public booking
 * form, so without this they could inject markup into the (trusted-looking)
 * confirmation and admin-notification emails.
 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hour${h > 1 ? "s" : ""}`;
}

function detailRows(rows: Array<[string, string]>): string {
  return rows
    .map(
      ([label, value]) => `
<tr>
  <td style="padding:8px 0;color:#71717a;font-size:14px;min-width:100px;vertical-align:top;white-space:nowrap">${label}</td>
  <td style="padding:8px 0;padding-left:16px;font-size:14px;font-weight:500;vertical-align:top;word-break:break-word">${value}</td>
</tr>`
    )
    .join("");
}

function baseEmail(accent: string, header: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px">
<table cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
<tr><td style="background:${accent};padding:28px 40px;text-align:center">${header}</td></tr>
<tr><td style="padding:32px 40px">${body}</td></tr>
<tr><td style="padding:16px 40px 24px;text-align:center;border-top:1px solid #f4f4f5;color:#71717a;font-size:12px">
<p style="margin:0">Powered by BookingOS</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ============================================================================
// Templates
// ============================================================================

function tplBookingReceived(booking: BookingEmailData, tenant: TenantEmailData): string {
  const cancelUrl = `${FRONTEND_URL}/cancel/${booking.cancelToken}`;
  const tz = tenant.timezone;
  const header = `<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">&#10003; Booking Received</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">${esc(tenant.name)}</p>`;
  const rows: Array<[string, string]> = [
    ["Service", esc(booking.service.name)],
    ["Date", fmtDate(booking.startsAt, tz)],
    ["Time", fmtTime(booking.startsAt, tz)],
    ["Duration", fmtDuration(booking.service.durationMinutes)],
    ...(booking.service.price > 0 ? ([["Price", `&#8377;${booking.service.price}`]] as Array<[string, string]>) : []),
  ];
  const body = `<p style="margin:0 0 16px;font-size:16px;color:#18181b">Hi ${esc(booking.customerName)},</p>
<p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.5">Your booking has been received and is <strong>awaiting confirmation</strong>. We'll send you an update shortly.</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #f4f4f5;margin-top:4px">${detailRows(rows)}</table>
<p style="margin:24px 0 0;font-size:13px;color:#71717a">Need to cancel? <a href="${cancelUrl}" style="color:#71717a">Click here</a></p>`;
  return baseEmail(tenant.primaryColor, header, body);
}

function tplBookingConfirmed(booking: BookingEmailData, tenant: TenantEmailData): string {
  const cancelUrl = `${FRONTEND_URL}/cancel/${booking.cancelToken}`;
  const tz = tenant.timezone;
  const header = `<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">&#10003; Booking Confirmed</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">${esc(tenant.name)}</p>`;
  const rows: Array<[string, string]> = [
    ["Service", esc(booking.service.name)],
    ["Date", fmtDate(booking.startsAt, tz)],
    ["Time", fmtTime(booking.startsAt, tz)],
    ["Duration", fmtDuration(booking.service.durationMinutes)],
    ...(booking.service.price > 0 ? ([["Price", `&#8377;${booking.service.price}`]] as Array<[string, string]>) : []),
  ];
  const body = `<p style="margin:0 0 16px;font-size:16px;color:#18181b">Hi ${esc(booking.customerName)},</p>
<p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.5">Your booking is <strong>confirmed</strong>. See you soon!</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #f4f4f5;margin-top:4px">${detailRows(rows)}</table>
<p style="margin:24px 0 0;font-size:13px;color:#71717a">Need to cancel? <a href="${cancelUrl}" style="color:#71717a">Click here</a></p>`;
  return baseEmail(tenant.primaryColor, header, body);
}

function tplBookingCancelled(booking: BookingEmailData, tenant: TenantEmailData): string {
  const tz = tenant.timezone;
  const header = `<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Booking Cancelled</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">${esc(tenant.name)}</p>`;
  // NOTE: adminNotes are internal ("not shown to customer" per the UI) — never
  // surface them in the customer-facing cancellation email.
  const rows: Array<[string, string]> = [
    ["Service", esc(booking.service.name)],
    ["Date", fmtDate(booking.startsAt, tz)],
    ["Time", fmtTime(booking.startsAt, tz)],
  ];
  const body = `<p style="margin:0 0 16px;font-size:16px;color:#18181b">Hi ${esc(booking.customerName)},</p>
<p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.5">Your booking has been <strong>cancelled</strong>.</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #f4f4f5;margin-top:4px">${detailRows(rows)}</table>
<p style="margin:24px 0 0;font-size:15px;color:#3f3f46">You're welcome to book again at any time.</p>`;
  return baseEmail("#6b7280", header, body);
}

function tplAdminNewBooking(booking: BookingEmailData, tenant: TenantEmailData): string {
  const adminUrl = `${FRONTEND_URL}/admin/bookings`;
  const tz = tenant.timezone;
  const header = `<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">New Booking</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">${esc(tenant.name)}</p>`;
  const rows: Array<[string, string]> = [
    ["Customer", esc(booking.customerName)],
    ["Email", esc(booking.customerEmail)],
    ...(booking.customerPhone ? ([["Phone", esc(booking.customerPhone)]] as Array<[string, string]>) : []),
    ["Service", esc(booking.service.name)],
    ["Date", fmtDate(booking.startsAt, tz)],
    ["Time", fmtTime(booking.startsAt, tz)],
    ...(booking.customerNotes ? ([["Notes", esc(booking.customerNotes)]] as Array<[string, string]>) : []),
  ];
  const body = `<p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.5">A new booking is awaiting your confirmation.</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #f4f4f5;margin-top:4px">${detailRows(rows)}</table>
<p style="margin:28px 0 0">
<a href="${adminUrl}" style="display:inline-block;background:${tenant.primaryColor};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">View in Dashboard &#8594;</a>
</p>`;
  return baseEmail(tenant.primaryColor, header, body);
}

// Template for customer-cancelled booking (used in F7)
export function tplCustomerCancelledAdmin(booking: BookingEmailData, tenant: TenantEmailData): string {
  const adminUrl = `${FRONTEND_URL}/admin/bookings`;
  const tz = tenant.timezone;
  const header = `<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Booking Cancelled by Customer</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">${esc(tenant.name)}</p>`;
  const rows: Array<[string, string]> = [
    ["Customer", esc(booking.customerName)],
    ["Service", esc(booking.service.name)],
    ["Date", fmtDate(booking.startsAt, tz)],
    ["Time", fmtTime(booking.startsAt, tz)],
  ];
  const body = `<p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.5">${esc(booking.customerName)} has cancelled their booking.</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #f4f4f5;margin-top:4px">${detailRows(rows)}</table>
<p style="margin:28px 0 0">
<a href="${adminUrl}" style="display:inline-block;background:${tenant.primaryColor};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">View in Dashboard &#8594;</a>
</p>`;
  return baseEmail("#6b7280", header, body);
}

// Template for 24hr reminder (used in F9)
export function tplBookingReminder(booking: BookingEmailData, tenant: TenantEmailData): string {
  const cancelUrl = `${FRONTEND_URL}/cancel/${booking.cancelToken}`;
  const tz = tenant.timezone;
  const header = `<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Reminder: Tomorrow</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">${esc(tenant.name)}</p>`;
  const rows: Array<[string, string]> = [
    ["Service", esc(booking.service.name)],
    ["Date", fmtDate(booking.startsAt, tz)],
    ["Time", fmtTime(booking.startsAt, tz)],
    ["Duration", fmtDuration(booking.service.durationMinutes)],
  ];
  const body = `<p style="margin:0 0 16px;font-size:16px;color:#18181b">Hi ${esc(booking.customerName)},</p>
<p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.5">This is a reminder about your appointment <strong>tomorrow</strong>.</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #f4f4f5;margin-top:4px">${detailRows(rows)}</table>
<p style="margin:24px 0 0;font-size:13px;color:#71717a">Need to cancel? <a href="${cancelUrl}" style="color:#71717a">Click here</a></p>`;
  return baseEmail(tenant.primaryColor, header, body);
}

// ============================================================================
// Internal helpers
// ============================================================================

// Booking has FORCE ROW LEVEL SECURITY, so this update must run inside a tenant
// context — a raw client write would be invisible to the policy and throw P2025,
// leaving confirmationEmailStatus stuck at PENDING.
async function markEmailStatus(
  tenantId: string,
  bookingId: string,
  status: "SENT" | "FAILED"
): Promise<void> {
  await withTenant(tenantId, (tx) =>
    tx.booking.update({ where: { id: bookingId }, data: { confirmationEmailStatus: status } })
  ).catch((err) => console.error("[email] Failed to update confirmationEmailStatus:", err));
}

async function ownerEmail(tenantId: string): Promise<string | null> {
  const owner = await prisma.user
    .findFirst({ where: { tenantId, role: "OWNER", isActive: true }, select: { email: true } })
    .catch(() => null);
  return owner?.email ?? null;
}

async function send(params: {
  to: string;
  subject: string;
  html: string;
  attachment?: string;
}): Promise<void> {
  if (!resend) return;

  const attachments = params.attachment
    ? [
        {
          filename: "booking.ics",
          content: params.attachment,
          contentType: "text/calendar; charset=utf-8",
        },
      ]
    : undefined;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments,
  });
}

// ============================================================================
// Public send functions
// ============================================================================

/** Customer confirmation on booking creation. Updates confirmationEmailStatus. */
export async function sendBookingReceived(
  booking: BookingEmailData,
  tenant: TenantEmailData
): Promise<void> {
  try {
    await send({
      to: booking.customerEmail,
      subject: `Booking received — ${booking.service.name} at ${tenant.name}`,
      html: tplBookingReceived(booking, tenant),
      attachment: makeICS(booking, tenant.name),
    });
    await markEmailStatus(tenant.id, booking.id, "SENT");
  } catch (err) {
    console.error("[email] sendBookingReceived failed:", err);
    await markEmailStatus(tenant.id, booking.id, "FAILED");
  }
}

/** Admin notification on new booking. Does not update confirmationEmailStatus. */
export async function sendAdminNewBooking(
  booking: BookingEmailData,
  tenant: TenantEmailData
): Promise<void> {
  try {
    const to = await ownerEmail(tenant.id);
    if (!to) return;
    await send({
      to,
      subject: `New booking — ${booking.customerName} for ${booking.service.name}`,
      html: tplAdminNewBooking(booking, tenant),
    });
  } catch (err) {
    console.error("[email] sendAdminNewBooking failed:", err);
  }
}

/** Customer notification when admin confirms the booking. Includes .ics. */
export async function sendBookingConfirmed(
  booking: BookingEmailData,
  tenant: TenantEmailData
): Promise<void> {
  try {
    await send({
      to: booking.customerEmail,
      subject: `Booking confirmed — ${booking.service.name} at ${tenant.name}`,
      html: tplBookingConfirmed(booking, tenant),
      attachment: makeICS(booking, tenant.name),
    });
  } catch (err) {
    console.error("[email] sendBookingConfirmed failed:", err);
  }
}

/** Customer notification when booking is cancelled (admin or system). */
export async function sendBookingCancelled(
  booking: BookingEmailData,
  tenant: TenantEmailData
): Promise<void> {
  try {
    await send({
      to: booking.customerEmail,
      subject: `Booking cancelled — ${booking.service.name} at ${tenant.name}`,
      html: tplBookingCancelled(booking, tenant),
    });
  } catch (err) {
    console.error("[email] sendBookingCancelled failed:", err);
  }
}

/** Admin notification when customer cancels via email link (F7). */
export async function sendAdminCustomerCancelled(
  booking: BookingEmailData,
  tenant: TenantEmailData
): Promise<void> {
  try {
    const to = await ownerEmail(tenant.id);
    if (!to) return;
    await send({
      to,
      subject: `Booking cancelled — ${booking.customerName} cancelled ${booking.service.name}`,
      html: tplCustomerCancelledAdmin(booking, tenant),
    });
  } catch (err) {
    console.error("[email] sendAdminCustomerCancelled failed:", err);
  }
}

/** 24hr reminder email to customer (F9 cron). */
export async function sendBookingReminder(
  booking: BookingEmailData,
  tenant: TenantEmailData
): Promise<void> {
  try {
    await send({
      to: booking.customerEmail,
      subject: `Reminder: ${booking.service.name} at ${tenant.name} tomorrow`,
      html: tplBookingReminder(booking, tenant),
    });
  } catch (err) {
    console.error("[email] sendBookingReminder failed:", err);
  }
}
