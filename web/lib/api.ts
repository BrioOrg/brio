import { createApiClient, ensureCsrfToken, csrfHeaders } from '@brio/api-client'
import type { ChapitreResponse } from '@/components/chapter-view'
import { z } from 'zod'
import { apiBaseUrl } from '@/lib/api-base-url'

export async function getPingStatus() {
  const { data, error } = await createApiClient(apiBaseUrl()).GET('/api/ping')
  if (error) throw new Error('Ping failed')
  return data
}

export async function getChapitre(id: string): Promise<ChapitreResponse> {
  const { data, error } = await createApiClient(apiBaseUrl()).GET('/api/chapitres/{id}', {
    params: { path: { id } },
  })
  if (error) throw new Error(`Chapitre introuvable: ${id}`)
  return data as unknown as ChapitreResponse
}

// ---------------------------------------------------------------------------
// Catalog — manual Zod wrapper until /api/catalogue appears in the generated
// OpenAPI schema (requires running `pnpm generate:api` against a live backend).
// ---------------------------------------------------------------------------

const CatalogueChapitreSchema = z.object({
  slug: z.string(),
  titre: z.string(),
  dureeEstimeeMinutes: z.number(),
  ordre: z.number(),
})

const CatalogueMatiereSchema = z.object({
  matiereCode: z.string(),
  matiereLibelle: z.string(),
  chapitres: z.array(CatalogueChapitreSchema),
})

const CatalogueNiveauSchema = z.object({
  niveauCode: z.string(),
  niveauLibelle: z.string(),
  matieres: z.array(CatalogueMatiereSchema),
})

export const CatalogueSchema = z.array(CatalogueNiveauSchema)
export type Catalogue = z.infer<typeof CatalogueSchema>
export type CatalogueNiveau = z.infer<typeof CatalogueNiveauSchema>

export async function getCatalogue(): Promise<Catalogue> {
  const res = await fetch(`${apiBaseUrl()}/api/catalogue`)
  if (!res.ok) throw new Error('Catalogue unavailable')
  return CatalogueSchema.parse(await res.json())
}

export async function getChapitreByTriplet(
  niveau: string,
  matiere: string,
  slug: string
): Promise<ChapitreResponse> {
  const res = await fetch(
    `${apiBaseUrl()}/api/chapitres/${encodeURIComponent(niveau)}/${encodeURIComponent(matiere)}/${encodeURIComponent(slug)}`
  )
  if (!res.ok) throw new Error(`Chapitre introuvable: ${slug}`)
  return res.json() as Promise<ChapitreResponse>
}

/**
 * A published teacher course, served in the exact same shape as a catalogue chapter
 * (ADR 0019 §1) so it renders through the same <ChapterView/>. Unlike the public
 * catalogue, this endpoint is scoped: the backend enforces the course's portées.
 *
 * Called from a Server Component, where no browser cookie rides along: the page passes
 * the incoming request's cookies (`cookies().toString()`) so the call carries the
 * student's session. Taken as a parameter rather than read here because this module is
 * also imported by client components, which cannot import `next/headers`.
 */
export async function getCoursPublie(
  coursId: string,
  cookieHeader: string
): Promise<ChapitreResponse> {
  const res = await fetch(`${apiBaseUrl()}/api/cours/${encodeURIComponent(coursId)}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Cours indisponible: ${coursId}`)
  return res.json() as Promise<ChapitreResponse>
}

const CoursVisibleSchema = z.object({
  id: z.string(),
  titre: z.string(),
  niveauCode: z.string(),
  matiereCode: z.string(),
  // Absent when identite has no name for the author: the card then shows none.
  enseignant: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  publieAt: z.string(),
})

export type CoursVisible = z.infer<typeof CoursVisibleSchema>

/**
 * The teacher courses published to the logged-in student's classes, newest first (#160).
 * Server-side, like getCoursPublie: the caller relays the request's cookies. A visitor
 * without a session gets a 401, surfaced as an error the page treats as "no courses".
 */
