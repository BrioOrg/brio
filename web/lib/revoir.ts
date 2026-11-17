import { LeconCompetenceSchema, type LeconCompetence } from '@brio/api-client'

import { apiBaseUrl } from '@/lib/api-base-url'

/**
 * Server-side read of the lesson that works a competence, relaying the request's cookies. Null for
 * a failure and for a 204: the "À revoir" block is then dropped, never pointed at a guess.
 */
export async function lireLecon(
  code: string,
  niveau: string | null | undefined,
  cookie: string
): Promise<LeconCompetence | null> {
  const params = new URLSearchParams({ competence: code })
  if (niveau) params.set('niveau', niveau)
  try {
    const res = await fetch(`${apiBaseUrl()}/api/referentiel/lecon?${params.toString()}`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok || res.status === 204) return null
    const parsed = LeconCompetenceSchema.safeParse(await res.json())
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** The reader's address for a lesson: its chapter, opened on the slide of that lesson. */
export function hrefLecon(l: LeconCompetence): string {
  return `/${l.niveauCode}/${l.matiereCode}/${l.chapitreId}?diapo=${encodeURIComponent(l.sectionId)}`
}
