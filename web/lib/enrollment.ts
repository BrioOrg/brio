import { rejoindreClasse as apiRejoindreClasse, RejoindreError } from '@brio/api-client'
import type { EleveInscritInfo, RejoindreClasseInput } from '@brio/api-client'
import { inscrireEleve as apiInscrireEleve, InscrireEleveError } from '@brio/api-client'
import type { InscriptionEleveEnAttenteInfo, InscrireEleveInput } from '@brio/api-client'
import { apiBaseUrl } from '@/lib/api-base-url'

/** Chemin A — join a class with an invitation code. */
export function rejoindreClasse(input: RejoindreClasseInput): Promise<EleveInscritInfo> {
  return apiRejoindreClasse(apiBaseUrl(), input)
}

/** Chemin B — self-signup; account stays locked until parent confirms by email. */
export function inscrireEleve(input: InscrireEleveInput): Promise<InscriptionEleveEnAttenteInfo> {
  return apiInscrireEleve(apiBaseUrl(), input)
}

export { RejoindreError }
export type { EleveInscritInfo, RejoindreClasseInput }
export { InscrireEleveError }
export type { InscriptionEleveEnAttenteInfo, InscrireEleveInput }
