"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ============================================================================
// Types
// ============================================================================

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

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

// ============================================================================
// Helpers
// ============================================================================

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  NO_SHOW: "No Show",
};

const STATUS_VARIANT: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-500",
  NO_SHOW: "bg-red-100 text-red-700",
};

// Allowed admin transitions per current status
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: ["CANCELLED"],
  NO_SHOW: ["CANCELLED"],
  CANCELLED: [],
};

const ACTION_LABELS: Record<BookingStatus, string> = {
  CONFIRMED: "Confirm",
  COMPLETED: "Mark Complete",
  CANCELLED: "Cancel",
  NO_SHOW: "Mark No-Show",
  PENDING: "",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ============================================================================
// Status badge
// ============================================================================

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_VARIANT[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ============================================================================
// Slide-over detail panel
// ============================================================================

interface SlideOverProps {
  booking: Booking | null;
  onClose: () => void;
  onStatusChange: (bookingId: string, newStatus: BookingStatus) => Promise<void>;
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

  const handleAction = async (targetStatus: BookingStatus) => {
    if (!booking) return;
    setSaving(targetStatus);
    setError(null);
    try {
      await onStatusChange(booking.id, targetStatus);
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
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-gray-900">Booking Details</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-gray-900 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {booking && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Status */}
            <div className="flex items-center gap-3">
              <StatusBadge status={booking.status} />
              <span className="text-xs text-muted-foreground">
                Booked {formatDate(booking.createdAt)}
              </span>
            </div>

            {/* Service + time */}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">{booking.service.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(booking.startsAt)} &middot; {formatTime(booking.startsAt)} &ndash; {formatTime(booking.endsAt)}
              </p>
              <p className="text-sm text-muted-foreground">
                {booking.service.durationMinutes} min
                {booking.service.price > 0 && ` · ₹${booking.service.price}`}
              </p>
            </div>

            <hr className="border-border" />

            {/* Customer */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</p>
              <p className="text-sm font-medium text-gray-900">{booking.customerName}</p>
              <a href={`mailto:${booking.customerEmail}`} className="text-sm text-blue-600 hover:underline block">
                {booking.customerEmail}
              </a>
              {booking.customerPhone && (
                <a href={`tel:${booking.customerPhone}`} className="text-sm text-muted-foreground block">
                  {booking.customerPhone}
                </a>
              )}
            </div>

            {/* Customer notes */}
            {booking.customerNotes && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer Notes</p>
                <p className="text-sm text-gray-700">{booking.customerNotes}</p>
              </div>
            )}

            {/* Admin notes */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Admin Notes</p>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes (not shown to customer)"
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-gray-900 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Email status warning */}
            {booking.confirmationEmailStatus === "FAILED" && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                Confirmation email failed to send.
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Actions footer */}
        {booking && (
          <div className="px-5 py-4 border-t border-border space-y-2">
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
              <p className="text-center text-sm text-muted-foreground py-1">No actions available</p>
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
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No Show" },
];

export default function BookingsPage() {
  const router = useRouter();
  const { accessToken, isLoading } = useAuth();

  const [data, setData] = useState<BookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Slide-over
  const [selected, setSelected] = useState<Booking | null>(null);

  // Track if a filter change should reset the page
  const didMount = useRef(false);

  useEffect(() => {
    if (!isLoading && !accessToken) router.push("/auth");
  }, [accessToken, isLoading, router]);

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

  // Reset page on filter change (skip on mount)
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

  const handleStatusChange = async (bookingId: string, newStatus: BookingStatus) => {
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId ? { ...b, status: newStatus } : b
        ),
      };
    });
    if (selected?.id === bookingId) {
      setSelected((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }

    try {
      const res = await api.patch(`/admin/bookings/${bookingId}`, { status: newStatus });
      const updated: Booking = res.data.data;
      // Sync with server response (authoritative)
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bookings: prev.bookings.map((b) => (b.id === bookingId ? updated : b)),
        };
      });
      if (selected?.id === bookingId) setSelected(updated);
    } catch (err: unknown) {
      // Revert optimistic update
      await fetchBookings();
      throw err instanceof Error ? err : new Error("Update failed");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!accessToken) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-muted-foreground hover:text-gray-900 text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Bookings</h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BookingStatus | "")}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {(status || dateFrom || dateTo) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Content */}
        {fetchError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {loading && (
          <div className="py-16 text-center text-muted-foreground text-sm">Loading…</div>
        )}

        {!loading && data && data.bookings.length === 0 && (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No bookings found.
          </div>
        )}

        {!loading && data && data.bookings.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground">
              {data.total} booking{data.total !== 1 ? "s" : ""}
            </div>

            {/* Cards (mobile-first, also used on desktop) */}
            <div className="space-y-2">
              {data.bookings.map((booking) => (
                <Card
                  key={booking.id}
                  className={`cursor-pointer hover:shadow-sm transition-shadow ${selected?.id === booking.id ? "ring-2 ring-ring" : ""}`}
                  onClick={() => setSelected(booking)}
                >
                  <CardContent className="py-3 px-4 flex items-center gap-4">
                    {/* Date / time block */}
                    <div className="min-w-[80px] text-center">
                      <div className="text-xs text-muted-foreground">{formatDate(booking.startsAt)}</div>
                      <div className="text-sm font-semibold text-gray-900">{formatTime(booking.startsAt)}</div>
                    </div>

                    {/* Customer + service */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{booking.customerName}</div>
                      <div className="text-xs text-muted-foreground truncate">{booking.service.name}</div>
                    </div>

                    {/* Status */}
                    <StatusBadge status={booking.status} />

                    {/* Email failure warning */}
                    {booking.confirmationEmailStatus === "FAILED" && (
                      <span className="text-amber-500 text-xs" title="Email failed">!</span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {Math.ceil(data.total / data.limit)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </main>

      {/* Slide-over */}
      <SlideOver
        booking={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
