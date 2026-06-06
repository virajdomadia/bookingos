"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getAvailability, type AvailabilitySlot } from "@/lib/publicApi";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookingShell } from "../../../_components/BookingShell";
import { useBookingContext } from "../../../_components/useBookingContext";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-06-08" → "Mon, 8 Jun 2026" (parsed as a plain calendar date). */
function formatHumanDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS_SHORT[dow]}, ${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

function SlotsContent() {
  const router = useRouter();
  const { slug, serviceId } = useParams<{ slug: string; serviceId: string }>();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? "";

  const { tenant, service, loading: ctxLoading } = useBookingContext(slug, serviceId);

  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // A "slot just taken" message handed off from the details step on a 409.
  useEffect(() => {
    const msg = sessionStorage.getItem("bookingNotice");
    if (msg) {
      setNotice(msg);
      sessionStorage.removeItem("bookingNotice");
    }
  }, []);

  useEffect(() => {
    if (!slug || !serviceId || !date) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await getAvailability(slug, serviceId, date);
        if (active) setSlots(data.slots);
      } catch {
        if (active) setError("Couldn't load available times. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, serviceId, date]);

  const backHref = `/book/${slug}/${serviceId}/date`;

  if (!date) {
    return (
      <BookingShell tenant={tenant ?? undefined} backHref={backHref}>
        <p className="text-center text-muted-foreground py-12">No date selected.</p>
      </BookingShell>
    );
  }

  return (
    <BookingShell tenant={tenant ?? undefined} step="Choose a time" backHref={backHref}>
      {notice && (
        <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-800">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <div className="mb-4 space-y-1">
        {service && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{service.name}</span>
            <Badge variant="secondary">{service.durationMinutes} min</Badge>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{formatHumanDate(date)}</p>
      </div>

      {loading || ctxLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-md bg-gray-200" />
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-muted-foreground py-12">{error}</p>
      ) : slots && slots.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => (
            <button
              key={slot.startsAt}
              type="button"
              onClick={() =>
                router.push(
                  `/book/${slug}/${serviceId}/details?date=${date}&time=${encodeURIComponent(slot.time)}`
                )
              }
              className="h-11 rounded-md border border-border bg-white text-sm font-medium text-gray-900 transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {slot.time}
            </button>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No times available on this day.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try picking another date.</p>
        </div>
      )}
    </BookingShell>
  );
}

export default function SlotsPage() {
  return (
    <Suspense fallback={<BookingShell><p className="text-center text-muted-foreground py-12">Loading…</p></BookingShell>}>
      <SlotsContent />
    </Suspense>
  );
}
