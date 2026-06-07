import Link from "next/link";
import {
  CalendarCheckIcon,
  ArrowRightIcon,
  ClockIcon,
  ShieldCheckIcon,
  BellIcon,
  PaletteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: ClockIcon, title: "Smart availability", body: "Slots generated from your hours, breaks, and service durations — no manual juggling." },
  { icon: ShieldCheckIcon, title: "No double bookings", body: "Concurrent attempts on the same slot are locked at the database level." },
  { icon: BellIcon, title: "Automatic emails", body: "Confirmations, reminders, and cancellations sent without you lifting a finger." },
  { icon: PaletteIcon, title: "Your brand", body: "Your logo and colors on a booking page that feels like part of your business." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheckIcon className="size-5" />
          </span>
          BookingOS
        </div>
        <Link href="/auth">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 pb-16 pt-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" />
          Built for salons, clinics &amp; studios
        </span>
        <h1 className="mt-6 font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Appointment booking that{" "}
          <span className="text-primary">runs itself.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Share one link. Customers pick a time, you get the booking, and everyone gets the email.
          No back-and-forth, no double bookings.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/auth">
            <Button size="lg" className="w-full sm:w-auto">
              Get started free
              <ArrowRightIcon className="size-4" />
            </Button>
          </Link>
          <Link href="/auth">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-5 pb-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md"
            >
              <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <h3 className="font-heading font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} BookingOS</span>
          <span>White-label appointment booking platform</span>
        </div>
      </footer>
    </main>
  );
}
