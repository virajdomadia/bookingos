"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AdminDashboard() {
  const router = useRouter();
  const { accessToken, user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !accessToken) {
      router.push("/auth");
    }
  }, [accessToken, isLoading, router]);

  if (isLoading) {
    return <div style={{ padding: "2rem" }}>Loading...</div>;
  }

  if (!accessToken || !user) {
    return null; // Will redirect via useEffect
  }

  const styles = {
    container: {
      minHeight: "100vh",
      backgroundColor: "#f3f4f6",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    header: {
      backgroundColor: "white",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      padding: "1.5rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontSize: "1.5rem",
      fontWeight: "bold",
    },
    button: {
      padding: "0.5rem 1rem",
      backgroundColor: "#ef4444",
      color: "white",
      border: "none",
      borderRadius: "0.375rem",
      cursor: "pointer",
      fontSize: "0.875rem",
      fontWeight: "500",
    },
    content: {
      padding: "2rem",
      maxWidth: "1200px",
      margin: "0 auto",
    },
    card: {
      backgroundColor: "white",
      padding: "1.5rem",
      borderRadius: "0.5rem",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      marginBottom: "1.5rem",
    },
    userInfo: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "1rem",
      marginBottom: "1.5rem",
    },
    infoItem: {
      backgroundColor: "#f9fafb",
      padding: "1rem",
      borderRadius: "0.375rem",
      borderLeft: "4px solid #3b82f6",
    },
    label: {
      fontSize: "0.75rem",
      textTransform: "uppercase" as const,
      color: "#6b7280",
      fontWeight: "bold",
      marginBottom: "0.25rem",
    },
    value: {
      fontSize: "1rem",
      color: "#111827",
      fontWeight: "500",
    },
    nav: {
      display: "flex",
      gap: "1rem",
      marginTop: "1.5rem",
      flexWrap: "wrap" as const,
    },
    navLink: {
      padding: "0.75rem 1.5rem",
      backgroundColor: "#3b82f6",
      color: "white",
      border: "none",
      borderRadius: "0.375rem",
      cursor: "pointer",
      fontSize: "0.875rem",
      fontWeight: "500",
    },
  };

  const handleLogout = async () => {
    await logout();
    router.push("/auth");
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>BookingOS Admin</h1>
        <button style={styles.button} onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>
            Welcome, {user.email}!
          </h2>
          <div style={styles.userInfo}>
            <div style={styles.infoItem}>
              <div style={styles.label}>Email</div>
              <div style={styles.value}>{user.email}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.label}>Role</div>
              <div style={styles.value}>{user.role}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.label}>Status</div>
              <div style={styles.value}>✓ Authenticated</div>
            </div>
          </div>

          <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
            Token: {accessToken.slice(0, 20)}...
          </p>

          <div style={styles.nav}>
            <button style={styles.navLink}>📅 Bookings</button>
            <button style={styles.navLink}>⚙️ Services</button>
            <button style={styles.navLink}>📋 Schedule</button>
            <button style={styles.navLink}>👥 Staff</button>
            <button style={styles.navLink}>🎨 Branding</button>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={{ marginBottom: "1rem", fontSize: "1.125rem" }}>
            F1: Auth Implementation Status
          </h3>
          <div style={{ color: "#6b7280", lineHeight: "1.6" }}>
            <p>✓ JWT token generation (15-min access + 7-day refresh)</p>
            <p>✓ httpOnly cookies for refresh token</p>
            <p>✓ Password hashing (bcrypt)</p>
            <p>✓ Auth middleware with RLS context</p>
            <p>✓ React AuthContext with silent refresh</p>
            <p>✓ Login/Register pages</p>
            <p>✓ Protected routes</p>
            <p style={{ marginTop: "1rem", fontWeight: "bold" }}>
              Demo: Try registering or logging in from /auth
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
