// Lightweight client for the unauthenticated /public/* booking endpoints.
//
// Deliberately separate from `lib/api.ts`: that Axios instance attaches the
// admin access token and redirects to /auth on 401, which is exactly wrong for
// the public booking flow. These calls carry no credentials.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Carries the HTTP status and server error code so callers can branch (e.g. 409 SLOT_TAKEN). */
export class PublicApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/public${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new PublicApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    const message = (json as { error?: string }).error ?? "Something went wrong";
    const code = (json as { code?: string }).code;
    throw new PublicApiError(res.status, message, code);
  }
  return (json as { data: T }).data;
}

export interface PublicService {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface PublicTenant {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  /** IANA timezone the tenant's schedule and slots are expressed in. */
  timezone: string;
}

export interface BookingPage {
  tenant: PublicTenant;
  services: PublicService[];
}

export interface AvailabilitySlot {
  time: string; // "HH:MM"
  startsAt: string; // ISO UTC
}

export interface CreatedBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  cancelToken: string;
  customerName: string;
  customerEmail: string;
  status: string;
  service: { name: string; durationMinutes: number; price: number };
}

export const getBookingPage = (slug: string) => request<BookingPage>(`/${slug}`);

export const getAvailability = (slug: string, serviceId: string, date: string) =>
  request<{ slots: AvailabilitySlot[] }>(
    `/${slug}/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`
  );

export const createBooking = (
  slug: string,
  body: {
    serviceId: string;
    date: string;
    time: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerNotes?: string;
  }
) => request<CreatedBooking>(`/${slug}/bookings`, { method: "POST", body: JSON.stringify(body) });

// ---------------------------------------------------------------------------
// Cancellation (F7)
// ---------------------------------------------------------------------------

export interface CancelInfo {
  booking: {
    status: string;
    startsAt: string;
    endsAt: string;
    customerName: string;
    service: { name: string; durationMinutes: number; price: number };
  };
  tenant: PublicTenant;
  /** Booking is already cancelled — show the cancelled state, no action. */
  alreadyCancelled: boolean;
  /** Booking is in a cancellable state (pending/confirmed and still upcoming). */
  canCancel: boolean;
}

export const getCancelInfo = (slug: string, token: string) =>
  request<CancelInfo>(`/${slug}/cancel/${encodeURIComponent(token)}`);

export const cancelBooking = (slug: string, token: string) =>
  request<{ cancelled?: boolean; alreadyCancelled?: boolean }>(
    `/${slug}/cancel/${encodeURIComponent(token)}`,
    { method: "POST" }
  );
