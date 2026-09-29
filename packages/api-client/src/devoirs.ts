import { z } from 'zod'

import { CoursApiError } from './cours-edition.js'
import { csrfHeaders, ensureCsrfToken } from './csrf.js'

/**
 * Devoirs client (F4, ADR 0020) — manual Zod wrappers.
 *
 * v1 « devoir maison » : l'enseignant assigne des exercices (issus d'un cours) à sa classe ; le
 * rendu de l'élève est DÉRIVÉ de ses soumissions côté serveur (pas d'upload). Ces appels lisent des
 * chiffres réels — jamais de valeur fabriquée. Toutes les requêtes portent le cookie de session
 * (`credentials: 'include'`) ; la création prime et renvoie le token CSRF, comme le reste.
 *
 * Contrats serveur (fr.brio.devoirs.web) :
 *   POST /api/prof/devoirs                        201 -> { id } · 403 pas l'enseignant de la classe
 *   GET  /api/prof/devoirs?classeId=…             200 -> DevoirClasseVue[]
 *   GET  /api/prof/devoirs/{id}/tableau-de-bord   200 -> TableauDeBordDevoir · 404 · 403
 *   GET  /api/devoirs                             200 -> DevoirEleveVue[] · 401 déconnecté
 */

// --- Réponses validées à la frontière ---

/** Un devoir tel que l'élève connecté le voit (vue « mes devoirs »). */
export const DevoirEleveVueSchema = z.object({
  id: z.string(),
  titre: z.string(),
  consigne: z.string().nullish(),
  echeanceAt: z.string(),
  nombreExercices: z.number(),
  statutRendu: z.string(), // 'non_commence' | 'en_cours' | 'rendu'
})
export type DevoirEleveVue = z.infer<typeof DevoirEleveVueSchema>

/** Un devoir dans la liste d'une classe (côté enseignant). */
export const DevoirClasseVueSchema = z.object({
  id: z.string(),
  titre: z.string(),
  ouvreAt: z.string(),
  echeanceAt: z.string(),
  statut: z.string(),
  nombreExercices: z.number(),
})
export type DevoirClasseVue = z.infer<typeof DevoirClasseVueSchema>

/** Une ligne élève du tableau de bord (statut + score dérivés). */
export const LigneEleveSchema = z.object({
  eleveId: z.string(),
  nomAffiche: z.string(),
  statut: z.string(), // 'non_commence' | 'en_cours' | 'rendu'
  score: z.number().nullish(),
})
export type LigneEleve = z.infer<typeof LigneEleveSchema>

/** La réussite agrégée sur une compétence, tous élèves confondus. */
export const ReussiteCompetenceSchema = z.object({
  code: z.string(),
  tauxReussite: z.number(),
  nombreReponses: z.number(),
})
export type ReussiteCompetence = z.infer<typeof ReussiteCompetenceSchema>

/** Le tableau de bord d'un devoir (compteurs + par élève + par compétence). */
export const TableauDeBordDevoirSchema = z.object({
  devoirId: z.string(),
  titre: z.string(),
  echeanceAt: z.string(),
  total: z.number(),
  nbRendu: z.number(),
  nbEnCours: z.number(),
  nbNonCommence: z.number(),
  moyenne: z.number().nullish(),
  eleves: z.array(LigneEleveSchema),
  parCompetence: z.array(ReussiteCompetenceSchema),
})
export type TableauDeBordDevoir = z.infer<typeof TableauDeBordDevoirSchema>

// --- Entrée de création ---

/** Ce que porte la création d'un devoir. Dates en ISO 8601. */
export type CreerDevoirInput = {
  classeId: string
  titre: string
  consigne?: string
  /** Type de devoir. Défaut serveur : 'devoir_maison'. Un 'controle' coupe le tuteur (ADR 0025). */
  type?: 'devoir_maison' | 'controle'
  sourceType: 'cours' | 'chapitre'
  sourceRef: string
  sourceVersion?: number
  exerciceIds: string[]
  ouvreAt: string
  echeanceAt: string
}

// --- Erreurs : réutilise CoursApiError (statut + copie FR prête à afficher) ---
function devoirError(status: number, fallback: string): CoursApiError {
  const message =
    status === 401
      ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
      : status === 403
        ? "Vous n'êtes pas l'enseignant de cette classe."
        : status === 404
          ? 'Ce devoir est introuvable.'
          : fallback
  return new CoursApiError(status, message)
}

const CreationSchema = z.object({ id: z.string() })

/** Crée un devoir et renvoie son id. L'auteur et l'établissement sont dérivés côté serveur. */
export async function creerDevoir(baseUrl: string, input: CreerDevoirInput): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    ...csrfHeaders(await ensureCsrfToken(baseUrl)),
  }
  const res = await fetch(`${baseUrl}/api/prof/devoirs`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(input),
  })
  if (!res.ok) throw devoirError(res.status, 'Impossible de créer le devoir.')
  return CreationSchema.parse(await res.json()).id
}

/** Les devoirs d'une classe (côté enseignant), pour ouvrir un tableau de bord. */
export async function listerDevoirsClasse(
  baseUrl: string,
  classeId: string
): Promise<DevoirClasseVue[]> {
  const res = await fetch(
    `${baseUrl}/api/prof/devoirs?classeId=${encodeURIComponent(classeId)}`,
    { credentials: 'include' }
  )
  if (!res.ok) throw devoirError(res.status, 'Impossible de charger les devoirs de la classe.')
  return z.array(DevoirClasseVueSchema).parse(await res.json())
}

/** Le tableau de bord d'un devoir (réservé à l'enseignant de la classe). */
export async function getTableauDeBord(
  baseUrl: string,
  devoirId: string
): Promise<TableauDeBordDevoir> {
  const res = await fetch(
    `${baseUrl}/api/prof/devoirs/${encodeURIComponent(devoirId)}/tableau-de-bord`,
    { credentials: 'include' }
  )
  if (!res.ok) throw devoirError(res.status, 'Impossible de charger le tableau de bord.')
  return TableauDeBordDevoirSchema.parse(await res.json())
}

/** Les devoirs de l'élève connecté, ou null s'il n'est pas connecté (401). */
export async function listerMesDevoirs(baseUrl: string): Promise<DevoirEleveVue[] | null> {
  const res = await fetch(`${baseUrl}/api/devoirs`, { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw devoirError(res.status, 'Impossible de charger tes devoirs.')
  return z.array(DevoirEleveVueSchema).parse(await res.json())
}

/** Le contrôle actuellement ouvert pour l'élève connecté (verrouille le tuteur), le cas échéant. */
export const ControleActifSchema = z.object({
  enControle: z.boolean(),
  titre: z.string().nullish(),
  echeanceAt: z.string().nullish(),
})
export type ControleActif = z.infer<typeof ControleActifSchema>

/**
 * Y a-t-il un contrôle ouvert pour l'élève connecté ? Sert à verrouiller le tuteur côté UI — le
 * serveur reste l'autorité (ADR 0025). Pas de contrôle, ou non connecté (401) → enControle: false.
 */
export async function controleActif(baseUrl: string): Promise<ControleActif> {
  const res = await fetch(`${baseUrl}/api/devoirs/controle-actif`, { credentials: 'include' })
  if (res.status === 401) return { enControle: false, titre: null, echeanceAt: null }
  if (!res.ok) throw devoirError(res.status, 'Impossible de vérifier le contrôle en cours.')
  return ControleActifSchema.parse(await res.json())
}
