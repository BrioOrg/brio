import createClient from 'openapi-fetch'
import type { paths } from './generated/schema.js'

/**
 * Returns a typed fetch client for all endpoints documented in the OpenAPI spec.
 * Requires running `pnpm generate:api` first to populate src/generated/schema.d.ts.
 */
export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl })
}
