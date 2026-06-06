"use client";

import { useEffect, useState } from "react";
import {
  getBookingPage,
  PublicApiError,
  type PublicService,
  type PublicTenant,
} from "@/lib/publicApi";

interface BookingContext {
  tenant: PublicTenant | null;
  service: PublicService | null;
  loading: boolean;
  /** True when the slug exists but the requested service does not. */
  serviceNotFound: boolean;
  error: string;
}

const cacheKey = (slug: string) => `bookingPage:${slug}`;

/**
 * Loads the tenant branding and (optionally) resolves a specific service for
 * the current step. The booking-page payload is cached in sessionStorage for
 * the slug so navigating between steps doesn't refetch or flash a loading state.
 */
export function useBookingContext(slug: string | undefined, serviceId?: string): BookingContext {
  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [services, setServices] = useState<PublicService[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;

    const cached = typeof window !== "undefined" ? sessionStorage.getItem(cacheKey(slug)) : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { tenant: PublicTenant; services: PublicService[] };
        setTenant(parsed.tenant);
        setServices(parsed.services);
        setLoading(false);
      } catch {
        sessionStorage.removeItem(cacheKey(slug));
      }
    }

    (async () => {
      try {
        const data = await getBookingPage(slug);
        if (!active) return;
        setTenant(data.tenant);
        setServices(data.services);
        sessionStorage.setItem(cacheKey(slug), JSON.stringify(data));
      } catch (e) {
        if (!active) return;
        if (!cached) {
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

  const service = serviceId && services ? services.find((s) => s.id === serviceId) ?? null : null;
  const serviceNotFound = Boolean(serviceId && services !== null && service === null);

  return { tenant, service, loading, serviceNotFound, error };
}
