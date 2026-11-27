import { csrfHeaders, ensureCsrfToken, signalerSessionExpiree } from '@brio/api-client'
import { z } from 'zod'

import { apiBaseUrl } from './api-base-url'

export type WrittenExerciseLesson =
  { coursId: string } | { niveau: string; matiere: string; slug: string }

const identifier = z.string().uuid()
const optionalDate = z.string().datetime({ offset: true }).nullish()
const summarySchema = z.object({ id: identifier, titre: z.string() })
const modeCorrection = z.enum(['automatique', 'enseignant', 'ia'])
const correctionKeySchema = z.object({
  type: z.enum(['traduction', 'liste']),
  minimum: z.number().int().positive(),
  criteres: z.array(z.object({ attendu: z.string(), variantes: z.array(z.string()) })),
  extraitLecon: z.string().nullish(),
  confirmee: z.boolean(),
})
const criterionFeedbackSchema = z.object({
  etat: z.enum(['en_attente', 'disponible', 'indisponible']),
  minimum: z.number().int().nonnegative(),
  criteres: z.array(
    z.object({
      attendu: z.string(),
      etat: z.enum(['present', 'manquant', 'incertain']),
      extrait: z.string().nullish(),
    })
  ),
})
const feedbackSchema = z.object({
  commentaire: z.string(),
  publieAt: z.string().datetime({ offset: true }),
})
const copySchema = z.object({
  reponse: z.string(),
  remisAt: z.string().datetime({ offset: true }),
  photo: z.boolean().optional(),
  retour: feedbackSchema.nullish(),
})
const teacherCopySchema = copySchema.extend({
  eleveId: identifier,
  nomAffiche: z.string(),
})

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
  copieModele: z.string().nullish(),
  modeCorrection: modeCorrection.optional(),
  photoAutorisee: z.boolean().optional(),
  soumission: copySchema
    .extend({ correct: z.boolean().nullish(), retourIa: criterionFeedbackSchema.nullish() })
    .nullish(),
})

const teacherExerciseSchema = summarySchema.extend({
  version: z.number().int().positive(),
  coursId: identifier,
  enonce: z.string(),
  reponseAttendue: z.string().nullish(),
  corrige: z.string(),
  cleCorrection: correctionKeySchema.nullish(),
  copieModele: z.string().nullish(),
  modeCorrection: modeCorrection.optional(),
  photoAutorisee: z.boolean().optional(),
  echeance: optionalDate,
  publie: z.boolean(),
  cloture: z.boolean(),
})

export type WrittenCorrectionKey = z.infer<typeof correctionKeySchema>
export type WrittenCriterionFeedback = z.infer<typeof criterionFeedbackSchema>
export const CRITERION_ANSWER_LIMIT = 1200

export type WrittenExerciseSummary = z.infer<typeof summarySchema>
export type WrittenExercise = z.infer<typeof exerciseSchema>
export type TeacherWrittenExercise = z.infer<typeof teacherExerciseSchema>
export type TeacherWrittenCopy = z.infer<typeof teacherCopySchema>
export type WrittenExerciseDraft = Omit<
  TeacherWrittenExercise,
  'id' | 'version' | 'publie' | 'cloture'
>

export const WRITTEN_PHOTO_MAX_BYTES = 5 * 1024 * 1024

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
  }: {
    method?: 'GET' | 'POST' | 'PUT'
    body?: object | FormData
    cookie?: string
    signal?: AbortSignal
  } = {}
): Promise<T> {
  const base = apiBaseUrl()
  const multipart = body instanceof FormData
  const response = await fetch(`${base}${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(method !== 'GET' ? csrfHeaders(await ensureCsrfToken(base)) : {}),
      ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
    },
    body: multipart ? body : body ? JSON.stringify(body) : undefined,
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

export function getWrittenExercise(id: string, cookie?: string, signal?: AbortSignal) {
  return requestExercise(`${studentPath}/${encodeURIComponent(id)}`, exerciseSchema, {
    cookie,
    signal,
  })
}

export function submitWrittenExercise(id: string, version: number, reponse: string, photo?: File) {
  if (photo) {
    const body = new FormData()
    body.set('version', String(version))
    body.set('reponse', reponse)
    body.set('photo', photo)
    return requestExercise(
      `${studentPath}/${encodeURIComponent(id)}/soumission-photo`,
      exerciseSchema,
      { method: 'POST', body }
    )
  }
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

function teacherCopiesPath(id: string) {
  return `${teacherPath}/${encodeURIComponent(id)}/copies`
}

export function listTeacherWrittenCopies(id: string, signal?: AbortSignal) {
  return requestExercise(teacherCopiesPath(id), z.array(teacherCopySchema), { signal })
}

export function publishWrittenFeedback(id: string, studentId: string, commentaire: string) {
  return requestExercise(
    `${teacherCopiesPath(id)}/${encodeURIComponent(studentId)}/retour`,
    teacherCopySchema,
    { method: 'PUT', body: { commentaire } }
  )
}

export function studentWrittenPhotoHref(id: string) {
  return `${studentPath}/${encodeURIComponent(id)}/photo`
}

export function teacherWrittenPhotoHref(id: string, studentId: string) {
  return `${teacherCopiesPath(id)}/${encodeURIComponent(studentId)}/photo`
}

export function writtenExerciseErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof WrittenExerciseApiError)) return fallback
  if (error.code === 'RETOUR_IA_DESACTIVE') return 'Le retour par critères n’est pas disponible.'
  if (error.code === 'CLE_IA_INVALIDE')
    return 'Vérifie les critères, le minimum attendu et la longueur des champs.'
  if (error.code === 'REPONSE_IA_TROP_LONGUE') return 'La réponse dépasse 1 200 caractères.'
  if (error.code === 'FORMULE_ILLISIBLE') {
    return 'La formule est incomplète ou illisible. Vérifie la saisie et les parenthèses.'
  }
  if (error.code === 'FORMULE_HORS_DOMAINE') {
    return 'Cette formule sort du format attendu. Utilise une expression polynomiale en x.'
  }
  if (error.code === 'CORRIGE_INCOMPLET') {
    return 'Complète l’énoncé et les champs de correction avant de publier.'
  }
  if (error.code === 'PHOTO_INVALIDE' || error.status === 413) {
    return 'Choisis une photo JPEG ou PNG de 5 Mo maximum.'
  }
  if (error.code === 'PHOTO_NON_AUTORISEE') {
    return 'Cet exercice n’accepte pas de photo.'
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
