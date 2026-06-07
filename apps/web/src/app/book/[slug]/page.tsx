"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClockIcon, ChevronRightIcon, CalendarX2Icon } from "lucide-react";
import { getBookingPage, PublicApiError, type BookingPage } from "@/lib/publicApi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingShell } from "../_components/BookingShell";

export default function ServiceListPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const [page, setPage] = useState<BookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    (async () => {
      try {
        const data = await getBookingPage(slug);
        if (active) setPage(data);
      } catch (e) {
        if (active) {
          setError(
            e instanceof PublicApiError && e.status === 404
              ? "This booking page doesn't exist."
              : "Couldn't load this booking page. Please try again."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <BookingShell step="Choose a service">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
          ))}
        </div>
      </BookingShell>
    );
  }

  if (error || !page) {
    return (
      <BookingShell>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarX2Icon className="size-6" />
          </div>
          <p className="font-medium text-foreground">{error || "Not found."}</p>
        </div>
      </BookingShell>
    );
  }

  const accent = page.tenant?.primaryColor ?? "#4F46E5";

  return (
    <BookingShell tenant={page.tenant} step="Choose a service">
      {page.services.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarX2Icon className="size-6" />
          </div>
          <p className="font-medium text-foreground">Nothing to book yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            This business hasn&apos;t published any services. Please check back soon.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {page.services.map((service) => (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => router.push(`/book/${slug}/${service.id}/date`)}
                className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-base font-semibold text-white"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                >
                  {service.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate font-medium text-foreground">{service.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="gap-1">
                      <ClockIcon className="size-3" />
                      {service.durationMinutes} min
                    </Badge>
                    {service.price > 0 && (
                      <Badge variant="secondary">₹{service.price.toFixed(0)}</Badge>
                    )}
                  </div>
                </div>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </BookingShell>
  );
}
