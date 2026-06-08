"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDaysIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  CalendarClockIcon,
  CalendarCheck2Icon,
  ClockIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "./_components/AdminShell";

interface Stats {
  today: number;
  thisWeek: number;
  pending: number;
}

const KPIS = [
  { key: "today" as const, label: "Today's bookings", icon: CalendarClockIcon, tone: "text-info" },
  { key: "thisWeek" as const, label: "This week", icon: CalendarCheck2Icon, tone: "text-primary" },
  { key: "pending" as const, label: "Awaiting confirmation", icon: ClockIcon, tone: "text-warning-foreground" },
];

type Role = "OWNER" | "ADMIN" | "STAFF";

// `roles` mirrors the AdminShell nav + API guards: STAFF sees only bookings,
// Services/Schedule are OWNER+ADMIN, and Staff management is OWNER only.
const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof CalendarDaysIcon;
  description: string;
  roles: Role[];
}[] = [
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDaysIcon, description: "View and manage appointments", roles: ["OWNER", "ADMIN", "STAFF"] },
  { href: "/admin/services", label: "Services", icon: SettingsIcon, description: "Your bookable services and pricing", roles: ["OWNER", "ADMIN"] },
  { href: "/admin/schedule", label: "Schedule & Branding", icon: SlidersHorizontalIcon, description: "Hours, breaks, timezone, logo", roles: ["OWNER", "ADMIN"] },
  { href: "/admin/staff", label: "Staff", icon: UsersIcon, description: "Team members and roles", roles: ["OWNER"] },
];

export default function AdminDashboard() {
  const { accessToken, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    api.get("/admin/stats").then((res) => setStats(res.data.data)).catch(() => null);
  }, [accessToken]);

  return (
    <AdminShell active="dashboard" title="Dashboard">
      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {KPIS.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key}>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                {stats ? (
                  <p className="font-heading text-3xl font-semibold text-foreground">{stats[key]}</p>
                ) : (
                  <Skeleton className="h-9 w-12" />
                )}
              </div>
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Icon className={`size-5 ${tone}`} />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation grid — only the sections this role can access */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {NAV_ITEMS.filter(({ roles }) => !user || roles.includes(user.role as Role)).map(
          ({ href, label, icon: Icon, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <ChevronRightIcon className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          )
        )}
      </div>

      {/* Role pill */}
      {user && (
        <p className="mt-6 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
          <Badge variant="info" className="ml-2">{user.role}</Badge>
        </p>
      )}
    </AdminShell>
  );
}
