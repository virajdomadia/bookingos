import axios, { AxiosInstance } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// In-memory access token, kept in sync with AuthContext. The token lives only
// in memory (never localStorage) so it is not exposed to XSS-readable storage.
let currentAccessToken: string | null = null;

// Callbacks wired up by AuthContext so the API layer can push a refreshed token
// back into React state and signal when the session is no longer valid.
let onTokenRefreshed: ((token: string) => void) | null = null;
let onAuthFailure: (() => void) | null = null;

export const setApiAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

export const registerAuthHandlers = (handlers: {
  onTokenRefreshed: (token: string) => void;
  onAuthFailure: () => void;
}) => {
  onTokenRefreshed = handlers.onTokenRefreshed;
  onAuthFailure = handlers.onAuthFailure;
};

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Request interceptor: attach the current access token to every request.
api.interceptors.request.use((config) => {
  if (currentAccessToken) {
    config.headers.Authorization = `Bearer ${currentAccessToken}`;
  }
  return config;
});

// Response interceptor: on 401, attempt a single silent refresh, then retry.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // Server envelope is { data: { accessToken, expiresIn } }.
        const accessToken: string | undefined = data?.data?.accessToken;
        if (!accessToken) {
          throw new Error("Refresh response did not contain an access token");
        }

        currentAccessToken = accessToken;
        onTokenRefreshed?.(accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear session and send the user to login.
        onAuthFailure?.();
        if (typeof window !== "undefined") {
          window.location.href = "/auth";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
