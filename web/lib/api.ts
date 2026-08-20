import { createApiClient } from '@brio/api-client'
import type { ChapitreResponse } from '@/components/chapter-view'
import { z } from 'zod'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const client = createApiClient(API_URL)

export async function getPingStatus() {
  const { data, error } = await client.GET('/api/ping')
  if (error) throw new Error('Ping failed')
  return data
}

export async function getChapitre(id: string): Promise<ChapitreResponse> {
  const { data, error } = await client.GET('/api/chapitres/{id}', {
    params: { path: { id } },
    headers: { Authorization: buildAuthHeader() },
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
  const res = await fetch(`${API_URL}/api/catalogue`, {
    headers: { Authorization: buildAuthHeader() },
  })
  if (!res.ok) throw new Error('Catalogue unavailable')
  return CatalogueSchema.parse(await res.json())
}

export async function getChapitreByTriplet(
  niveau: string,
  matiere: string,
  slug: string
): Promise<ChapitreResponse> {
  const res = await fetch(
    `${API_URL}/api/chapitres/${encodeURIComponent(niveau)}/${encodeURIComponent(matiere)}/${encodeURIComponent(slug)}`,
    { headers: { Authorization: buildAuthHeader() } }
  )
  if (!res.ok) throw new Error(`Chapitre introuvable: ${slug}`)
  return res.json() as Promise<ChapitreResponse>
}

// ---------------------------------------------------------------------------
// Exercise submission
// Dev-only scaffolding: credentials from env vars, replaced when the identite
// module ships real auth. Never hardcode credentials in source.
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

function buildAuthHeader(): string {
  const username = process.env.NEXT_PUBLIC_BRIO_API_USERNAME ?? ''
  const password = process.env.NEXT_PUBLIC_BRIO_API_PASSWORD ?? ''
  return 'Basic ' + btoa(`${username}:${password}`)
}

export async function soumettre(
  exerciceId: string,
  answer: Record<string, unknown>
): Promise<SoumissionResult> {
  const { data, error, response } = await client.POST('/api/exercices/{id}/soumissions', {
    params: { path: { id: exerciceId } },
    body: { answer },
    headers: { Authorization: buildAuthHeader() },
  })
  if (error) {
    if (response.status === 401) throw new Error('Non authentifié')
    if (response.status === 404) throw new Error('Exercice introuvable')
    throw new Error('Erreur lors de la soumission')
  }
  return SoumissionResultSchema.parse(data)
}