export async function getCoursVisibles(cookieHeader: string): Promise<CoursVisible[]> {
  const res = await fetch(`${apiBaseUrl()}/api/cours`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Cours indisponibles')
  return z.array(CoursVisibleSchema).parse(await res.json())
}

// ---------------------------------------------------------------------------
// Exercise submission — rides the session cookie (ADR 0018), see soumettre().
// ---------------------------------------------------------------------------

const ChoiceFeedbackSchema = z.object({
  choiceId: z.string().optional(),
  correct: z.boolean().optional(),
})

export const SoumissionResultSchema = z.object({
  soumissionId: z.string().optional(),
  correct: z.boolean().optional(),
  score: z.number().optional(),
  choiceFeedback: z.array(ChoiceFeedbackSchema).optional().default([]),
  // springdoc marks Double/String as optional rather than nullable; handle both
  expectedValue: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  explanation: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
})

export type SoumissionResult = z.infer<typeof SoumissionResultSchema>

// ---------------------------------------------------------------------------
// Tuteur IA
// ---------------------------------------------------------------------------

const TuteurResponseSchema = z.object({
  reponse: z.string(),
  citations: z.array(z.string()).default([]),
})

export type TuteurReponse = z.infer<typeof TuteurResponseSchema>

export async function askTuteur(
  niveau: string,
  matiere: string,
  slug: string,
  question: string,
  exerciceId: string | null
): Promise<TuteurReponse> {
  return postTuteur(
    `${apiBaseUrl()}/api/chapitres/${encodeURIComponent(niveau)}/${encodeURIComponent(matiere)}/${encodeURIComponent(slug)}/tuteur`,
    question,
    exerciceId
  )
}

export async function askCoursTuteur(
  coursId: string,
  question: string,
  exerciceId: string | null
): Promise<TuteurReponse> {
  return postTuteur(
    `${apiBaseUrl()}/api/cours/${encodeURIComponent(coursId)}/tuteur`,
    question,
    exerciceId
  )
}

/**
 * Where the tutor should answer from. Serializable (no functions) so a Server Component
 * page can hand it to the client TuteurPanel across the RSC boundary. The tutor pipeline
 * is identical for both origins — only the endpoint differs (ADR 0019 §1).
 */
export type TutorTarget =
  | { kind: 'chapitre'; niveau: string; matiere: string; slug: string }
  | { kind: 'cours'; coursId: string }

export function askTuteurForTarget(
  target: TutorTarget,
  question: string,
  exerciceId: string | null
): Promise<TuteurReponse> {
  return target.kind === 'chapitre'
    ? askTuteur(target.niveau, target.matiere, target.slug, question, exerciceId)
    : askCoursTuteur(target.coursId, question, exerciceId)
}

async function postTuteur(
  url: string,
  question: string,
  exerciceId: string | null
): Promise<TuteurReponse> {
  const body: Record<string, unknown> = { question }
  if (exerciceId) body.exerciceId = exerciceId
  // The tutor is gated by the student's session (ADR 0018): send the session cookie
  // and, this being a mutating POST, echo the CSRF token — same as soumettre().
  const token = await ensureCsrfToken(apiBaseUrl())
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders(token) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Erreur du tuteur')
  return TuteurResponseSchema.parse(await res.json())
}

export async function soumettre(
  exerciceId: string,
  answer: Record<string, unknown>
): Promise<SoumissionResult> {
  // Submissions are attributed to the logged-in student via the session cookie
  // (createApiClient sends it). Being a mutating POST, it also needs the CSRF
  // token echoed as a header — primed here if the cookie isn't set yet.
  const token = await ensureCsrfToken(apiBaseUrl())
  const { data, error, response } = await createApiClient(apiBaseUrl()).POST('/api/exercices/{id}/soumissions', {
    params: { path: { id: exerciceId } },
    body: { answer },
    headers: csrfHeaders(token),
  })
  // Guard on the status too: an auth/CSRF failure can return an empty body, which
  // openapi-fetch surfaces as no `error` rather than a populated one.
  if (error || !response.ok) {
    if (response.status === 401) throw new Error('Non authentifié')
    if (response.status === 404) throw new Error('Exercice introuvable')
    throw new Error('Erreur lors de la soumission')
  }
  return SoumissionResultSchema.parse(data)
}
