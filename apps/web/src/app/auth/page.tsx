"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthPage() {
  const router = useRouter();
  const { login, register, isLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    tenantName: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await login(formData.email, formData.password);
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.tenantName) {
      setError("Tenant name is required");
      return;
    }

    try {
      await register(formData.tenantName, formData.email, formData.password);
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
  };

  const styles = {
    container: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f3f4f6",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    box: {
      backgroundColor: "white",
      padding: "2rem",
      borderRadius: "0.5rem",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      width: "100%",
      maxWidth: "400px",
    },
    title: {
      fontSize: "1.875rem",
      fontWeight: "bold",
      marginBottom: "0.5rem",
      textAlign: "center" as const,
    },
    subtitle: {
      color: "#6b7280",
      marginBottom: "2rem",
      textAlign: "center" as const,
      fontSize: "0.875rem",
    },
    formGroup: {
      marginBottom: "1rem",
    },
    label: {
      display: "block",
      fontSize: "0.875rem",
      fontWeight: "500",
      marginBottom: "0.5rem",
      color: "#111827",
    },
    input: {
      width: "100%",
      padding: "0.5rem",
      border: "1px solid #d1d5db",
      borderRadius: "0.375rem",
      fontSize: "1rem",
      boxSizing: "border-box" as const,
    },
    button: {
      width: "100%",
      padding: "0.5rem",
      backgroundColor: "#3b82f6",
      color: "white",
      border: "none",
      borderRadius: "0.375rem",
      fontSize: "1rem",
      fontWeight: "500",
      cursor: "pointer",
      marginTop: "1rem",
    },
    error: {
      backgroundColor: "#fee2e2",
      border: "1px solid #fecaca",
      color: "#991b1b",
      padding: "0.75rem",
      borderRadius: "0.375rem",
      marginBottom: "1rem",
      fontSize: "0.875rem",
    },
    toggle: {
      textAlign: "center" as const,
      marginTop: "1rem",
      fontSize: "0.875rem",
    },
    toggleLink: {
      color: "#3b82f6",
      cursor: "pointer",
      textDecoration: "underline",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h1 style={styles.title}>BookingOS</h1>
        <p style={styles.subtitle}>
          {mode === "login"
            ? "Sign in to your account"
            : "Create a new account"}
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
          {mode === "register" && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Business Name</label>
              <input
                style={styles.input}
                type="text"
                name="tenantName"
                placeholder="e.g., My Salon"
                value={formData.tenantName}
                onChange={handleInputChange}
                required
              />
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
            {mode === "register" && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  marginTop: "0.25rem",
                }}
              >
                Min 8 characters, 1 uppercase, 1 number
              </p>
            )}
          </div>

          <button
            style={{
              ...styles.button,
              opacity: isLoading ? 0.5 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
            disabled={isLoading}
          >
            {isLoading
              ? "Loading..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        <div style={styles.toggle}>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <span
                style={styles.toggleLink}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Sign up
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span
                style={styles.toggleLink}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
