import { csrfHeaders, ensureCsrfToken, signalerSessionExpiree } from '@brio/api-client'
import { z } from 'zod'

import { apiBaseUrl } from './api-base-url'

export type WrittenExerciseLesson =
  { coursId: string } | { niveau: string; matiere: string; slug: string }

const identifier = z.string().uuid()
const optionalDate = z.string().datetime({ offset: true }).nullish()
const summarySchema = z.object({ id: identifier, titre: z.string() })

const exerciseSchema = summarySchema.extend({
  version: z.number().int().positive(),
  enonce: z.string(),
  coursId: identifier.nullish(),
  niveau: z.string().nullish(),
  matiere: z.string().nullish(),
  slug: z.string().nullish(),
  echeance: optionalDate,
  cloture: z.boolean(),
  corrige: z.string().nullish(),
  soumission: z
    .object({
      reponse: z.string(),
      correct: z.boolean(),
      remisAt: z.string().datetime({ offset: true }),
    })
    .nullish(),
})

const teacherExerciseSchema = summarySchema.extend({
  version: z.number().int().positive(),
  coursId: identifier,
  enonce: z.string(),
  reponseAttendue: z.string(),
  corrige: z.string(),
  echeance: optionalDate,
  publie: z.boolean(),
  cloture: z.boolean(),
})

export type WrittenExerciseSummary = z.infer<typeof summarySchema>
export type WrittenExercise = z.infer<typeof exerciseSchema>
export type TeacherWrittenExercise = z.infer<typeof teacherExerciseSchema>
export type WrittenExerciseDraft = Omit<
  TeacherWrittenExercise,
  'id' | 'version' | 'publie' | 'cloture'
>

export class WrittenExerciseApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined
  ) {
    super(`Written exercise request failed (${status})`)
    this.name = 'WrittenExerciseApiError'
  }
}

const errorSchema = z.object({ code: z.string().optional() })
const studentPath = '/api/exercices-rediges'
const teacherPath = '/api/prof/exercices-rediges'
const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})

export function formatExerciseDeadline(date: string) {
  return dateFormat.format(new Date(date))
}

async function requestExercise<T>(
  path: string,
  schema: z.ZodType<T>,
  {
    method = 'GET',
    body,
    cookie,
    signal,
  }: { method?: 'GET' | 'POST' | 'PUT'; body?: object; cookie?: string; signal?: AbortSignal } = {}
): Promise<T> {
  const base = apiBaseUrl()
  const response = await fetch(`${base}${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(method !== 'GET' ? csrfHeaders(await ensureCsrfToken(base)) : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    if (response.status === 401) signalerSessionExpiree()
    const parsed = errorSchema.safeParse(await response.json().catch(() => undefined))
    throw new WrittenExerciseApiError(
      response.status,
      parsed.success ? parsed.data.code : undefined
    )
  }
  return schema.parse(await response.json())
}

export function listLessonWrittenExercises(lesson: WrittenExerciseLesson, signal?: AbortSignal) {
  const query = new URLSearchParams(lesson)
  return requestExercise(`${studentPath}?${query}`, z.array(summarySchema), { signal })
}

export function getWrittenExercise(id: string, cookie?: string) {
  return requestExercise(`${studentPath}/${encodeURIComponent(id)}`, exerciseSchema, { cookie })
}

export function submitWrittenExercise(id: string, version: number, reponse: string) {
  return requestExercise(`${studentPath}/${encodeURIComponent(id)}/soumission`, exerciseSchema, {
    method: 'POST',
    body: { version, reponse },
  })
}

export function listTeacherWrittenExercises(signal?: AbortSignal) {
  return requestExercise(teacherPath, z.array(teacherExerciseSchema), { signal })
}

export function saveWrittenExercise(draft: WrittenExerciseDraft, id?: string) {
  return requestExercise(
    id ? `${teacherPath}/${encodeURIComponent(id)}` : teacherPath,
    teacherExerciseSchema,
    { method: id ? 'PUT' : 'POST', body: draft }
  )
}

export function publishWrittenExercise(id: string) {
  return requestExercise(
    `${teacherPath}/${encodeURIComponent(id)}/publier`,
    teacherExerciseSchema,
    {
      method: 'POST',
    }
  )
}

export function closeWrittenExercise(id: string) {
  return requestExercise(
    `${teacherPath}/${encodeURIComponent(id)}/cloturer`,
    teacherExerciseSchema,
    {
      method: 'POST',
    }
  )
}

export function writtenExerciseErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof WrittenExerciseApiError)) return fallback
  if (error.code === 'FORMULE_ILLISIBLE') {
    return 'La formule est incomplète ou illisible. Vérifie la saisie et les parenthèses.'
  }
  if (error.code === 'FORMULE_HORS_DOMAINE') {
    return 'Cette formule sort du format attendu. Utilise une expression polynomiale en x.'
  }
  if (error.code === 'CORRIGE_INCOMPLET') {
    return 'Complète le titre, l’énoncé, la réponse attendue et le corrigé avant de publier.'
  }
  if (error.code === 'ECHEANCE_PASSEE')
    return 'Choisis une échéance dans le futur ou laisse-la vide.'
  if (error.code === 'COURS_NON_PUBLIE') return 'Publie la leçon avant de publier cet exercice.'
  if (error.code === 'EXERCICE_CLOS') return 'Cet exercice est clôturé.'
  if (error.status === 401) return 'La session a expiré. Reconnecte-toi pour continuer.'
  if (error.status === 403 || error.status === 404) return 'Cet exercice est inaccessible.'
  if (error.status === 409)
    return 'L’état de l’exercice a changé. Actualise la page avant de réessayer.'
  return fallback
}

export function writtenExerciseLessonHref(exercise: WrittenExercise) {
  if (exercise.coursId) return `/cours/${encodeURIComponent(exercise.coursId)}`
  const { niveau, matiere, slug } = exercise
  if (niveau && matiere && slug) {
    return `/${[niveau, matiere, slug].map(encodeURIComponent).join('/')}`
  }
  return '/explorer'
}
