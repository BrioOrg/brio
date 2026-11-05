import { z } from 'zod'

import { csrfHeaders, ensureCsrfToken } from './csrf.js'
import { signalerSessionExpiree } from './session-expiree.js'

/**
 * Communauté client (ADR 0035) — manual Zod wrappers.
 *
 * Questions and answers between students, under a pseudonym. A response never carries an account
 * id: the entraide returns one with the display name, and it would unmask a pseudonym here.
 *
 * Server contracts (fr.brio.social.web):
 *   GET    /api/reglages/communaute                  200 -> { active }  (public, always answers)
 *   GET    /api/communaute/questions                 200 -> { questions, pageSuivante }
 *   POST   /api/communaute/questions                 201 -> { id } · 422
 *   GET    /api/communaute/questions/{id}            200 -> QuestionDetail · 404
 *   PUT    /api/communaute/questions/{id}            204 · 403 · 404 · 422
 *   DELETE /api/communaute/questions/{id}            204 · 403 · 404
 *   POST   /api/communaute/questions/{id}/reponses   201 -> { id } · 404 · 422
 *   POST   /api/communaute/questions/{id}/reponses/{reponseId}/resolution   204 · 403 · 404 · 409 · 422
 *   PUT    /api/communaute/reponses/{id}             204 · 403 · 404 · 422  (a comment too)
 *   DELETE /api/communaute/reponses/{id}             204 · 403 · 404        (a comment too)
 *   POST   /api/communaute/reponses/{id}/commentaires   201 -> { id } · 404 · 422
 *   PUT    /api/communaute/{questions|reponses}/{id}/vote      204 · 403 · 404 · 422
 *   DELETE /api/communaute/{questions|reponses}/{id}/vote      204 · 404
 *
 * With the setting off, every /api/communaute route is a plain 404. Business errors come back as
 * `{ error }` in French; that text is shown as-is. Reads take the cookie header because the pages
 * render on the server, where no browser cookie rides along.
 */

// --- Responses validated at the boundary ---

export const AuteurCommunauteSchema = z.object({
  pseudonyme: z.string(),
  // Absent for an account that can no longer be found (generic label) or has no level.
  niveau: z.string().nullish(),
})
export type AuteurCommunaute = z.infer<typeof AuteurCommunauteSchema>

export const QuestionResumeSchema = z.object({
  id: z.string(),
  titre: z.string(),
  auteur: AuteurCommunauteSchema,
  niveau: z.string().nullish(),
  matiere: z.string(),
  resolue: z.boolean(),
  nombreReponses: z.number(),
  nombreUtile: z.number(),
  aVote: z.boolean(),
  estAuteur: z.boolean(),
  modifie: z.boolean(),
  createdAt: z.string(),
})
export type QuestionResume = z.infer<typeof QuestionResumeSchema>

export const PageQuestionsSchema = z.object({
  questions: z.array(QuestionResumeSchema),
  pageSuivante: z.boolean(),
})
export type PageQuestions = z.infer<typeof PageQuestionsSchema>

// A body stays unknown here: BlocsCommunaute validates each block when it renders it.
const CorpsSchema = z.array(z.unknown())

export const CommentaireCommunauteSchema = z.object({
  id: z.string(),
  corps: CorpsSchema,
  auteur: AuteurCommunauteSchema,
  estAuteur: z.boolean(),
  modifie: z.boolean(),
  createdAt: z.string(),
})
export type CommentaireCommunaute = z.infer<typeof CommentaireCommunauteSchema>

export const ReponseCommunauteSchema = z.object({
  id: z.string(),
  corps: CorpsSchema,
  auteur: AuteurCommunauteSchema,
  nombreUtile: z.number(),
  aVote: z.boolean(),
  estAuteur: z.boolean(),
  aResolu: z.boolean(),
  modifie: z.boolean(),
  createdAt: z.string(),
  commentaires: z.array(CommentaireCommunauteSchema),
})
export type ReponseCommunaute = z.infer<typeof ReponseCommunauteSchema>

export const QuestionDetailSchema = z.object({
  id: z.string(),
  titre: z.string(),
  corps: CorpsSchema,
  auteur: AuteurCommunauteSchema,
  niveau: z.string().nullish(),
  matiere: z.string(),
  resolue: z.boolean(),
  nombreUtile: z.number(),
  aVote: z.boolean(),
  estAuteur: z.boolean(),
  modifie: z.boolean(),
  createdAt: z.string(),
  reponses: z.array(ReponseCommunauteSchema),
})
export type QuestionDetail = z.infer<typeof QuestionDetailSchema>

const ReglageSchema = z.object({ active: z.boolean() })
const CreationSchema = z.object({ id: z.string() })
const ErreurServeurSchema = z.object({ error: z.string() })

// --- Errors ---

/** A Communauté call failed; `message` is French copy ready to display. */
export class CommunauteError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'CommunauteError'
  }
}

async function communauteError(res: Response, repli: string): Promise<CommunauteError> {
  if (res.status === 401) {
    signalerSessionExpiree()
    return new CommunauteError(401, 'Ta session a expiré. Reconnecte-toi pour continuer.')
  }
  try {
    const corps = ErreurServeurSchema.safeParse(await res.json())
    if (corps.success) return new CommunauteError(res.status, corps.data.error)
  } catch {
    /* no JSON body: fall back */
  }
  return new CommunauteError(res.status, repli)
}

