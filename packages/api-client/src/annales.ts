import { z } from 'zod'

import { CoursApiError } from './cours-edition.js'
import { csrfHeaders, ensureCsrfToken } from './csrf.js'

/**
 * Annales client (F7, ADR 0026) — wrappers Zod manuels.
 *
 * Une annale est un « chapitre spécialisé » : on la LIT via l'écran de chapitre
 * (`/{niveau}/{matiere}/{id}`). Ces appels ne servent qu'à la parcourir et à
 * l'entraînement par compétence — jamais de valeur fabriquée, tout vient du serveur.
 *
 * Contrats serveur (fr.brio.contenu.web) :
 *   GET /api/annales                              200 -> AnnaleVue[]
 *   GET /api/annales/entrainement?competence=…    200 -> EntrainementExercice[]
 */

/** Une annale dans la liste (les métadonnées du sujet). */
export const AnnaleVueSchema = z.object({
  id: z.string(),
  titre: z.string(),
  examen: z.string(),
  session: z.string(),
  annee: z.number(),
  centre: z.string().nullish(),
  niveau: z.string(),
  matiere: z.string(),
  dureeMinutes: z.number().nullish(),
})
export type AnnaleVue = z.infer<typeof AnnaleVueSchema>

/** Un exercice d'annale travaillant une compétence donnée (entraînement ciblé). */
export const EntrainementExerciceSchema = z.object({
  exerciceId: z.string(),
  prompt: z.string(),
  exerciseType: z.string(),
  annaleId: z.string(),
  annaleTitre: z.string(),
})
export type EntrainementExercice = z.infer<typeof EntrainementExerciceSchema>

function annaleError(status: number, fallback: string): CoursApiError {
  const message =
    status === 401 ? 'Votre session a expiré. Reconnectez-vous pour continuer.' : fallback
  return new CoursApiError(status, message)
}

/** Toutes les annales publiées (métadonnées), pour l'écran « Annales ». */
export async function listerAnnales(baseUrl: string): Promise<AnnaleVue[]> {
  const res = await fetch(`${baseUrl}/api/annales`, { credentials: 'include' })
  if (!res.ok) throw annaleError(res.status, 'Impossible de charger les annales.')
  return z.array(AnnaleVueSchema).parse(await res.json())
}

/** Les exercices d'annales qui travaillent une compétence (entraînement ciblé). */
export async function entrainementParCompetence(
  baseUrl: string,
  code: string
): Promise<EntrainementExercice[]> {
  const res = await fetch(
    `${baseUrl}/api/annales/entrainement?competence=${encodeURIComponent(code)}`,
    { credentials: 'include' }
  )
  if (!res.ok) throw annaleError(res.status, "Impossible de charger les exercices d'entraînement.")
  return z.array(EntrainementExerciceSchema).parse(await res.json())
}

// --- Mode examen (F7, ADR 0027) ---
//   POST /api/annales/{id}/examen                 200 -> { sessionId, endsAt }
//   POST /api/annales/examen/{sessionId}/rendre   204
//   GET  /api/annales/examen-actif                200 -> ExamenActif

/** L'examen d'annale en cours de l'élève (chrono + verrou tuteur). */
export const ExamenActifSchema = z.object({
  enExamen: z.boolean(),
  sessionId: z.string().nullish(),
  annaleId: z.string().nullish(),
  titre: z.string().nullish(),
  endsAt: z.string().nullish(),
})
export type ExamenActif = z.infer<typeof ExamenActifSchema>

/** Résultat du démarrage d'un examen. */
export const ExamenDemarreSchema = z.object({
  sessionId: z.string(),
  endsAt: z.string(),
})
export type ExamenDemarre = z.infer<typeof ExamenDemarreSchema>

/** Démarre (ou reprend) un examen chronométré sur une annale. */
export async function demarrerExamen(baseUrl: string, annaleId: string): Promise<ExamenDemarre> {
  const token = await ensureCsrfToken(baseUrl)
  const res = await fetch(`${baseUrl}/api/annales/${encodeURIComponent(annaleId)}/examen`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfHeaders(token),
  })
  if (!res.ok) throw annaleError(res.status, "Impossible de démarrer l'examen.")
  return ExamenDemarreSchema.parse(await res.json())
}

/** Termine (rend) une session d'examen. */
export async function rendreExamen(baseUrl: string, sessionId: string): Promise<void> {
  const token = await ensureCsrfToken(baseUrl)
  const res = await fetch(
    `${baseUrl}/api/annales/examen/${encodeURIComponent(sessionId)}/rendre`,
    { method: 'POST', credentials: 'include', headers: csrfHeaders(token) }
  )
  if (!res.ok) throw annaleError(res.status, "Impossible de rendre l'examen.")
}

/** L'examen en cours de l'élève (pour le bandeau/chrono + verrou tuteur). Résilient : pas de verrou si l'appel échoue. */
export async function examenActif(baseUrl: string): Promise<ExamenActif> {
  const res = await fetch(`${baseUrl}/api/annales/examen-actif`, { credentials: 'include' })
  if (!res.ok) return { enExamen: false, sessionId: null, annaleId: null, titre: null, endsAt: null }
  return ExamenActifSchema.parse(await res.json())
}
