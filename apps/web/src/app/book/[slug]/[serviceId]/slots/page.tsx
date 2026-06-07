"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ClockIcon, CalendarX2Icon } from "lucide-react";
import { getAvailability, type AvailabilitySlot } from "@/lib/publicApi";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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

/** Bucket a "HH:MM" 24h time into a part-of-day label. */
function periodOf(time: string): "Morning" | "Afternoon" | "Evening" {
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

const PERIOD_ORDER = ["Morning", "Afternoon", "Evening"] as const;

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

  const grouped = useMemo(() => {
    if (!slots) return [];
    const buckets: Record<string, AvailabilitySlot[]> = {};
    for (const slot of slots) {
      (buckets[periodOf(slot.time)] ??= []).push(slot);
    }
    return PERIOD_ORDER.filter((p) => buckets[p]?.length).map((p) => ({ period: p, items: buckets[p] }));
  }, [slots]);

  const backHref = `/book/${slug}/${serviceId}/date`;

  if (!date) {
    return (
      <BookingShell tenant={tenant ?? undefined} backHref={backHref}>
        <p className="py-12 text-center text-muted-foreground">No date selected.</p>
      </BookingShell>
    );
  }

  return (
    <BookingShell tenant={tenant ?? undefined} step="Choose a time" backHref={backHref}>
      {notice && (
        <Alert className="mb-4 border-warning/30 bg-warning/10">
          <AlertDescription className="text-warning-foreground">{notice}</AlertDescription>
        </Alert>
      )}

      <div className="mb-5 space-y-1.5">
        {service && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{service.name}</span>
            <Badge variant="secondary" className="gap-1">
              <ClockIcon className="size-3" />
              {service.durationMinutes} min
            </Badge>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{formatHumanDate(date)}</p>
      </div>

      {loading || ctxLoading ? (
        <div className="space-y-5">
          {Array.from({ length: 2 }).map((_, g) => (
            <div key={g} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="py-12 text-center text-muted-foreground">{error}</p>
      ) : grouped.length > 0 ? (
        <div className="space-y-5">
          {grouped.map(({ period, items }) => (
            <section key={period} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {period}
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {items.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/book/${slug}/${serviceId}/details?date=${date}&time=${encodeURIComponent(slot.time)}`
                      )
                    }
                    className="h-11 rounded-lg border border-border bg-card text-sm font-medium text-foreground shadow-xs transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarX2Icon className="size-6" />
          </div>
          <p className="font-medium text-foreground">No times available</p>
          <p className="text-sm text-muted-foreground">Try picking another date.</p>
        </div>
      )}
    </BookingShell>
  );
}

export default function SlotsPage() {
  return (
    <Suspense
      fallback={
        <BookingShell>
          <p className="py-12 text-center text-muted-foreground">Loading…</p>
        </BookingShell>
      }
    >
      <SlotsContent />
    </Suspense>
  );
}
