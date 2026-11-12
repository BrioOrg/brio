import { z } from 'zod'

import { csrfHeaders, ensureCsrfToken } from './csrf.js'
import { signalerSessionExpiree } from './session-expiree.js'

/**
 * Console de modération de la Communauté (suivi #338, ADR 0035) — wrappers Zod manuels.
 *
 * Côté membre (sous `brio.communaute.active`, rôle élève) : signaler un contenu, contester une
 * décision. Côté `admin_brio` (`/api/admin/communaute/**`) : la file des signalements, les
 * décisions, les contestations et la révocation d'XP. Les auteurs ne sont montrés que par leur
 * pseudonyme (#325).
 *
 * Contrats serveur (fr.brio.social.web) :
 *   POST /api/communaute/questions/{id}/signalement         204
 *   POST /api/communaute/reponses/{id}/signalement          204
 *   POST /api/communaute/questions/{id}/contestation        201 -> { id } · 403 · 404 · 422
 *   POST /api/communaute/reponses/{id}/contestation         201 -> { id } · 403 · 404 · 422
 *   GET  /api/admin/communaute/signalements                 200 -> SignalementCommunauteVue[]
 *   POST /api/admin/communaute/{cibleType}/{cibleId}/decision   201 -> { id } · 404 · 422
 *   GET  /api/admin/communaute/contestations                200 -> ContestationModerationVue[]
 *   POST /api/admin/communaute/contestations/{id}           204 · 404 · 422
 *
 * Les erreurs métier reviennent en `{ error }` en français ; ce texte est affiché tel quel.
 */

// --- Réponses validées à la frontière ---

export const CibleTypeSchema = z.enum(['question', 'reponse'])
export type CibleType = z.infer<typeof CibleTypeSchema>

export const SignalementCommunauteVueSchema = z.object({
  cibleType: CibleTypeSchema,
  cibleId: z.string(),
  questionId: z.string(),
  auteurPseudonyme: z.string(),
  extrait: z.string(),
  statutContenu: z.string(),
  estReponseResolue: z.boolean(),
  xpDejaRevoquee: z.boolean(),
  nombreSignalements: z.number(),
  motifs: z.array(z.string()),
  premierSignalementAt: z.string(),
})
export type SignalementCommunauteVue = z.infer<typeof SignalementCommunauteVueSchema>

export const ContestationModerationVueSchema = z.object({
  id: z.string(),
  cibleType: CibleTypeSchema,
  cibleId: z.string(),
  questionId: z.string(),
  auteurPseudonyme: z.string(),
  extrait: z.string(),
  message: z.string(),
  decisionAction: z.string().nullish(),
  decisionMotif: z.string().nullish(),
  statutContenu: z.string().nullish(),
  createdAt: z.string(),
})
export type ContestationModerationVue = z.infer<typeof ContestationModerationVueSchema>

// --- Entrées ---

/** Les actions qu'un admin peut décider sur un contenu. */
export type ActionModeration = 'masquer' | 'supprimer' | 'rejeter' | 'restaurer' | 'revoquer_xp'

// --- Erreurs ---

/** Un appel de modération a échoué ; `message` est du texte français prêt à afficher. */
export class ModerationError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ModerationError'
  }
}

const ErreurServeurSchema = z.object({ error: z.string() })

async function moderationError(res: Response, fallback: string): Promise<ModerationError> {
  if (res.status === 401) {
    signalerSessionExpiree()
    return new ModerationError(401, 'Ta session a expiré. Reconnecte-toi pour continuer.')
  }
  try {
    const body = ErreurServeurSchema.safeParse(await res.json())
    if (body.success) return new ModerationError(res.status, body.data.error)
  } catch {
    /* pas de corps JSON : repli */
  }
  return new ModerationError(res.status, fallback)
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

// --- Côté membre ---

/** Signale une question ou une réponse. Idempotent par membre. */
export async function signalerContenu(
  baseUrl: string,
  cibleType: CibleType,
  cibleId: string,
  motif?: string
): Promise<void> {
  const chemin = cibleType === 'question' ? 'questions' : 'reponses'
  const res = await post(
    baseUrl,
    `/api/communaute/${chemin}/${encodeURIComponent(cibleId)}/signalement`,
    {
      motif: motif?.trim() ? motif.trim() : null,
    }
  )
  if (!res.ok) throw await moderationError(res, 'Impossible de signaler ce contenu.')
}

/** Conteste la décision de modération sur son propre contenu masqué ou supprimé. */
export async function contesterDecision(
  baseUrl: string,
  cibleType: CibleType,
  cibleId: string,
  message: string
): Promise<string> {
  const chemin = cibleType === 'question' ? 'questions' : 'reponses'
  const res = await post(
    baseUrl,
    `/api/communaute/${chemin}/${encodeURIComponent(cibleId)}/contestation`,
    {
      message,
    }
  )
  if (!res.ok) throw await moderationError(res, "Impossible d'envoyer ta contestation.")
  return CreationSchema.parse(await res.json()).id
}

// --- Côté admin_brio ---

/** La file des contenus signalés, agrégés par cible, les plus anciens d'abord. */
export async function fileSignalementsCommunaute(
  baseUrl: string
): Promise<SignalementCommunauteVue[]> {
  const res = await fetch(`${baseUrl}/api/admin/communaute/signalements`, {
    credentials: 'include',
  })
  if (!res.ok) throw await moderationError(res, 'Impossible de charger les signalements.')
  return z.array(SignalementCommunauteVueSchema).parse(await res.json())
}

/** Décide sur un contenu : masquer, supprimer, rejeter, restaurer ou révoquer l'XP. */
export async function deciderModeration(
  baseUrl: string,
  cibleType: CibleType,
  cibleId: string,
  action: ActionModeration,
  motif?: string
): Promise<string> {
  const res = await post(
    baseUrl,
    `/api/admin/communaute/${cibleType}/${encodeURIComponent(cibleId)}/decision`,
    { action, motif: motif?.trim() ? motif.trim() : null }
  )
  if (!res.ok) throw await moderationError(res, "Impossible d'appliquer la décision.")
  return CreationSchema.parse(await res.json()).id
}

/** Les contestations ouvertes, les plus anciennes d'abord. */
export async function fileContestationsCommunaute(
  baseUrl: string
): Promise<ContestationModerationVue[]> {
  const res = await fetch(`${baseUrl}/api/admin/communaute/contestations`, {
    credentials: 'include',
  })
  if (!res.ok) throw await moderationError(res, 'Impossible de charger les contestations.')
  return z.array(ContestationModerationVueSchema).parse(await res.json())
}

/** Tranche une contestation : accepter restaure le contenu, rejeter laisse la décision en place. */
export async function trancherContestation(
  baseUrl: string,
  contestationId: string,
  accepter: boolean,
  reponse?: string
): Promise<void> {
  const res = await post(
    baseUrl,
    `/api/admin/communaute/contestations/${encodeURIComponent(contestationId)}`,
    {
      accepter,
      reponse: reponse?.trim() ? reponse.trim() : null,
    }
  )
  if (!res.ok) throw await moderationError(res, 'Impossible de traiter cette contestation.')
}
