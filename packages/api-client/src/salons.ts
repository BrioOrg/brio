import { z } from 'zod'

import { csrfHeaders, ensureCsrfToken } from './csrf.js'

/**
 * Messagerie de classe client (F6b, ADR 0033) — manual Zod wrappers.
 *
 * A salon is one group chat per class, opened by the teacher. Every member of the class — the
 * students and the teacher — reads and writes it; there are no private messages. Moderation is
 * the entraide one (F6a): the server prevents links, over-long and flooded messages, a reader
 * reports a message, the teacher hides it. A hidden message is simply absent from `messages`.
 *
 * Server contracts (fr.brio.social.web):
 *   GET  /api/salons                                        200 -> SalonVue[]  (my classes' salons)
 *   GET  /api/salons/{salonId}/messages                     200 -> SalonMessageVue[] · 403 · 404
 *   POST /api/salons/{salonId}/messages                     201 -> { id } · 403 · 422 · 429
 *   POST /api/salons/messages/{messageId}/signalement       204
 *   POST /api/prof/salons                                   201 -> { id }
 *   GET  /api/prof/salons/signalements                      200 -> SalonSignalementVue[]
 *   POST /api/prof/salons/messages/{messageId}/masquer      204
 *
 * The caller's classes come from `mesClasses` (shared with entraide). Business errors come back
 * as `{ error }` in French (403 read-only sanction, 422 invalid message, 429 writing too fast);
 * that text is shown as-is.
 */

// --- Responses validated at the boundary ---

/** A class salon, in the list of a member's salons. */
export const SalonVueSchema = z.object({
  id: z.string(),
  classeId: z.string(),
  titre: z.string(),
  statut: z.string(),
  nbMessages: z.number(),
  createdAt: z.string(),
})
export type SalonVue = z.infer<typeof SalonVueSchema>

/** A salon message, as the reader sees it. */
export const SalonMessageVueSchema = z.object({
  id: z.string(),
  auteurId: z.string(),
  auteurNom: z.string(),
  corps: z.string(),
  statut: z.string(),
  estMoi: z.boolean(),
  createdAt: z.string(),
})
export type SalonMessageVue = z.infer<typeof SalonMessageVueSchema>

/** A pending salon report, in the teacher's moderation queue. */
export const SalonSignalementVueSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  salonId: z.string(),
  salonTitre: z.string(),
  auteurMessageId: z.string(),
  auteurMessageNom: z.string(),
  extraitMessage: z.string(),
  signalePar: z.string(),
  motif: z.string().nullish(),
  createdAt: z.string(),
})
export type SalonSignalementVue = z.infer<typeof SalonSignalementVueSchema>

// --- Inputs ---

export type CreerSalonInput = {
  classeId: string
  titre: string
}

// --- Errors ---

/** A messagerie call failed; `message` is French copy ready to display. */
export class MessagerieError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'MessagerieError'
  }
}

const ErreurServeurSchema = z.object({ error: z.string() })

async function messagerieError(res: Response, fallback: string): Promise<MessagerieError> {
  if (res.status === 401) {
    return new MessagerieError(401, 'Ta session a expiré. Reconnecte-toi pour continuer.')
  }
  // 403/404/422/429 carry a precise French message from SocialExceptionHandler.
  try {
    const body = ErreurServeurSchema.safeParse(await res.json())
    if (body.success) return new MessagerieError(res.status, body.data.error)
  } catch {
    /* no JSON body: fall back */
  }
  return new MessagerieError(res.status, fallback)
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

// --- Member side (student or teacher of the class) ---

/** The salons of all the caller's classes, newest first. Empty when logged out or in no class. */
export async function listerSalons(baseUrl: string): Promise<SalonVue[]> {
  const res = await fetch(`${baseUrl}/api/salons`, { credentials: 'include' })
  if (res.status === 401) return []
  if (!res.ok) throw await messagerieError(res, 'Impossible de charger le salon de ta classe.')
  return z.array(SalonVueSchema).parse(await res.json())
}

/** The messages of a salon, oldest first, moderated for this reader. */
export async function messagesDuSalon(
  baseUrl: string,
  salonId: string
): Promise<SalonMessageVue[]> {
  const res = await fetch(`${baseUrl}/api/salons/${encodeURIComponent(salonId)}/messages`, {
    credentials: 'include',
  })
  if (!res.ok) throw await messagerieError(res, 'Impossible de charger les messages.')
  return z.array(SalonMessageVueSchema).parse(await res.json())
}

/** Publishes a message in a salon and returns its id. */
export async function publierDansSalon(
  baseUrl: string,
  salonId: string,
  corps: string
): Promise<string> {
  const res = await post(baseUrl, `/api/salons/${encodeURIComponent(salonId)}/messages`, { corps })
  if (!res.ok) throw await messagerieError(res, "Impossible d'envoyer ton message.")
  return CreationSchema.parse(await res.json()).id
}

/** Reports a salon message to the class moderator. Idempotent per reporter. */
export async function signalerMessageSalon(
  baseUrl: string,
  messageId: string,
  motif?: string
): Promise<void> {
  const res = await post(
    baseUrl,
    `/api/salons/messages/${encodeURIComponent(messageId)}/signalement`,
    { motif: motif?.trim() ? motif.trim() : null }
  )
  if (!res.ok) throw await messagerieError(res, 'Impossible de signaler ce message.')
}

// --- Teacher side ---

/** Opens the salon of one of the teacher's classes and returns its id. */
export async function creerSalon(baseUrl: string, input: CreerSalonInput): Promise<string> {
  const res = await post(baseUrl, '/api/prof/salons', input)
  if (!res.ok) throw await messagerieError(res, "Impossible d'ouvrir le salon.")
  return CreationSchema.parse(await res.json()).id
}

/** Open salon reports for the classes the teacher moderates, oldest first. */
export async function fileSignalementsSalon(baseUrl: string): Promise<SalonSignalementVue[]> {
  const res = await fetch(`${baseUrl}/api/prof/salons/signalements`, { credentials: 'include' })
  if (!res.ok) throw await messagerieError(res, 'Impossible de charger les signalements.')
  return z.array(SalonSignalementVueSchema).parse(await res.json())
}

/** Hides a salon message and closes its reports. */
export async function masquerMessageSalon(baseUrl: string, messageId: string): Promise<void> {
  const res = await post(
    baseUrl,
    `/api/prof/salons/messages/${encodeURIComponent(messageId)}/masquer`
  )
  if (!res.ok) throw await messagerieError(res, 'Impossible de masquer ce message.')
}
