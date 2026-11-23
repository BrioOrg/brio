import type { Diapo } from '@brio/content'

/**
 * Navigation in a chapter's deck (ADR 0032 §3–5): pure, no React, so the page (server) and the
 * interactive shell (client) resolve a slide the same way.
 */

/** Device preference for a chapter's mode (ADR 0032 §5). Only the switch button writes it. */
export const MODE_COOKIE = 'brio_mode_chapitre'

export type ModeChapitre = 'lecture' | 'interactif'

/** `?diapo` implies the interactive mode; otherwise the cookie; no cookie means interactive. */
export function modeInitial(diapo: string | undefined, cookie: string | undefined): ModeChapitre {
  if (diapo !== undefined) return 'interactif'
  return cookie === 'lecture' ? 'lecture' : 'interactif'
}

/**
 * The value of the mode cookie in a `document.cookie` string, read as the server reads it (Next's
 * `parseCookie`): the last occurrence wins, URI-decoded. Undefined when it is not set.
 */
export function modeDuCookie(cookies: string): string | undefined {
  let valeur: string | undefined
  for (const part of cookies.split(';')) {
    const egal = part.indexOf('=')
    if (egal === -1 || part.slice(0, egal).trim() !== MODE_COOKIE) continue
    try {
      valeur = decodeURIComponent(part.slice(egal + 1).trim())
    } catch {
      // Malformed: skipped, as Next skips it.
    }
  }
  return valeur
}

/** The mode and slide the interactive shell shows. */
export type EtatChapitre = { mode: ModeChapitre; index: number }

/**
 * What the chapter shows once mounted on the client (ADR 0046 §4): the address wins over the
 * server props, which a back/forward traversal may serve from an older render. A `?diapo` sets the
 * interactive mode on the slide it resolves to; without it, a cookie sets the mode; where both are
 * silent, the props stay. Without `?diapo` the address names no slide: the index stays the props'.
 * A repeated `?diapo` counts as absent, as on the server (which then receives an array).
 * Returns `props` itself when nothing changes.
 */
export function etatAuMontage(
  deck: readonly Diapo[],
  props: EtatChapitre,
  search: string,
  cookie: string | undefined
): EtatChapitre {
  const diapos = new URLSearchParams(search).getAll('diapo')
  const diapo = diapos.length === 1 ? diapos[0] : null
  const voulu: EtatChapitre =
    diapo !== null
      ? { mode: 'interactif', index: indexDiapo(deck, diapo) }
      : cookie !== undefined
        ? { mode: modeInitial(undefined, cookie), index: props.index }
        : props
  return voulu.mode === props.mode && voulu.index === props.index ? props : voulu
}

/**
 * The index of the slide `id` designates: the slide itself, else the slide holding that block
 * (a link made before the content changed), else the first slide of that section (an in-page
 * `#section` anchor), else `debut`, which is always index 0.
 */
export function indexDiapo(deck: readonly Diapo[], id: string | null | undefined): number {
  if (!id) return 0
  const exact = deck.findIndex((d) => d.id === id)
  if (exact !== -1) return exact
  const holding = deck.findIndex((d) => (d.blockIds as readonly string[]).includes(id))
  if (holding !== -1) return holding
  const section = deck.findIndex((d) => 'sectionId' in d && d.sectionId === id)
  return section === -1 ? 0 : section
}

/** The section a forward move out of slide `index` finishes, if it is that section's last slide. */
export function sectionTerminee(deck: readonly Diapo[], index: number): string | null {
  const diapo = deck[index]
  if (!diapo || !('sectionId' in diapo)) return null
  const next = deck[index + 1]
  return next && 'sectionId' in next && next.sectionId === diapo.sectionId ? null : diapo.sectionId
}

const KIND_LABEL: Record<Diapo['kind'], string> = {
  debut: 'Ouverture',
  lecon: 'Leçon',
  exercice: 'Exercice',
  fin: 'Fin du chapitre',
}

/** A teacher course's end slide says « cours » (ADR 0050 §7). */
const FIN_DU_COURS = 'Fin du cours'

/**
 * Where an exercise slide stands in this session (#246): solved, or seen and left with no answer.
 * `null` says nothing: not an auto-graded exercise, not seen yet, current, or tried.
 */
export type EtatDiapo = 'resolu' | 'sans-reponse' | null

/** Per-block exercise state, as the interactive shell keeps it for the session. */
type EtatsExercices = Readonly<Record<string, 'a-faire' | 'tente' | 'resolu'>>

export function etatDiapo(
  diapo: Diapo,
  courante: boolean,
  exercices: EtatsExercices,
  vues: ReadonlySet<string>
): EtatDiapo {
  const etats = (diapo.blockIds as readonly string[])
    .map((id) => exercices[id])
    .filter((e) => e !== undefined)
  if (etats.length === 0) return null
  if (etats.every((e) => e === 'resolu')) return 'resolu'
  if (!courante && vues.has(diapo.id) && etats.every((e) => e === 'a-faire')) {
    return 'sans-reponse'
  }
  return null
}

const ETAT_LABEL: Record<Exclude<EtatDiapo, null>, string> = {
  resolu: 'Réussi',
  'sans-reponse': 'Sans réponse',
}

/** What a marker of the side strip leads to: position, kind, its section's title, its state. */
export function libelleDiapo(
  diapo: Diapo,
  index: number,
  total: number,
  sectionTitles: Readonly<Record<string, string>>,
  etat: EtatDiapo = null,
  nature: 'chapitre' | 'cours' = 'chapitre'
): string {
  const kind = diapo.kind === 'fin' && nature === 'cours' ? FIN_DU_COURS : KIND_LABEL[diapo.kind]
  const parts = [`Diapo ${index + 1} sur ${total}`, kind]
  if ('sectionId' in diapo && sectionTitles[diapo.sectionId]) {
    parts.push(sectionTitles[diapo.sectionId])
  }
  if (etat) parts.push(ETAT_LABEL[etat])
  return parts.join(' · ')
}

/** The current URL with `?diapo` set to `id`, or removed when `id` is null. Keeps the rest. */
export function urlAvecDiapo(href: string, id: string | null): string {
  const url = new URL(href)
  if (id === null) url.searchParams.delete('diapo')
  else url.searchParams.set('diapo', id)
  return `${url.pathname}${url.search}${url.hash}`
}
