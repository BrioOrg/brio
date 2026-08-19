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
// The submission endpoint is not in the committed schema.d.ts yet (regenerate
// with `pnpm generate:api` once the backend is running to pick it up).
// Until then this uses a typed fetch wrapper with Zod validation at the
// boundary — the same pattern as packages/api-client/src/health.ts.
//
// Dev-only scaffolding: credentials from env vars, replaced when the identite
// module ships real auth. Never hardcode credentials in source.
// ---------------------------------------------------------------------------

const ChoiceFeedbackSchema = z.object({
  choiceId: z.string(),
  correct: z.boolean(),
})

export const SoumissionResultSchema = z.object({
  soumissionId: z.string(),
  correct: z.boolean(),
  score: z.number(),
  choiceFeedback: z.array(ChoiceFeedbackSchema),
  expectedValue: z.number().nullable(),
  explanation: z.string().nullable(),
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
  const res = await fetch(`${API_URL}/api/exercices/${exerciceId}/soumissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthHeader(),
    },
    body: JSON.stringify({ answer }),
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Non authentifié')
    if (res.status === 404) throw new Error('Exercice introuvable')
    throw new Error('Erreur lors de la soumission')
  }

  return SoumissionResultSchema.parse(await res.json())
}
