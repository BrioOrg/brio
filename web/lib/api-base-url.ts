/**
 * Base URL for calls to the Spring API, resolved per caller (ADR 0024 §5).
 *
 * - Browser: the page's own origin — the API is served on it under `/api` (Caddy in
 *   a deployed environment, the dev-only rewrite in `next.config.ts` locally).
 *   Absolute rather than `''` because openapi-fetch builds a `Request`, which
 *   rejects relative URLs outside a document.
 * - Next.js server (SSR, route handlers): `API_INTERNAL_URL`, read at runtime so the
 *   same image runs in every environment and SSR reaches the backend directly
 *   instead of going back out through the edge proxy.
 *
 * A function rather than a module-level constant: the lib modules calling it are
 * imported by both server and client components.
 */
export function apiBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.API_INTERNAL_URL ?? 'http://localhost:8080'
}
