"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarX2Icon, CheckIcon, AlertTriangleIcon } from "lucide-react";
import {
  getCancelInfo,
  cancelBooking,
  PublicApiError,
  type CancelInfo,
} from "@/lib/publicApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookingShell } from "../../../book/_components/BookingShell";

/** Format an ISO instant in the given IANA timezone as a friendly date + time. */
function formatInstant(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

type View = "loading" | "error" | "ready" | "cancelled";

export default function CancelPage() {
  const { slug, token } = useParams<{ slug: string; token: string }>();

  const [info, setInfo] = useState<CancelInfo | null>(null);
  const [view, setView] = useState<View>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slug || !token) return;
    let active = true;
    (async () => {
      try {
        const data = await getCancelInfo(slug, token);
        if (!active) return;
        setInfo(data);
        setView(data.alreadyCancelled ? "cancelled" : "ready");
      } catch (e) {
        if (!active) return;
        setErrorMsg(
          e instanceof PublicApiError && e.status === 404
            ? "This cancellation link is invalid or has expired."
            : "Couldn't load this booking. Please try again."
        );
        setView("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, token]);

  const handleCancel = async () => {
    setSubmitting(true);
    setActionError("");
    try {
      const res = await cancelBooking(slug, token);
      if (res.cancelled || res.alreadyCancelled) {
        setView("cancelled");
      }
    } catch (e) {
      if (e instanceof PublicApiError && e.status === 409) {
        setActionError("This booking can no longer be cancelled.");
      } else {
        setActionError(
          e instanceof PublicApiError ? e.message : "Couldn't cancel your booking. Please try again."
        );
      }
      setSubmitting(false);
    }
  };

  const tenant = info?.tenant;

  if (view === "loading") {
    return (
      <BookingShell>
        <p className="py-16 text-center text-muted-foreground">Loading…</p>
      </BookingShell>
    );
  }

  if (view === "error") {
    return (
      <BookingShell tenant={tenant ?? undefined}>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarX2Icon className="size-6" />
          </div>
          <p className="font-medium text-foreground">{errorMsg}</p>
        </div>
      </BookingShell>
    );
  }

  if (view === "cancelled") {
    return (
      <BookingShell tenant={tenant ?? undefined}>
        <div className="py-10 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground ring-8 ring-muted/30">
            <CheckIcon className="size-8" strokeWidth={3} />
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">Booking cancelled</h1>
          <p className="mt-2 text-muted-foreground">
            Your booking has been cancelled. A confirmation has been emailed to you.
          </p>
          {tenant && (
            <Link href={`/book/${tenant.slug}`} className="mt-6 inline-block">
              <Button variant="outline">Book a new appointment</Button>
            </Link>
          )}
        </div>
      </BookingShell>
    );
  }

  // view === "ready"
  const booking = info!.booking;
  const timezone = tenant?.timezone ?? "Asia/Kolkata";

  return (
    <BookingShell tenant={tenant ?? undefined} step="Cancel booking">
      <div className="mb-5">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Cancel this booking?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before cancelling.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 text-sm">
          <Row label="Service" value={booking.service.name} />
          <Row label="When" value={formatInstant(booking.startsAt, timezone)} />
          <Row label="Duration" value={`${booking.service.durationMinutes} min`} />
          <Row label="Name" value={booking.customerName} />
        </CardContent>
      </Card>

      {actionError && (
        <Alert variant="destructive" className="mt-4 border-destructive/30 bg-destructive/5">
          <AlertDescription className="text-destructive/90">{actionError}</AlertDescription>
        </Alert>
      )}

      {info!.canCancel ? (
        <div className="mt-5 space-y-2.5">
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={submitting}
            onClick={handleCancel}
          >
            {submitting ? "Cancelling…" : "Yes, cancel this booking"}
          </Button>
          {tenant && (
            <Link href={`/book/${tenant.slug}`} className="block">
              <Button variant="ghost" className="w-full">
                Keep my booking
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <Alert className="mt-5 border-warning/30 bg-warning/10">
          <AlertDescription className="flex items-center gap-2 text-warning-foreground">
            <AlertTriangleIcon className="size-4 shrink-0" />
            This booking can no longer be cancelled online. Please contact{" "}
            {tenant?.name ?? "the business"} directly.
          </AlertDescription>
        </Alert>
      )}
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
