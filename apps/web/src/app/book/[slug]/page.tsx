"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getBookingPage, PublicApiError, type BookingPage } from "@/lib/publicApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <BookingShell>
        <p className="text-center text-muted-foreground py-12">Loading…</p>
      </BookingShell>
    );
  }

  if (error || !page) {
    return (
      <BookingShell>
        <p className="text-center text-muted-foreground py-12">{error || "Not found."}</p>
      </BookingShell>
    );
  }

  return (
    <BookingShell tenant={page.tenant} step="Choose a service">
      {page.services.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No services are available to book right now.
        </p>
      ) : (
        <div className="space-y-3">
          {page.services.map((service) => (
            <Card
              key={service.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/book/${slug}/${service.id}/date`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") router.push(`/book/${slug}/${service.id}/date`);
              }}
              className="cursor-pointer transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-1.5">
                  <p className="font-semibold text-gray-900">{service.name}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge variant="secondary">{service.durationMinutes} min</Badge>
                    {service.price > 0 && <Badge variant="secondary">₹{service.price.toFixed(0)}</Badge>}
                  </div>
                </div>
                <span aria-hidden className="text-muted-foreground text-xl">›</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </BookingShell>
  );
}
