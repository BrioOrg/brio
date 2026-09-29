import { z } from 'zod'

import { CoursApiError } from './cours-edition.js'

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
