"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createBooking, PublicApiError } from "@/lib/publicApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookingShell } from "../../../_components/BookingShell";
import { useBookingContext } from "../../../_components/useBookingContext";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHumanDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS_SHORT[dow]}, ${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function DetailsContent() {
  const router = useRouter();
  const { slug, serviceId } = useParams<{ slug: string; serviceId: string }>();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? "";
  const time = searchParams.get("time") ?? "";

  const { tenant, service } = useBookingContext(slug, serviceId);

  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const slotsHref = `/book/${slug}/${serviceId}/slots?date=${date}`;

  const validate = (): string | null => {
    if (!form.name.trim()) return "Please enter your name.";
    if (!emailRe.test(form.email.trim())) return "Please enter a valid email address.";
    return null;
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const booking = await createBooking(slug, {
        serviceId,
        date,
        time,
        customerName: form.name.trim(),
        customerEmail: form.email.trim(),
        customerPhone: form.phone.trim() || undefined,
        customerNotes: form.notes.trim() || undefined,
      });
      sessionStorage.setItem(`booking:${booking.id}`, JSON.stringify({ booking, tenant }));
      router.push(`/book/${slug}/${serviceId}/confirm?id=${booking.id}`);
    } catch (e) {
      if (e instanceof PublicApiError && e.status === 409) {
        // The slot was taken between loading it and submitting — send the
        // customer back to a freshly-loaded slot grid.
        sessionStorage.setItem("bookingNotice", "That time was just taken. Please choose another.");
        router.push(slotsHref);
        return;
      }
      setError(
        e instanceof PublicApiError ? e.message : "Couldn't complete your booking. Please try again."
      );
      setSubmitting(false);
    }
  };

  if (!date || !time) {
    return (
      <BookingShell tenant={tenant ?? undefined} backHref={`/book/${slug}/${serviceId}/date`}>
        <p className="text-center text-muted-foreground py-12">No time selected.</p>
      </BookingShell>
    );
  }

  return (
    <BookingShell tenant={tenant ?? undefined} step="Your details" backHref={slotsHref}>
      <Card className="mb-4">
        <CardContent className="space-y-1 p-4">
          {service && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{service.name}</span>
              <Badge variant="secondary">{service.durationMinutes} min</Badge>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {formatHumanDate(date)} at {time}
          </p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Your full name"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email *</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Phone (optional)</Label>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone number"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Anything we should know?"
          />
        </div>

        <Button className="w-full" onClick={submit} disabled={submitting}>
          {submitting ? "Booking…" : "Confirm booking"}
        </Button>
      </div>
    </BookingShell>
  );
}

export default function DetailsPage() {
  return (
    <Suspense fallback={<BookingShell><p className="text-center text-muted-foreground py-12">Loading…</p></BookingShell>}>
      <DetailsContent />
    </Suspense>
  );
}
