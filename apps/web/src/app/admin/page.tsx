"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Tenant {
  name: string;
  slug: string;
  primaryColor: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  description: string;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/schedule", label: "Schedule & Branding", icon: "📋", description: "Working hours, breaks, timezone, logo" },
  { href: "/admin/services", label: "Services", icon: "⚙️", description: "Manage your bookable services" },
  { href: "/admin/bookings", label: "Bookings", icon: "📅", description: "View and manage appointments", comingSoon: true },
  { href: "/admin/staff", label: "Staff", icon: "👥", description: "Manage team members and roles", comingSoon: true },
];

const KPI_ITEMS = [
  { label: "Today's Bookings", value: "—" },
  { label: "This Week", value: "—" },
  { label: "Pending", value: "—" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const { accessToken, user, isLoading, logout } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!isLoading && !accessToken) router.push("/auth");
  }, [accessToken, isLoading, router]);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!accessToken || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-border px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{tenant?.name || "Admin Dashboard"}</h1>
          {tenant && (
            <p className="text-xs text-muted-foreground mt-0.5">/book/{tenant.slug}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-4">
          {KPI_ITEMS.map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-3xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Navigation grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NAV_ITEMS.map(({ href, label, icon, description, comingSoon }) =>
            comingSoon ? (
              <div
                key={href}
                className="bg-white rounded-lg border border-border p-5 opacity-50 cursor-default flex flex-col gap-1.5"
              >
                <span className="text-2xl">{icon}</span>
                <p className="font-semibold text-gray-900 text-sm">{label}</p>
                <p className="text-xs text-muted-foreground leading-snug">{description}</p>
                <Badge variant="secondary" className="w-fit mt-1 text-xs">Coming soon</Badge>
              </div>
            ) : (
              <Link
                key={href}
                href={href}
                className="bg-white rounded-lg border border-border p-5 flex flex-col gap-1.5 no-underline hover:shadow-sm transition-shadow"
              >
                <span className="text-2xl">{icon}</span>
                <p className="font-semibold text-gray-900 text-sm">{label}</p>
                <p className="text-xs text-muted-foreground leading-snug">{description}</p>
              </Link>
            )
          )}
        </div>

        {/* Role pill */}
        <Card>
          <CardContent className="py-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Signed in as</span>
            <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-0">
              {user.role}
            </Badge>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
