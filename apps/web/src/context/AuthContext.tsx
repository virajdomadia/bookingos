"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { setApiAccessToken, registerAuthHandlers } from "@/lib/api";

interface User {
  userId: string;
  email: string;
  role: string;
}

/**
 * Decode the user claims from a JWT access token without verifying the
 * signature (the server is the source of truth; this is only used to populate
 * UI state after a silent refresh, which does not return the user object).
 */
function decodeUserFromToken(token: string): User | null {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const json = atob(payloadSegment.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    if (!payload.userId || !payload.role) return null;
    return {
      userId: payload.userId,
      email: payload.email ?? "",
      role: payload.role,
    };
  } catch {
    return null;
  }
}

interface AuthContextType {
  accessToken: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setAccessToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshAttempt = useRef<number>(0);
  const refreshRetryCount = useRef<number>(0);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const scheduleTokenRefresh = useCallback((expiresInSeconds: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Refresh 5 minutes before expiry (or 1 minute if token is shorter)
    const refreshBeforeExpiry = Math.max(expiresInSeconds - 5 * 60, 1 * 60);
    const refreshDelayMs = refreshBeforeExpiry * 1000;

    refreshTimerRef.current = setTimeout(() => {
      silentRefresh();
    }, refreshDelayMs);
  }, []);

  // ============================================================================
  // SILENT REFRESH WITH RETRY
  // ============================================================================

  const silentRefresh = useCallback(
    async (maxRetries = 3) => {
      const now = Date.now();
      const minTimeBetweenAttempts = 5000; // 5 seconds

      // Prevent rapid successive refresh attempts. Re-arm the timer so a
      // throttled *scheduled* refresh doesn't silently break the refresh chain
      // (which would let the token expire without a follow-up attempt).
      if (now - lastRefreshAttempt.current < minTimeBetweenAttempts) {
        scheduleTokenRefresh(6 * 60); // retry in ~1 minute
        return;
      }

      lastRefreshAttempt.current = now;
      refreshRetryCount.current = 0;

      const attemptRefresh = async (_attempt: number): Promise<boolean> => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/auth/refresh`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (response.ok) {
            const { data } = await response.json();
            const { accessToken, expiresIn } = data;

            setAccessToken(accessToken);
            // Refresh does not return the user object — recover it from the token
            // so role-based UI survives a page reload.
            const decodedUser = decodeUserFromToken(accessToken);
            if (decodedUser) setUser(decodedUser);
            setError(null);
            refreshRetryCount.current = 0;

            // Schedule next refresh
            if (expiresIn) {
              scheduleTokenRefresh(expiresIn);
            }

            return true;
          } else if (response.status === 401) {
            // Unauthorized - token invalid or expired
            setAccessToken(null);
            setUser(null);
            setError(null); // Clear error, user should log in
            return false;
          } else {
            // Server error, retry
            return false;
          }
        } catch (err) {
          return false;
        }
      };

      // Try with exponential backoff
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        refreshRetryCount.current = attempt;

        if (await attemptRefresh(attempt)) {
          return; // Success
        }

        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      // All retries failed
      setError(
        "Unable to refresh session. Check your connection or log in again if the problem persists."
      );
      // Don't log out - user might be offline, just show error
    },
    [scheduleTokenRefresh]
  );

  // ============================================================================
  // KEEP THE API LAYER IN SYNC WITH AUTH STATE
  // ============================================================================

  // Push the current access token into the axios layer so it is attached to
  // every request.
  useEffect(() => {
    setApiAccessToken(accessToken);
  }, [accessToken]);

  // Let the axios 401-refresh interceptor write a refreshed token back into
  // React state, and clear the session when refresh ultimately fails.
  useEffect(() => {
    registerAuthHandlers({
      onTokenRefreshed: (token: string) => {
        setAccessToken(token);
        const decodedUser = decodeUserFromToken(token);
        if (decodedUser) setUser(decodedUser);
      },
      onAuthFailure: () => {
        setAccessToken(null);
        setUser(null);
      },
    });
  }, []);

  // ============================================================================
  // INITIAL LOAD - SILENT REFRESH ON MOUNT
  // ============================================================================

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        await silentRefresh(2); // Try 2 times on initial load
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [silentRefresh]);

  // ============================================================================
  // LOGIN
  // ============================================================================

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/auth/login`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
            credentials: "include",
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Login failed");
        }

        const { data } = await response.json();
        const { accessToken, user, expiresIn } = data;

        setAccessToken(accessToken);
        setUser(user);
        setError(null);
        refreshRetryCount.current = 0;

        // Schedule refresh
        if (expiresIn) {
          scheduleTokenRefresh(expiresIn);
        }
      } catch (err: any) {
        const errorMessage =
          err.message || "Login failed. Please check your credentials and try again.";
        setError(errorMessage);
        setAccessToken(null);
        setUser(null);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [scheduleTokenRefresh]
  );

  // ============================================================================
  // LOGOUT
  // ============================================================================

  const logout = useCallback(async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      ).catch(() => {
        // Logout fails gracefully even if API is down
      });
    } finally {
      setAccessToken(null);
      setUser(null);
      setError(null);
      refreshRetryCount.current = 0;

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        user,
        isLoading,
        error,
        login,
        logout,
        clearError,
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
