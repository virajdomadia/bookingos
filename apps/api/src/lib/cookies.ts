import type { CookieOptions } from "express";

/**
 * Refresh-token cookie options, centralised so login/refresh/logout stay in
 * sync (a clearCookie that doesn't match the original attributes silently fails
 * to clear).
 *
 * SameSite must match the deployment topology:
 *   - Same registrable domain for web + API (e.g. booking.example.com +
 *     api.example.com, or localhost:3000 + localhost:4000) → "strict"/"lax"
 *     works; the cookie is sent on the cross-subdomain/cross-port refresh fetch.
 *   - Different registrable domains (e.g. *.vercel.app web + *.railway.app API)
 *     → the cookie is cross-site, so the browser drops it unless it is
 *     "none" + Secure. Set COOKIE_SAMESITE=none in that topology.
 *
 * SameSite=None REQUIRES Secure, so we force `secure` on when it is selected.
 * COOKIE_DOMAIN (optional) scopes the cookie to a parent domain so it is shared
 * across subdomains.
 */
const rawSameSite = (process.env.COOKIE_SAMESITE ?? "strict").toLowerCase();
const SAME_SITE: "strict" | "lax" | "none" =
  rawSameSite === "none" || rawSameSite === "lax" ? rawSameSite : "strict";

const SECURE = process.env.NODE_ENV === "production" || SAME_SITE === "none";
const DOMAIN = process.env.COOKIE_DOMAIN || undefined;

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: SECURE,
  sameSite: SAME_SITE,
  path: "/",
  ...(DOMAIN ? { domain: DOMAIN } : {}),
};

/** Options for setting the refresh cookie, with a given max-age (ms). */
export const refreshCookieOptions = (maxAgeMs: number): CookieOptions => ({
  ...baseOptions,
  maxAge: maxAgeMs,
});

/** Options for clearing the refresh cookie — must mirror the set attributes. */
export const clearRefreshCookieOptions = (): CookieOptions => ({ ...baseOptions });
