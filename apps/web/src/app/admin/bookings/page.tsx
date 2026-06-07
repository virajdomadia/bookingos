"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XIcon, MailIcon, PhoneIcon, AlertTriangleIcon, CalendarX2Icon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AdminShell } from "../_components/AdminShell";
import { StatusBadge, STATUS_LABELS, type BookingStatus } from "../_components/StatusBadge";

interface BookingService {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  customerNotes: string | null;
  adminNotes: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  cancelToken: string;
  confirmationEmailStatus: string;
  createdAt: string;
  service: BookingService;
}

interface BookingPage {
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: ["CANCELLED"],
  NO_SHOW: ["CANCELLED"],
  CANCELLED: [],
};

const ACTION_LABELS: Record<BookingStatus, string> = {
  CONFIRMED: "Confirm",
  COMPLETED: "Mark complete",
  CANCELLED: "Cancel",
  NO_SHOW: "Mark no-show",
  PENDING: "",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ============================================================================
// Slide-over detail panel
// ============================================================================

interface SlideOverProps {
  booking: Booking | null;
  onClose: () => void;
  onStatusChange: (bookingId: string, newStatus: BookingStatus, adminNotes: string) => Promise<void>;
}

function SlideOver({ booking, onClose, onStatusChange }: SlideOverProps) {
  const [saving, setSaving] = useState<BookingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    setAdminNotes(booking?.adminNotes ?? "");
    setError(null);
    setSaving(null);
  }, [booking?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleAction = async (targetStatus: BookingStatus) => {
    if (!booking) return;
    setSaving(targetStatus);
    setError(null);
    try {
      // Carry the admin notes (e.g. cancellation reason) through so they're
      // persisted alongside the status change.
      await onStatusChange(booking.id, targetStatus, adminNotes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(null);
    }
  };

  const isOpen = booking !== null;
  const transitions = booking ? TRANSITIONS[booking.status] : [];

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/30 transition-opacity",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-card shadow-lg transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading font-semibold text-foreground">Booking details</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {booking && (
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div className="flex items-center gap-3">
              <StatusBadge status={booking.status} />
              <span className="text-xs text-muted-foreground">Booked {formatDate(booking.createdAt)}</span>
            </div>

            <div className="space-y-1">
              <p className="font-medium text-foreground">{booking.service.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(booking.startsAt)} · {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
              </p>
              <p className="text-sm text-muted-foreground">
                {booking.service.durationMinutes} min
                {booking.service.price > 0 && ` · ₹${booking.service.price}`}
              </p>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</p>
              <p className="font-medium text-foreground">{booking.customerName}</p>
              <a
                href={`mailto:${booking.customerEmail}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <MailIcon className="size-4" />
                {booking.customerEmail}
              </a>
              {booking.customerPhone && (
                <a
                  href={`tel:${booking.customerPhone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <PhoneIcon className="size-4" />
                  {booking.customerPhone}
                </a>
              )}
            </div>

            {booking.customerNotes && (
              <div className="space-y-1 border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Customer notes
                </p>
                <p className="text-sm text-foreground">{booking.customerNotes}</p>
              </div>
            )}

            <div className="space-y-1.5 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Admin notes
              </p>
              <Textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes (not shown to customer)"
                className="resize-none"
              />
            </div>

            {booking.confirmationEmailStatus === "FAILED" && (
              <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                <AlertTriangleIcon className="size-4" />
                Confirmation email failed to send.
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
        )}

        {booking && (
          <div className="space-y-2 border-t border-border px-5 py-4">
            {transitions.map((targetStatus) => (
              <Button
                key={targetStatus}
                variant={targetStatus === "CANCELLED" ? "destructive" : "default"}
                className="w-full"
                disabled={saving !== null}
                onClick={() => handleAction(targetStatus)}
              >
                {saving === targetStatus ? "Saving…" : ACTION_LABELS[targetStatus]}
              </Button>
            ))}
            {transitions.length === 0 && (
              <p className="py-1 text-center text-sm text-muted-foreground">No actions available</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// Main page
// ============================================================================

const STATUSES: Array<{ value: BookingStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  ...(Object.keys(STATUS_LABELS) as BookingStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

const selectClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export default function BookingsPage() {
  const { accessToken } = useAuth();

  const [data, setData] = useState<BookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [status, setStatus] = useState<BookingStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Booking | null>(null);

  const didMount = useRef(false);

  const fetchBookings = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setFetchError(null);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (status) params.status = status;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get("/admin/bookings", { params });
      setData(res.data.data);
    } catch {
      setFetchError("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, status, dateFrom, dateTo, page]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    setPage(1);
  }, [status, dateFrom, dateTo]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleStatusChange = async (bookingId: string, newStatus: BookingStatus, adminNotes?: string) => {
    setData((prev) =>
      prev
        ? { ...prev, bookings: prev.bookings.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b)) }
        : prev
    );
    if (selected?.id === bookingId) {
      setSelected((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }

    try {
      const res = await api.patch(`/admin/bookings/${bookingId}`, {
        status: newStatus,
        ...(adminNotes !== undefined && { adminNotes }),
      });
      const updated: Booking = res.data.data;
      setData((prev) =>
        prev ? { ...prev, bookings: prev.bookings.map((b) => (b.id === bookingId ? updated : b)) } : prev
      );
      if (selected?.id === bookingId) setSelected(updated);
    } catch (err: unknown) {
      await fetchBookings();
      throw err instanceof Error ? err : new Error("Update failed");
    }
  };

  const hasFilters = !!(status || dateFrom || dateTo);

  return (
    <AdminShell active="bookings" title="Bookings">
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | "")} className={selectClass}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectClass} />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatus(""); setDateFrom(""); setDateTo(""); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {fetchError && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] w-full rounded-xl" />
          ))}
        </div>
      ) : data && data.bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarX2Icon className="size-6" />
          </div>
          <p className="font-medium text-foreground">No bookings found</p>
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "Try clearing the filters." : "Bookings will appear here as customers schedule."}
          </p>
        </div>
      ) : data ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {data.total} booking{data.total !== 1 ? "s" : ""}
          </p>

          <ul className="space-y-2">
            {data.bookings.map((booking) => (
              <li key={booking.id}>
                <Card
                  size="sm"
                  className={cn(
                    "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md",
                    selected?.id === booking.id && "ring-2 ring-ring/50"
                  )}
                  onClick={() => setSelected(booking)}
                >
                  <CardContent className="flex items-center gap-4">
                    <div className="min-w-[84px] text-center">
                      <div className="text-xs text-muted-foreground">{formatDate(booking.startsAt)}</div>
                      <div className="text-sm font-semibold text-foreground">{formatTime(booking.startsAt)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{booking.customerName}</div>
                      <div className="truncate text-xs text-muted-foreground">{booking.service.name}</div>
                    </div>
                    {booking.confirmationEmailStatus === "FAILED" && (
                      <AlertTriangleIcon className="size-4 text-warning-foreground" aria-label="Email failed" />
                    )}
                    <StatusBadge status={booking.status} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {Math.max(1, Math.ceil(data.total / data.limit))}
            </span>
            <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      ) : null}

      <SlideOver booking={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} />
    </AdminShell>
  );
}
