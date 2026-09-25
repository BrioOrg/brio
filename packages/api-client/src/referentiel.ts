import { createApiClient } from './client.js'
import { CoursApiError } from './cours-edition.js'
import type { components } from './generated/schema.js'

/**
 * Read-only access to the competency referential (ADR 0009), used by the teacher editor's
 * competency picker (issue #144). Only active codes are returned — a deprecated code would fail
 * publication. ENSEIGNANT-gated ({@code /api/prof/**}); reuses {@link CoursApiError} so the editor
 * maps failures to French copy uniformly.
 */

export type Competence = components['schemas']['CompetenceDto']

/** The active competencies of the referential, ordered by code. */
export async function listerCompetences(baseUrl: string): Promise<Competence[]> {
  const client = createApiClient(baseUrl)
  const { data, error, response } = await client.GET('/api/prof/referentiel/competences')
  if (error || !data) {
    throw new CoursApiError(response.status, 'Impossible de charger le référentiel de compétences.')
  }
  return data
}
