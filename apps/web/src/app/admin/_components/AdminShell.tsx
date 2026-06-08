"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  LogOutIcon,
  CalendarCheckIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminSection = "dashboard" | "bookings" | "services" | "schedule" | "staff";
type Role = "OWNER" | "ADMIN" | "STAFF";

interface TenantInfo {
  name: string;
  slug: string;
  primaryColor?: string;
}

// `roles` is the allow-list that can see each section. STAFF is intentionally
// limited to the dashboard and bookings; Services/Schedule are OWNER+ADMIN and
// Staff management is OWNER only — mirroring the API's requireRole guards.
const NAV: { id: AdminSection; href: string; label: string; icon: typeof LayoutDashboardIcon; roles: Role[] }[] = [
  { id: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon, roles: ["OWNER", "ADMIN", "STAFF"] },
  { id: "bookings", href: "/admin/bookings", label: "Bookings", icon: CalendarDaysIcon, roles: ["OWNER", "ADMIN", "STAFF"] },
  { id: "services", href: "/admin/services", label: "Services", icon: SettingsIcon, roles: ["OWNER", "ADMIN"] },
  { id: "schedule", href: "/admin/schedule", label: "Schedule", icon: SlidersHorizontalIcon, roles: ["OWNER", "ADMIN"] },
  { id: "staff", href: "/admin/staff", label: "Staff", icon: UsersIcon, roles: ["OWNER"] },
];

interface AdminShellProps {
  active: AdminSection;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  /**
   * Roles allowed to view this page. If the signed-in user's role isn't listed,
   * they're redirected to the dashboard. The API enforces this server-side too;
   * this just avoids rendering a page that would only 403.
   */
  allow?: Role[];
}

/**
 * Shared chrome for every /admin page: auth gate, branded top bar, and a
 * horizontal section nav. Pages render only their content inside.
 */
export function AdminShell({ active, title, actions, children, allow }: AdminShellProps) {
  const router = useRouter();
  const { accessToken, user, isLoading, logout } = useAuth();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  useEffect(() => {
    if (!isLoading && !accessToken) router.push("/auth");
  }, [accessToken, isLoading, router]);

  // Role gate: bounce a user who lacks access to this page back to the dashboard.
  useEffect(() => {
    if (!isLoading && user && allow && !allow.includes(user.role as Role)) {
      router.replace("/admin");
    }
  }, [isLoading, user, allow, router]);

  useEffect(() => {
    if (!accessToken) return;
    api.get("/admin/tenant").then((res) => setTenant(res.data.data)).catch(() => null);
  }, [accessToken]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/auth");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <span className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }
  if (!accessToken || !user) return null;
  // Don't flash a page the user will be redirected away from.
  if (allow && !allow.includes(user.role as Role)) return null;

  const role = user.role as Role;
  const navItems = NAV.filter((item) => item.roles.includes(role));
  const accent = tenant?.primaryColor ?? "#4F46E5";

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {tenant ? tenant.name.charAt(0).toUpperCase() : <CalendarCheckIcon className="size-4" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                {tenant?.name ?? "Admin"}
              </span>
              {tenant && (
                <span className="block truncate text-xs text-muted-foreground">/book/{tenant.slug}</span>
              )}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOutIcon className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Section nav */}
        <nav className="mx-auto max-w-6xl px-2 sm:px-4">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {navItems.map(({ id, href, label, icon: Icon }) => {
              const isActive = id === active;
              return (
                <li key={id}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                      isActive
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {(title || actions) && (
          <div className="mb-5 flex items-center justify-between gap-3">
            {title && (
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            )}
            {actions}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
