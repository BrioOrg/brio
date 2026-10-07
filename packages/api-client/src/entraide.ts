import { z } from 'zod'

import { csrfHeaders, ensureCsrfToken } from './csrf.js'

/**
 * Entraide client (F6a, ADR 0023) — manual Zod wrappers.
 *
 * Threads hang off a catalogue chapter (`portee: 'chapitre'`, ref = slug) or an exercise
 * (`portee: 'exercice'`, ref = exercise UUID), and are visible to one class. The server is
 * the authority on the anti-cheat guard: on an exercise thread the reader has not submitted,
 * `verrouille` is true and other answers are simply absent from `messages`.
 *
 * Server contracts (fr.brio.social.web, fr.brio.identite.web):
 *   GET  /api/moi/classes                                  200 -> ClasseInfo[]
 *   GET  /api/entraide?portee=…&ref=…&classeId=…           200 -> FilVue[] · 403 not a member
 *   POST /api/entraide                                     201 -> { id }
 *   GET  /api/entraide/{filId}                             200 -> FilDetail · 404 · 403
 *   POST /api/entraide/{filId}/reponses                    201 -> { id }
 *   POST /api/entraide/{filId}/messages/{messageId}/utile  204
 *   POST /api/entraide/messages/{messageId}/signalement    204
 *   GET  /api/prof/entraide/signalements                   200 -> SignalementVue[]
 *   POST /api/prof/entraide/messages/{messageId}/masquer   204
 *   POST /api/prof/entraide/sanctions                      201 -> { id }
 *
 * Business errors come back as `{ error }` in French (422 invalid message, 429 writing too
 * fast, 403 read-only sanction); that text is shown as-is.
 */

// --- Responses validated at the boundary ---

/** A class the caller belongs to (a student's enrolment, or a class a teacher runs). */
export const MaClasseSchema = z.object({
  id: z.string(),
  libelle: z.string(),
  niveauCode: z.string(),
})
export type MaClasse = z.infer<typeof MaClasseSchema>

export const FilVueSchema = z.object({
  id: z.string(),
  portee: z.string(),
  porteeRef: z.string(),
  titre: z.string(),
  auteurId: z.string(),
  auteurNom: z.string(),
  statut: z.string(),
  resolu: z.boolean(),
  nbReponses: z.number(),
  createdAt: z.string(),
})
export type FilVue = z.infer<typeof FilVueSchema>

export const MessageVueSchema = z.object({
  id: z.string(),
  auteurId: z.string(),
  auteurNom: z.string(),
  corps: z.string(),
  statut: z.string(),
  utile: z.boolean(),
  estMoi: z.boolean(),
  createdAt: z.string(),
})
export type MessageVue = z.infer<typeof MessageVueSchema>

export const FilDetailSchema = z.object({
  id: z.string(),
  portee: z.string(),
  porteeRef: z.string(),
  titre: z.string(),
  auteurId: z.string(),
  auteurNom: z.string(),
  statut: z.string(),
  estAuteur: z.boolean(),
  verrouille: z.boolean(),
  reponsesMasquees: z.number(),
  messages: z.array(MessageVueSchema),
  createdAt: z.string(),
})
export type FilDetail = z.infer<typeof FilDetailSchema>

export const SignalementVueSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  filId: z.string(),
  classeId: z.string(),
  filTitre: z.string(),
  auteurMessageId: z.string(),
  auteurMessageNom: z.string(),
  extraitMessage: z.string(),
  signalePar: z.string(),
  motif: z.string().nullish(),
  createdAt: z.string(),
})
export type SignalementVue = z.infer<typeof SignalementVueSchema>

// --- Inputs ---

export type PorteeEntraide = 'chapitre' | 'exercice'

export type OuvrirFilInput = {
  portee: PorteeEntraide
  porteeRef: string
  classeId: string
  titre: string
  question: string
}

export type TypeSanction = 'avertissement' | 'lecture_seule'

export type SanctionnerInput = {
  compteId: string
  classeId: string
  type: TypeSanction
  motif?: string
  /** ISO 8601; absent = no end date. */
  fin?: string
}

// --- Errors ---

/** An entraide call failed; `message` is French copy ready to display. */
export class EntraideError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'EntraideError'
  }
}

const ErreurServeurSchema = z.object({ error: z.string() })

async function entraideError(res: Response, fallback: string): Promise<EntraideError> {
  if (res.status === 401) {
    return new EntraideError(401, 'Ta session a expiré. Reconnecte-toi pour continuer.')
  }
  // 403/404/422/429 carry a precise French message from SocialExceptionHandler.
  try {
    const body = ErreurServeurSchema.safeParse(await res.json())
    if (body.success) return new EntraideError(res.status, body.data.error)
  } catch {
    /* no JSON body: fall back */
  }
  return new EntraideError(res.status, fallback)
}

