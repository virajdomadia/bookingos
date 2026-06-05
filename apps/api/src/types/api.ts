/**
 * Standardized API response types
 * All endpoints must return one of these formats
 */

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, any>;
}

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    userId: string;
    email: string;
    role: string;
  };
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Error codes for consistent error handling
export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  EMAIL_TAKEN = "EMAIL_TAKEN",
  SLUG_TAKEN = "SLUG_TAKEN",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INVALID_EMAIL = "INVALID_EMAIL",
  WEAK_PASSWORD = "WEAK_PASSWORD",
}
