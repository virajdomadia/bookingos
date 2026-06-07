"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingShell } from "../../../_components/BookingShell";
import { useBookingContext } from "../../../_components/useBookingContext";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function DatePickerPage() {
  const router = useRouter();
  const { slug, serviceId } = useParams<{ slug: string; serviceId: string }>();
  const { tenant, service, loading, serviceNotFound, error } = useBookingContext(slug, serviceId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const atCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();

  const changeMonth = (delta: number) => {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  if (loading) {
    return (
      <BookingShell tenant={tenant ?? undefined} step="Pick a date" backHref={`/book/${slug}`}>
        <Skeleton className="mb-4 h-7 w-40" />
        <Skeleton className="h-[340px] w-full rounded-xl" />
      </BookingShell>
    );
  }
  if (error || serviceNotFound) {
    return (
      <BookingShell tenant={tenant ?? undefined} backHref={`/book/${slug}`}>
        <p className="py-12 text-center text-muted-foreground">
          {error || "That service is no longer available."}
        </p>
      </BookingShell>
    );
  }

  return (
    <BookingShell tenant={tenant ?? undefined} step="Pick a date" backHref={`/book/${slug}`}>
      {service && (
        <div className="mb-4 flex items-center gap-2">
          <span className="font-medium text-foreground">{service.name}</span>
          <Badge variant="secondary" className="gap-1">
            <ClockIcon className="size-3" />
            {service.durationMinutes} min
          </Badge>
        </div>
      )}

      <Card>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <Button
              aria-label="Previous month"
              disabled={atCurrentMonth}
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="font-heading font-semibold text-foreground">
              {MONTHS[view.month]} {view.year}
            </span>
            <Button aria-label="Next month" onClick={() => changeMonth(1)}>
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-xs font-semibold text-muted-foreground">
                {w}
              </div>
            ))}
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const cellDate = new Date(view.year, view.month, day);
              const isPast = cellDate < today;
              const isToday =
                atCurrentMonth && day === today.getDate();
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  onClick={() =>
                    router.push(`/book/${slug}/${serviceId}/slots?date=${toISO(view.year, view.month, day)}`)
                  }
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    isPast
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "text-foreground hover:bg-primary hover:text-primary-foreground",
                    isToday && !isPast && "ring-1 ring-inset ring-primary/40"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Pick a day to see available times.
      </p>
    </BookingShell>
  );
}

// Local icon-button used for month navigation (outline, square, comfortable tap target).
function Button({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-xs transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    />
  );
}
