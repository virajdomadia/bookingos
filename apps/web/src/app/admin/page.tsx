"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DashboardLoadingSkeleton } from "@/components/LoadingSkeleton";

export default function AdminDashboard() {
  const router = useRouter();
  const { accessToken, user, isLoading, logout, error, clearError } = useAuth();

  useEffect(() => {
    if (!isLoading && !accessToken) {
      router.push("/auth");
    }
  }, [accessToken, isLoading, router]);

  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }

  if (!accessToken || !user) {
    return null; // Redirect is handled via useEffect
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/auth");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

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
      display: "flex" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    },
    title: {
      fontSize: "1.5rem",
      fontWeight: "bold" as const,
    },
    button: {
      padding: "0.5rem 1rem",
      backgroundColor: "#ef4444",
      color: "white",
      border: "none",
      borderRadius: "0.375rem",
      cursor: "pointer",
      fontSize: "0.875rem",
      fontWeight: "500" as const,
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
    errorAlert: {
      backgroundColor: "#fee2e2",
      border: "1px solid #fecaca",
      color: "#991b1b",
      padding: "1rem",
      borderRadius: "0.375rem",
      marginBottom: "1rem",
      fontSize: "0.875rem",
      display: "flex" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    },
    errorClose: {
      background: "none",
      border: "none",
      color: "#991b1b",
      cursor: "pointer",
      fontSize: "1.25rem",
      padding: 0,
    },
    userInfo: {
      display: "grid" as const,
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
      fontWeight: "bold" as const,
      marginBottom: "0.25rem",
    },
    value: {
      fontSize: "1rem",
      color: "#111827",
      fontWeight: "500" as const,
    },
    nav: {
      display: "flex" as const,
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
      fontWeight: "500" as const,
    },
    section: {
      marginTop: "1.5rem",
    },
    sectionTitle: {
      fontSize: "1.125rem",
      fontWeight: "bold" as const,
      marginBottom: "1rem",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📊 Admin Dashboard</h1>
        <button style={styles.button} onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>

      <div style={styles.content}>
        {/* Error Alert */}
        {error && (
          <div style={styles.errorAlert}>
            <div>
              <strong>⚠️ Notice:</strong> {error}
            </div>
            <button style={styles.errorClose} onClick={clearError}>
              ×
            </button>
          </div>
        )}

        {/* Welcome Card */}
        <div style={styles.card}>
          <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>
            👋 Welcome, {user.email}!
          </h2>
          <div style={styles.userInfo}>
            <div style={styles.infoItem}>
              <div style={styles.label}>User ID</div>
              <div style={styles.value}>{user.userId.slice(0, 8)}...</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.label}>Email</div>
              <div style={styles.value}>{user.email}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.label}>Role</div>
              <div style={styles.value}>👤 {user.role}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.label}>Status</div>
              <div style={styles.value}>✓ Authenticated</div>
            </div>
          </div>

          <div style={styles.nav}>
            <button style={styles.navLink}>📅 Bookings (Coming Soon)</button>
            <button style={styles.navLink}>⚙️ Services (Coming Soon)</button>
            <button style={styles.navLink}>📋 Schedule (Coming Soon)</button>
            <button style={styles.navLink}>👥 Staff (Coming Soon)</button>
            <button style={styles.navLink}>🎨 Branding (Coming Soon)</button>
          </div>
        </div>

        {/* Implementation Status */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>📈 Implementation Status</h3>

          <div style={{ color: "#6b7280", lineHeight: "1.8" }}>
            <h4 style={{ marginTop: 0, marginBottom: "0.75rem", color: "#374151" }}>
              ✅ Phase 1 Complete (F0 + F1)
            </h4>
            <ul style={{ marginLeft: "1.5rem" }}>
              <li>✓ Database schema and migrations</li>
              <li>✓ User authentication (register, login, refresh, logout)</li>
              <li>✓ JWT token management</li>
              <li>✓ httpOnly cookie security</li>
              <li>✓ Password hashing (bcrypt 12 rounds)</li>
              <li>✓ Rate limiting (5 attempts/15 min)</li>
              <li>✓ RLS multi-tenant isolation</li>
              <li>✓ Error handling & validation</li>
              <li>✓ Graceful shutdown handlers</li>
            </ul>

            <h4 style={{ marginTop: "1.5rem", marginBottom: "0.75rem", color: "#374151" }}>
              🔜 Phase 2 Roadmap (F2 + F3)
            </h4>
            <ul style={{ marginLeft: "1.5rem" }}>
              <li>Schedule management (GET/PUT endpoints)</li>
              <li>Service CRUD operations</li>
              <li>Admin dashboard features</li>
              <li>Form validation & real-time feedback</li>
              <li>Loading states & skeletons</li>
              <li>Error boundaries & recovery</li>
            </ul>

            <h4 style={{ marginTop: "1.5rem", marginBottom: "0.75rem", color: "#374151" }}>
              🌟 Quality Improvements
            </h4>
            <ul style={{ marginLeft: "1.5rem" }}>
              <li>✓ Comprehensive error handling</li>
              <li>✓ Standardized API responses</li>
              <li>✓ Strong password validation</li>
              <li>✓ Email normalization</li>
              <li>✓ Slug sanitization</li>
              <li>✓ Silent token refresh with retry</li>
              <li>✓ Network failure recovery</li>
              <li>✓ Loading skeletons</li>
              <li>✓ Error boundaries</li>
            </ul>
          </div>
        </div>

        {/* Next Steps */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>🚀 Next Steps</h3>
          <p style={{ color: "#6b7280", lineHeight: "1.6" }}>
            The foundation is solid! Phase 2 will introduce schedule and service management. The auth
            system is now production-ready with:
          </p>
          <ul style={{ color: "#6b7280", marginLeft: "1.5rem" }}>
            <li>Robust error handling and recovery</li>
            <li>Network resilience with automatic retries</li>
            <li>User-friendly error messages</li>
            <li>Graceful degradation</li>
            <li>Full TypeScript type safety</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
