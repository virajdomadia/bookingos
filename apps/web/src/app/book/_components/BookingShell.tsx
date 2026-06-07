"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "lucide-react";
import type { PublicTenant } from "@/lib/publicApi";

interface BookingShellProps {
  tenant?: PublicTenant;
  /** Short label for the current step, e.g. "Pick a date". */
  step?: string;
  /** When set, renders a "‹ Back" link to this href. */
  backHref?: string;
  children: ReactNode;
}

/**
 * Mobile-first chrome shared by every step of the public booking flow: a
 * tenant-branded header, an optional back link, and a narrow centered column.
 */
export function BookingShell({ tenant, step, backHref, children }: BookingShellProps) {
  const accent = tenant?.primaryColor ?? "#4F46E5";

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="h-1 w-full" style={{ backgroundColor: accent }} />
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3.5">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="size-9 rounded-lg object-cover ring-1 ring-border"
            />
          ) : (
            <div
              className="flex size-9 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              {(tenant?.name ?? "B").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading font-semibold leading-tight text-foreground">
              {tenant?.name ?? "Book an appointment"}
            </p>
            {step && (
              <p className="truncate text-xs font-medium text-muted-foreground">{step}</p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        {backHref && (
          <Link
            href={backHref}
            className="mb-4 -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" />
            Back
          </Link>
        )}
        <div className="animate-fade-in">{children}</div>
      </main>

      <footer className="mx-auto w-full max-w-md px-4 pb-6">
        <p className="text-center text-xs text-muted-foreground/70">
          Powered by <span className="font-medium text-muted-foreground">BookingOS</span>
        </p>
      </footer>
    </div>
  );
}
