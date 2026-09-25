import { createApiClient } from './client.js'
import { ensureCsrfToken, csrfHeaders } from './csrf.js'
import type { components } from './generated/schema.js'

/**
 * Teacher course authoring client (ADR 0019 §4, CDC §8.4). Wraps the typed `createApiClient`
 * over the "Édition de cours" endpoints and rides the session cookie (`credentials: 'include'`).
 * Mutations prime and echo the CSRF token, exactly like login/enrollment.
 *
 * Every failure surfaces as a {@link CoursApiError} carrying the HTTP status and a French
 * message — 401/403/404 have fixed copy; 422 shows the server's own reason (the
 * `PublicationValidator` message, or "aucune classe" when a teacher has none).
 */

export type CoursResume = components['schemas']['CoursResumeResponse']
export type CoursDetail = components['schemas']['CoursDetailResponse']
export type PublicationResult = components['schemas']['PublicationResult']

/** What the create/save calls carry; `content` is the course-content JSON document (may be empty). */
export type EnregistrerCoursInput = {
  titre: string
  content?: unknown
}

export type CreerCoursInput = EnregistrerCoursInput & {
  niveauCode: string
  matiereCode: string
}

/** A failed authoring call. `status` lets a caller branch; `message` is ready-to-show French copy. */
export class CoursApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'CoursApiError'
  }
}

/** Map an HTTP status (and any `{ error }` body) to a French message. */
function coursError(status: number, body: unknown, fallback: string): CoursApiError {
  const serverMessage =
    body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : null
  const message =
    status === 401
      ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
      : status === 403
        ? "Vous n'avez pas accès à ce cours."
        : status === 404
          ? 'Ce cours est introuvable.'
          : status === 422
            ? (serverMessage ?? "Le cours ne peut pas être publié en l'état.")
            : fallback
  return new CoursApiError(status, message)
}

/** The teacher's own courses, most recently touched first. */
export async function listerMesCours(baseUrl: string): Promise<CoursResume[]> {
  const client = createApiClient(baseUrl)
  const { data, error, response } = await client.GET('/api/prof/cours')
  if (error || !data) {
    throw coursError(response.status, error, 'Impossible de charger vos cours.')
  }
  return data
}

/** One course loaded for editing: metadata, draft content and the classes it is scoped to. */
export async function getCoursBrouillon(baseUrl: string, coursId: string): Promise<CoursDetail> {
  const client = createApiClient(baseUrl)
  const { data, error, response } = await client.GET('/api/prof/cours/{coursId}', {
    params: { path: { coursId } },
  })
  if (error || !data) {
    throw coursError(response.status, error, 'Impossible de charger ce cours.')
  }
  return data
}

/** Create a draft; returns its server id. Author + établissement are derived server-side. */
export async function creerCours(baseUrl: string, input: CreerCoursInput): Promise<string> {
  const client = createApiClient(baseUrl)
  const headers = csrfHeaders(await ensureCsrfToken(baseUrl))
  const { data, error, response } = await client.POST('/api/prof/cours', {
    body: input,
    headers,
  })
  if (error || !data?.coursId) {
    throw coursError(response.status, error, 'Impossible de créer le cours.')
  }
  return data.coursId
}

/** Overwrite a draft's title and content (the "Enregistrer" action). */
export async function enregistrerCours(
  baseUrl: string,
  coursId: string,
  input: EnregistrerCoursInput
): Promise<void> {
  const client = createApiClient(baseUrl)
  const headers = csrfHeaders(await ensureCsrfToken(baseUrl))
  const { error, response } = await client.PUT('/api/prof/cours/{coursId}', {
    params: { path: { coursId } },
    body: input,
    headers,
  })
  if (!response.ok || error) {
    throw coursError(response.status, error, "Impossible d'enregistrer le cours.")
  }
}

/** Replace the set of classes a course is visible to. Each must be a class the teacher runs. */
export async function definirPortees(
  baseUrl: string,
  coursId: string,
  classeIds: string[]
): Promise<void> {
  const client = createApiClient(baseUrl)
  const headers = csrfHeaders(await ensureCsrfToken(baseUrl))
  const { error, response } = await client.PUT('/api/prof/cours/{coursId}/portees', {
    params: { path: { coursId } },
    body: { classeIds },
    headers,
  })
  if (!response.ok || error) {
    throw coursError(response.status, error, "Impossible d'enregistrer les classes.")
  }
}

/** Validate and freeze the draft as an immutable version; returns the frozen version number. */
export async function publierCours(baseUrl: string, coursId: string): Promise<PublicationResult> {
  const client = createApiClient(baseUrl)
  const headers = csrfHeaders(await ensureCsrfToken(baseUrl))
  const { data, error, response } = await client.POST('/api/prof/cours/{coursId}/publier', {
    params: { path: { coursId } },
    headers,
  })
  if (error || !data) {
    throw coursError(response.status, error, 'La publication a échoué.')
  }
  return data
}
