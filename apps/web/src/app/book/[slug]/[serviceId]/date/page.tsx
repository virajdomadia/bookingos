"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingShell } from "../../../_components/BookingShell";
import { useBookingContext } from "../../../_components/useBookingContext";

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
      <BookingShell tenant={tenant ?? undefined} step="Pick a date">
        <p className="text-center text-muted-foreground py-12">Loading…</p>
      </BookingShell>
    );
  }
  if (error || serviceNotFound) {
    return (
      <BookingShell tenant={tenant ?? undefined} backHref={`/book/${slug}`}>
        <p className="text-center text-muted-foreground py-12">
          {error || "That service is no longer available."}
        </p>
      </BookingShell>
    );
  }

  return (
    <BookingShell tenant={tenant ?? undefined} step="Pick a date" backHref={`/book/${slug}`}>
      {service && (
        <div className="mb-4 flex items-center gap-2">
          <span className="font-medium text-gray-900">{service.name}</span>
          <Badge variant="secondary">{service.durationMinutes} min</Badge>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={atCurrentMonth} onClick={() => changeMonth(-1)}>
              ‹
            </Button>
            <span className="font-semibold text-gray-900">
              {MONTHS[view.month]} {view.year}
            </span>
            <Button variant="outline" size="sm" onClick={() => changeMonth(1)}>
              ›
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-xs font-medium text-muted-foreground">
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
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  onClick={() => router.push(`/book/${slug}/${serviceId}/slots?date=${toISO(view.year, view.month, day)}`)}
                  className={
                    "aspect-square rounded-md text-sm transition-colors " +
                    (isPast
                      ? "cursor-not-allowed text-gray-300"
                      : "text-gray-900 hover:bg-primary hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary")
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </BookingShell>
  );
}
