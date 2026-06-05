"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

interface Tenant {
  name: string;
  slug: string;
  primaryColor: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { accessToken, user, isLoading, logout } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!isLoading && !accessToken) {
      router.push("/auth");
    }
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
      <div style={s.container}>
        <div style={{ textAlign: "center", paddingTop: "6rem", color: "#6b7280" }}>Loading...</div>
      </div>
    );
  }

  if (!accessToken || !user) return null;

  const navItems = [
    { href: "/admin/schedule", label: "Schedule & Branding", icon: "📋", description: "Working hours, breaks, timezone, logo" },
    { href: "/admin/services", label: "Services", icon: "⚙️", description: "Manage your bookable services" },
    { href: "/admin/bookings", label: "Bookings", icon: "📅", description: "View and manage appointments", comingSoon: true },
    { href: "/admin/staff", label: "Staff", icon: "👥", description: "Manage team members and roles", comingSoon: true },
  ];

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{tenant?.name || "Admin Dashboard"}</h1>
          {tenant && <span style={s.slugBadge}>/book/{tenant.slug}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={s.emailBadge}>{user.email}</span>
          <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={s.content}>
        {/* KPI placeholder */}
        <div style={s.kpiRow}>
          {[
            { label: "Today's Bookings", value: "—" },
            { label: "This Week", value: "—" },
            { label: "Pending", value: "—" },
          ].map(({ label, value }) => (
            <div key={label} style={s.kpiCard}>
              <div style={s.kpiValue}>{value}</div>
              <div style={s.kpiLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* Nav Grid */}
        <div style={s.navGrid}>
          {navItems.map(({ href, label, icon, description, comingSoon }) =>
            comingSoon ? (
              <div key={href} style={{ ...s.navCard, ...s.navCardDisabled }}>
                <div style={s.navIcon}>{icon}</div>
                <div style={s.navLabel}>{label}</div>
                <div style={s.navDesc}>{description}</div>
                <span style={s.comingSoonBadge}>Coming soon</span>
              </div>
            ) : (
              <Link key={href} href={href} style={{ ...s.navCard, textDecoration: "none" }}>
                <div style={s.navIcon}>{icon}</div>
                <div style={s.navLabel}>{label}</div>
                <div style={s.navDesc}>{description}</div>
              </Link>
            )
          )}
        </div>

        {/* Role info */}
        <div style={s.roleCard}>
          <span style={s.roleLabel}>Signed in as</span>
          <span style={s.roleBadge}>{user.role}</span>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "system-ui, -apple-system, sans-serif" },
  header: { backgroundColor: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: "1.25rem", fontWeight: "bold", margin: 0 },
  slugBadge: { fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem", display: "block" },
  emailBadge: { fontSize: "0.8125rem", color: "#6b7280" },
  logoutBtn: { padding: "0.375rem 0.875rem", backgroundColor: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500" },
  content: { padding: "1.5rem", maxWidth: "900px", margin: "0 auto" },
  kpiRow: { display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" },
  kpiCard: { flex: 1, minWidth: "120px", backgroundColor: "white", padding: "1.25rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", textAlign: "center" },
  kpiValue: { fontSize: "1.875rem", fontWeight: "bold", color: "#111827" },
  kpiLabel: { fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" },
  navGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1rem" },
  navCard: { backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", cursor: "pointer", transition: "box-shadow 0.15s", color: "inherit", display: "flex", flexDirection: "column", gap: "0.375rem" },
  navCardDisabled: { opacity: 0.5, cursor: "default" },
  navIcon: { fontSize: "1.5rem" },
  navLabel: { fontWeight: "600", fontSize: "0.9375rem", color: "#111827" },
  navDesc: { fontSize: "0.8125rem", color: "#6b7280", lineHeight: 1.4 },
  comingSoonBadge: { marginTop: "0.5rem", fontSize: "0.6875rem", backgroundColor: "#f3f4f6", color: "#9ca3af", padding: "0.125rem 0.5rem", borderRadius: "999px", alignSelf: "flex-start", border: "1px solid #e5e7eb" },
  roleCard: { backgroundColor: "white", padding: "0.875rem 1.25rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: "0.5rem" },
  roleLabel: { fontSize: "0.8125rem", color: "#6b7280" },
  roleBadge: { fontSize: "0.75rem", backgroundColor: "#ede9fe", color: "#6d28d9", padding: "0.125rem 0.625rem", borderRadius: "999px", fontWeight: "600" },
};
