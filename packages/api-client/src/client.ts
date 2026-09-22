import createClient from 'openapi-fetch'
import type { paths } from './generated/schema.js'

/**
 * Returns a typed fetch client for all endpoints documented in the OpenAPI spec.
 * Requires running `pnpm generate:api` first to populate src/generated/schema.d.ts.
 */
export function createApiClient(baseUrl: string) {
  // `credentials: 'include'` so the session cookie rides on every call — the API
  // is gated by the session (form-login), not by per-request auth headers.
  return createClient<paths>({ baseUrl, credentials: 'include' })
}
