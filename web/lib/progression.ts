import {
  getProgression as apiGetProgression,
  getParcours as apiGetParcours,
} from '@brio/api-client'
import type { ProgressionInfo, ParcoursChapitre } from '@brio/api-client'

// Same env var as lib/api.ts and lib/session.ts — the URL the browser calls.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

/** Return the current student's XP total and level, or null when not logged in. */
export function getProgression(): Promise<ProgressionInfo | null> {
  return apiGetProgression(API_URL)
}

/** Return the student's path state for a track, or null when not logged in. */
export function getParcours(
  niveau: string,
  matiere: string
): Promise<ParcoursChapitre[] | null> {
  return apiGetParcours(API_URL, niveau, matiere)
}

export type { ProgressionInfo, ParcoursChapitre }
