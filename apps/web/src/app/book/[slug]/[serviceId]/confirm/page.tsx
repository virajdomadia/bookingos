"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { CreatedBooking, PublicTenant } from "@/lib/publicApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingShell } from "../../../_components/BookingShell";

/** Format an ISO instant in the given IANA timezone as a friendly date + time. */
function formatInstant(iso: string, timezone: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return parts;
}

function ConfirmContent() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

  const [data, setData] = useState<{ booking: CreatedBooking; tenant: PublicTenant | null } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) {
      setMissing(true);
      return;
    }
    const raw = sessionStorage.getItem(`booking:${id}`);
    if (!raw) {
      setMissing(true);
      return;
    }
    try {
      setData(JSON.parse(raw));
    } catch {
      setMissing(true);
    }
  }, [id]);

  if (missing || !data) {
    return (
      <BookingShell>
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
            ✓
          </div>
          <h1 className="text-xl font-bold text-gray-900">Booking confirmed</h1>
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
  // Render the instant in the tenant's own timezone so the time matches what the
  // customer picked, regardless of the device's locale.
  const timezone = tenant?.timezone ?? "Asia/Kolkata";

  return (
    <BookingShell tenant={tenant ?? undefined}>
      <div className="py-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
          ✓
        </div>
        <h1 className="text-xl font-bold text-gray-900">You&apos;re booked!</h1>
        <p className="mt-1 text-muted-foreground">A confirmation has been sent to {booking.customerEmail}.</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <Row label="Service" value={booking.service.name} />
          <Row label="When" value={formatInstant(booking.startsAt, timezone)} />
          <Row label="Duration" value={`${booking.service.durationMinutes} min`} />
          <Row label="Name" value={booking.customerName} />
          <Row
            label="Status"
            value={
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Awaiting confirmation
              </span>
            }
          />
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Need to cancel? Use the link in your confirmation email.
      </p>

      <Link href={`/book/${slug}`} className="mt-6 block">
        <Button variant="outline" className="w-full">
          Book another appointment
        </Button>
      </Link>
    </BookingShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<BookingShell><p className="text-center text-muted-foreground py-12">Loading…</p></BookingShell>}>
      <ConfirmContent />
    </Suspense>
  );
}
