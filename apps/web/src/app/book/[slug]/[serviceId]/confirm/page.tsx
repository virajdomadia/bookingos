"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckIcon, CalendarPlusIcon } from "lucide-react";
import type { CreatedBooking, PublicTenant } from "@/lib/publicApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingShell } from "../../../_components/BookingShell";

/** Format an ISO instant in the given IANA timezone as a friendly date + time. */
function formatInstant(iso: string, timezone: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function SuccessMark() {
  return (
    <div className="mx-auto mb-5 flex size-16 animate-scale-in items-center justify-center rounded-full bg-success/15 text-success ring-8 ring-success/5">
      <CheckIcon className="size-8" strokeWidth={3} />
    </div>
  );
}

function ConfirmContent() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

  const [data, setData] = useState<{ booking: CreatedBooking; tenant: PublicTenant | null } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return setMissing(true);
    const raw = sessionStorage.getItem(`booking:${id}`);
    if (!raw) return setMissing(true);
    try {
      setData(JSON.parse(raw));
    } catch {
      setMissing(true);
    }
  }, [id]);

  if (missing || !data) {
    return (
      <BookingShell>
        <div className="py-10 text-center">
          <SuccessMark />
          <h1 className="font-heading text-xl font-semibold text-foreground">Booking confirmed</h1>
          <p className="mt-2 text-muted-foreground">
            Your appointment has been booked. Check your email for the details.
          </p>
          <Link href={`/book/${slug}`} className="mt-6 inline-block">
            <Button variant="outline">Book another appointment</Button>
          </Link>
        </div>
      </BookingShell>
    );
  }

  const { booking, tenant } = data;
  const timezone = tenant?.timezone ?? "Asia/Kolkata";

  return (
    <BookingShell tenant={tenant ?? undefined}>
      <div className="py-6 text-center">
        <SuccessMark />
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          You&apos;re booked!
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          A confirmation has been sent to{" "}
          <span className="font-medium text-foreground">{booking.customerEmail}</span>.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 text-sm">
          <Row label="Service" value={booking.service.name} />
          <Row label="When" value={formatInstant(booking.startsAt, timezone)} />
          <Row label="Duration" value={`${booking.service.durationMinutes} min`} />
          <Row label="Name" value={booking.customerName} />
          <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="warning">Awaiting confirmation</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 space-y-2.5">
        <Button variant="outline" className="w-full" disabled>
          <CalendarPlusIcon className="size-4" />
          Add to calendar
        </Button>
        <Link href={`/book/${slug}`} className="block">
          <Button variant="ghost" className="w-full">
            Book another appointment
          </Button>
        </Link>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Need to cancel? Use the link in your confirmation email.
      </p>
    </BookingShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <BookingShell>
          <p className="py-12 text-center text-muted-foreground">Loading…</p>
        </BookingShell>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
