"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { createBooking, PublicApiError } from "@/lib/publicApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean }>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const slotsHref = `/book/${slug}/${serviceId}/slots?date=${date}`;

  const nameError = touched.name && !form.name.trim() ? "Please enter your name." : "";
  const emailError =
    touched.email && !emailRe.test(form.email.trim()) ? "Please enter a valid email address." : "";

  const submit = async () => {
    setTouched({ name: true, email: true });
    if (!form.name.trim()) return setError("Please enter your name.");
    if (!emailRe.test(form.email.trim())) return setError("Please enter a valid email address.");

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
        <p className="py-12 text-center text-muted-foreground">No time selected.</p>
      </BookingShell>
    );
  }

  return (
    <BookingShell tenant={tenant ?? undefined} step="Your details" backHref={slotsHref}>
      {/* Order summary */}
      <Card className="mb-5" size="sm">
        <CardContent className="space-y-2.5">
          {service && (
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{service.name}</span>
              <Badge variant="secondary" className="gap-1">
                <ClockIcon className="size-3" />
                {service.durationMinutes} min
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="size-4" />
            {formatHumanDate(date)} · {time}
          </div>
          {service && service.price > 0 && (
            <div className="flex items-center justify-between border-t border-border pt-2.5 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold text-foreground">₹{service.price.toFixed(0)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4 border-destructive/30 bg-destructive/5">
          <AlertDescription className="text-destructive/90">{error}</AlertDescription>
        </Alert>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            placeholder="Your full name"
            aria-invalid={!!nameError}
            autoFocus
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="you@example.com"
            aria-invalid={!!emailError}
          />
          {emailError ? (
            <p className="text-xs text-destructive">{emailError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">We&apos;ll send your confirmation here.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone number"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Anything we should know?"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Booking…
            </>
          ) : (
            "Confirm booking"
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You can cancel anytime from your confirmation email.
        </p>
      </form>
    </BookingShell>
  );
}

export default function DetailsPage() {
  return (
    <Suspense
      fallback={
        <BookingShell>
          <p className="py-12 text-center text-muted-foreground">Loading…</p>
        </BookingShell>
      }
    >
      <DetailsContent />
    </Suspense>
  );
}
