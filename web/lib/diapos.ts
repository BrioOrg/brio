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

/** What a marker of the side strip leads to: position, kind and, inside a section, its title. */
export function libelleDiapo(
  diapo: Diapo,
  index: number,
  total: number,
  sectionTitles: Readonly<Record<string, string>>
): string {
  const parts = [`Diapo ${index + 1} sur ${total}`, KIND_LABEL[diapo.kind]]
  if ('sectionId' in diapo && sectionTitles[diapo.sectionId]) {
    parts.push(sectionTitles[diapo.sectionId])
  }
  return parts.join(' · ')
}

/** The current URL with `?diapo` set to `id`, or removed when `id` is null. Keeps the rest. */
export function urlAvecDiapo(href: string, id: string | null): string {
  const url = new URL(href)
  if (id === null) url.searchParams.delete('diapo')
  else url.searchParams.set('diapo', id)
  return `${url.pathname}${url.search}${url.hash}`
}