const CreationSchema = z.object({ id: z.string() })

async function post(baseUrl: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = csrfHeaders(await ensureCsrfToken(baseUrl))
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// --- Member side ---

/** The caller's classes; empty when logged out or in no class. */
export async function mesClasses(baseUrl: string): Promise<MaClasse[]> {
  const res = await fetch(`${baseUrl}/api/moi/classes`, { credentials: 'include' })
  if (res.status === 401) return []
  if (!res.ok) throw await entraideError(res, 'Impossible de charger tes classes.')
  return z.array(MaClasseSchema).parse(await res.json())
}

/** The threads of a chapter or an exercise in one class, newest first. */
export async function listerFils(
  baseUrl: string,
  portee: PorteeEntraide,
  ref: string,
  classeId: string
): Promise<FilVue[]> {
  const query = new URLSearchParams({ portee, ref, classeId })
  const res = await fetch(`${baseUrl}/api/entraide?${query}`, { credentials: 'include' })
  if (!res.ok) throw await entraideError(res, 'Impossible de charger les questions.')
  return z.array(FilVueSchema).parse(await res.json())
}

/** Opens a thread (asks a question) and returns its id. */
export async function ouvrirFil(baseUrl: string, input: OuvrirFilInput): Promise<string> {
  const res = await post(baseUrl, '/api/entraide', input)
  if (!res.ok) throw await entraideError(res, "Impossible d'envoyer ta question.")
  return CreationSchema.parse(await res.json()).id
}

/** A thread and its messages, as the server lets this reader see them. */
export async function consulterFil(baseUrl: string, filId: string): Promise<FilDetail> {
  const res = await fetch(`${baseUrl}/api/entraide/${encodeURIComponent(filId)}`, {
    credentials: 'include',
  })
  if (!res.ok) throw await entraideError(res, 'Impossible de charger cette question.')
  return FilDetailSchema.parse(await res.json())
}

/** Answers in a thread and returns the new message id. */
export async function repondre(baseUrl: string, filId: string, corps: string): Promise<string> {
  const res = await post(baseUrl, `/api/entraide/${encodeURIComponent(filId)}/reponses`, {
    corps,
  })
  if (!res.ok) throw await entraideError(res, "Impossible d'envoyer ta réponse.")
  return CreationSchema.parse(await res.json()).id
}

/** The thread author keeps an answer as useful. */
export async function marquerUtile(
  baseUrl: string,
  filId: string,
  messageId: string
): Promise<void> {
  const res = await post(
    baseUrl,
    `/api/entraide/${encodeURIComponent(filId)}/messages/${encodeURIComponent(messageId)}/utile`
  )
  if (!res.ok) throw await entraideError(res, 'Impossible de retenir cette réponse.')
}

/** Reports a message to the class moderator. Idempotent per reporter. */
export async function signaler(baseUrl: string, messageId: string, motif?: string): Promise<void> {
  const res = await post(
    baseUrl,
    `/api/entraide/messages/${encodeURIComponent(messageId)}/signalement`,
    { motif: motif?.trim() ? motif.trim() : null }
  )
  if (!res.ok) throw await entraideError(res, 'Impossible de signaler ce message.')
}

// --- Moderator side (teacher of the class) ---

/** Open reports for the classes the teacher moderates, oldest first. */
export async function fileSignalements(baseUrl: string): Promise<SignalementVue[]> {
  const res = await fetch(`${baseUrl}/api/prof/entraide/signalements`, {
    credentials: 'include',
  })
  if (!res.ok) throw await entraideError(res, 'Impossible de charger les signalements.')
  return z.array(SignalementVueSchema).parse(await res.json())
}

/** Hides a message and closes its reports. */
export async function masquerMessage(baseUrl: string, messageId: string): Promise<void> {
  const res = await post(
    baseUrl,
    `/api/prof/entraide/messages/${encodeURIComponent(messageId)}/masquer`
  )
  if (!res.ok) throw await entraideError(res, 'Impossible de masquer ce message.')
}

/** Applies a sanction to a student of the class. */
export async function sanctionner(baseUrl: string, input: SanctionnerInput): Promise<string> {
  const res = await post(baseUrl, '/api/prof/entraide/sanctions', input)
  if (!res.ok) throw await entraideError(res, "Impossible d'appliquer la sanction.")
  return CreationSchema.parse(await res.json()).id
}