async function ecrire(
  baseUrl: string,
  methode: 'POST' | 'PUT' | 'DELETE',
  chemin: string,
  repli: string,
  corps?: unknown
): Promise<Response> {
  const headers: Record<string, string> = csrfHeaders(await ensureCsrfToken(baseUrl))
  if (corps !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${baseUrl}/api/communaute${chemin}`, {
    method: methode,
    credentials: 'include',
    headers,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  })
  if (!res.ok) throw await communauteError(res, repli)
  return res
}

const segment = encodeURIComponent

function lecture(cookieHeader?: string): RequestInit {
  return {
    credentials: 'include',
    cache: 'no-store',
    ...(cookieHeader === undefined ? {} : { headers: { cookie: cookieHeader } }),
  }
}

// --- Setting ---

/**
 * Whether the Communauté is open on this environment (ADR 0035 §10). Any failure reads as closed:
 * this setting keeps an unmoderated space away from minors, so a doubt must not open it.
 */
export async function lireReglageCommunaute(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/reglages/communaute`, { cache: 'no-store' })
    if (!res.ok) return false
    const reglage = ReglageSchema.safeParse(await res.json())
    return reglage.success && reglage.data.active
  } catch {
    return false
  }
}

// --- Reads ---

export type FiltresQuestions = { niveau?: string; matiere?: string; page?: number }

/**
 * A page of questions, newest first. A missing filter does not filter. Null on a 404: the setting
 * is off, so the route does not exist.
 */
export async function listerQuestions(
  baseUrl: string,
  filtres: FiltresQuestions = {},
  cookieHeader?: string
): Promise<PageQuestions | null> {
  const params = new URLSearchParams()
  if (filtres.niveau) params.set('niveau', filtres.niveau)
  if (filtres.matiere) params.set('matiere', filtres.matiere)
  if (filtres.page) params.set('page', String(filtres.page))
  const requete = params.toString()
  const suite = requete ? `?${requete}` : ''
  const res = await fetch(`${baseUrl}/api/communaute/questions${suite}`, lecture(cookieHeader))
  if (res.status === 404) return null
  if (!res.ok) throw await communauteError(res, 'Impossible de charger les questions.')
  return PageQuestionsSchema.parse(await res.json())
}

/** A whole thread, or null when it does not exist (or no longer does). */
export async function consulterQuestion(
  baseUrl: string,
  questionId: string,
  cookieHeader?: string
): Promise<QuestionDetail | null> {
  const res = await fetch(
    `${baseUrl}/api/communaute/questions/${segment(questionId)}`,
    lecture(cookieHeader)
  )
  if (res.status === 404) return null
  if (!res.ok) throw await communauteError(res, 'Impossible de charger cette question.')
  return QuestionDetailSchema.parse(await res.json())
}

// --- Writes ---

export async function poserQuestion(
  baseUrl: string,
  question: { titre: string; corps: readonly unknown[] }
): Promise<string> {
  const res = await ecrire(
    baseUrl,
    'POST',
    '/questions',
    'Ta question n’a pas pu être publiée.',
    question
  )
  return CreationSchema.parse(await res.json()).id
}

export async function modifierQuestion(
  baseUrl: string,
  questionId: string,
  question: { titre: string; corps: readonly unknown[] }
): Promise<void> {
  await ecrire(
    baseUrl,
    'PUT',
    `/questions/${segment(questionId)}`,
    'Ta question n’a pas pu être modifiée.',
    question
  )
}

export async function supprimerQuestion(baseUrl: string, questionId: string): Promise<void> {
  await ecrire(
    baseUrl,
    'DELETE',
    `/questions/${segment(questionId)}`,
    'Ta question n’a pas pu être supprimée.'
  )
}

export async function repondre(
  baseUrl: string,
  questionId: string,
  corps: readonly unknown[]
): Promise<string> {
  const res = await ecrire(
    baseUrl,
    'POST',
    `/questions/${segment(questionId)}/reponses`,
    'Ta réponse n’a pas pu être publiée.',
    { corps }
  )
  return CreationSchema.parse(await res.json()).id
}

export async function commenter(
  baseUrl: string,
  reponseId: string,
  corps: readonly unknown[]
): Promise<string> {
  const res = await ecrire(
    baseUrl,
    'POST',
    `/reponses/${segment(reponseId)}/commentaires`,
    'Ton commentaire n’a pas pu être publié.',
    { corps }
  )
  return CreationSchema.parse(await res.json()).id
}

/** Edits an answer or a comment: the server keeps them in the same table and the same route. */
export async function modifierReponse(
  baseUrl: string,
  reponseId: string,
  corps: readonly unknown[]
): Promise<void> {
  await ecrire(
    baseUrl,
    'PUT',
    `/reponses/${segment(reponseId)}`,
    'Ton message n’a pas pu être modifié.',
    { corps }
  )
}

/** Deletes an answer or a comment. Deleting the answer that solved a question reopens it. */
export async function supprimerReponse(baseUrl: string, reponseId: string): Promise<void> {
  await ecrire(
    baseUrl,
    'DELETE',
    `/reponses/${segment(reponseId)}`,
    'Ton message n’a pas pu être supprimé.'
  )
}

/** Gives or takes back a « Utile » vote, on a question or an answer. */
export async function voterUtile(
  baseUrl: string,
  cible: 'questions' | 'reponses',
  id: string,
  utile: boolean
): Promise<void> {
  await ecrire(
    baseUrl,
    utile ? 'PUT' : 'DELETE',
    `/${cible}/${segment(id)}/vote`,
    'Ton vote n’a pas pu être enregistré.'
  )
}

/** The question's author keeps the answer that solved it. */
export async function resoudreQuestion(
  baseUrl: string,
  questionId: string,
  reponseId: string
): Promise<void> {
  await ecrire(
    baseUrl,
    'POST',
    `/questions/${segment(questionId)}/reponses/${segment(reponseId)}/resolution`,
    'La question n’a pas pu être marquée comme résolue.'
  )
}
