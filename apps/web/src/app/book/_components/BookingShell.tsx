"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-border bg-white" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {(tenant?.name ?? "B").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{tenant?.name ?? "Book an appointment"}</p>
            {step && <p className="text-xs text-muted-foreground">{step}</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {backHref && (
          <Link href={backHref} className="mb-4 inline-block text-sm text-primary hover:underline">
            ‹ Back
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
