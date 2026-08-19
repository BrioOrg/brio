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
  })
  if (error) throw new Error(`Chapitre introuvable: ${id}`)
  return data as ChapitreResponse
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
