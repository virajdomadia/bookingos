"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

interface User {
  userId: string;
  email: string;
  role: string;
}

interface AuthContextType {
  accessToken: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (tenantName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAccessToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Issue #5: Schedule refresh before token expires
  const scheduleTokenRefresh = (expiresInSeconds: number) => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Refresh 5 minutes before expiry (or at 1 minute if token is shorter)
    const refreshBeforeExpiry = Math.max(expiresInSeconds - 5 * 60, 1 * 60);
    const refreshDelayMs = refreshBeforeExpiry * 1000;

    refreshTimerRef.current = setTimeout(() => {
      silentRefresh();
    }, refreshDelayMs);
  };

  // Silent refresh on mount
  useEffect(() => {
    silentRefresh();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const silentRefresh = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        const { accessToken, expiresIn } = await response.json();
        setAccessToken(accessToken);
        // Issue #5: Schedule next refresh
        if (expiresIn) {
          scheduleTokenRefresh(expiresIn);
        }
      } else {
        setAccessToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error("Silent refresh failed:", error);
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

      const { accessToken, user } = await response.json();
      setAccessToken(accessToken);
      setUser(user);
      // Issue #5: Schedule refresh
      scheduleTokenRefresh(15 * 60); // 15-minute access token
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    tenantName: string,
    email: string,
    password: string
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantName, email, password }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      const { accessToken, user } = await response.json();
      setAccessToken(accessToken);
      setUser(user);
      // Issue #5: Schedule refresh
      scheduleTokenRefresh(15 * 60); // 15-minute access token
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setAccessToken(null);
      setUser(null);
      // Clear any pending refresh
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        user,
        isLoading,
        login,
        register,
        logout,
        setAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
