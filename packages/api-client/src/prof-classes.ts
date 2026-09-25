import { createApiClient } from './client.js'
import { CoursApiError } from './cours-edition.js'
import type { components } from './generated/schema.js'

/**
 * The connected teacher's own classes (ADR 0019 §4) — the choices offered by the publish
 * screen's class picker. Read-only, session-cookie authenticated; reuses {@link CoursApiError}
 * so the editor maps failures to French copy uniformly.
 */

export type ClasseInfo = components['schemas']['ClasseInfo']

/** The teacher's active classes, with labels. Empty when the teacher runs no class. */
export async function listerMesClasses(baseUrl: string): Promise<ClasseInfo[]> {
  const client = createApiClient(baseUrl)
  const { data, error, response } = await client.GET('/api/prof/classes')
  if (error || !data) {
    throw new CoursApiError(response.status, 'Impossible de charger vos classes.')
  }
  return data
}
