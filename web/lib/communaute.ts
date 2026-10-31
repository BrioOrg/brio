import { CommunauteError, type AuteurCommunaute } from '@brio/api-client'

// The only subject the server accepts today (CommunauteService.MATIERES, ADR 0035 §7).
export const MATIERES_COMMUNAUTE = [{ code: 'mathematiques', libelle: 'Mathématiques' }]

/** The `niveau` filter value that shows every level. */
export const TOUS_LES_NIVEAUX = 'tous'

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  // Fixed: a thread renders on the server first, then in the browser, and both must agree.
  timeZone: 'Europe/Paris',
})

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** « Renard-Turquoise · 3e ». The class display name never appears in this space (#325). */
export function libelleAuteur(auteur: AuteurCommunaute): string {
  return [auteur.pseudonyme, auteur.niveau].filter(Boolean).join(' · ')
}

export function dateMessage(iso: string): string {
  return FORMAT_DATE.format(new Date(iso))
}

export function libelleMatiere(code: string): string {
  return MATIERES_COMMUNAUTE.find((m) => m.code === code)?.libelle ?? code
}

/** A question URL that cannot name a question: the API takes a UUID and refuses anything else. */
export function estIdQuestion(id: string): boolean {
  return FORMAT_UUID.test(id)
}

/** The URL of the question list for these filters; the first page has no `page`. */
export function urlCommunaute(filtres: { niveau: string; matiere: string; page?: number }): string {
  const params = new URLSearchParams({ niveau: filtres.niveau })
  if (filtres.matiere) params.set('matiere', filtres.matiere)
  if (filtres.page) params.set('page', String(filtres.page))
  return `/communaute?${params.toString()}`
}

/** The French copy to show for a failed Communauté call. */
export function messageErreur(e: unknown, repli: string): string {
  return e instanceof CommunauteError ? e.message : repli
}
