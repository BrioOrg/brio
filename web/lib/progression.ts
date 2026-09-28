import {
  getProgression as apiGetProgression,
  getParcours as apiGetParcours,
  getSerie as apiGetSerie,
} from '@brio/api-client'
import type { ProgressionInfo, ParcoursChapitre, SerieInfo } from '@brio/api-client'
import { apiBaseUrl } from '@/lib/api-base-url'

// Same env var as lib/api.ts and lib/session.ts — the URL the browser calls.
/** Return the current student's XP total and level, or null when not logged in. */
export function getProgression(): Promise<ProgressionInfo | null> {
  return apiGetProgression(apiBaseUrl())
}

/** Return the student's path state for a track, or null when not logged in. */
export function getParcours(
  niveau: string,
  matiere: string
): Promise<ParcoursChapitre[] | null> {
  return apiGetParcours(apiBaseUrl(), niveau, matiere)
}

/** Return the student's day streak, or null when not logged in. */
export function getSerie(): Promise<SerieInfo | null> {
  return apiGetSerie(apiBaseUrl())
}

export type { ProgressionInfo, ParcoursChapitre, SerieInfo }
