import { rejoindreClasse as apiRejoindreClasse, RejoindreError } from '@brio/api-client'
import type { EleveInscritInfo, RejoindreClasseInput } from '@brio/api-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

/** Chemin A — join a class with an invitation code. */
export function rejoindreClasse(input: RejoindreClasseInput): Promise<EleveInscritInfo> {
  return apiRejoindreClasse(API_URL, input)
}

export { RejoindreError }
export type { EleveInscritInfo, RejoindreClasseInput }
