import { rejoindreClasse as apiRejoindreClasse, RejoindreError } from '@brio/api-client'
import type { EleveInscritInfo, RejoindreClasseInput } from '@brio/api-client'
import { inscrireEleve as apiInscrireEleve, InscrireEleveError } from '@brio/api-client'
import type { InscriptionEleveEnAttenteInfo, InscrireEleveInput } from '@brio/api-client'
import {
  inscrireEnseignant as apiInscrireEnseignant,
  listerEtablissements as apiListerEtablissements,
  InscrireEnseignantError,
} from '@brio/api-client'
import type { CompteInfo, EtablissementPublic, InscrireEnseignantInput } from '@brio/api-client'
import { apiBaseUrl } from '@/lib/api-base-url'

/** Chemin A — join a class with an invitation code. */
export function rejoindreClasse(input: RejoindreClasseInput): Promise<EleveInscritInfo> {
  return apiRejoindreClasse(apiBaseUrl(), input)
}

/** Chemin B — self-signup; account stays locked until parent confirms by email. */
export function inscrireEleve(input: InscrireEleveInput): Promise<InscriptionEleveEnAttenteInfo> {
  return apiInscrireEleve(apiBaseUrl(), input)
}

/** Teacher signup; the account is active at once and logs in with its e-mail. */
export function inscrireEnseignant(input: InscrireEnseignantInput): Promise<CompteInfo> {
  return apiInscrireEnseignant(apiBaseUrl(), input)
}

/** The établissements a teacher may pick at signup. */
export function listerEtablissements(): Promise<EtablissementPublic[]> {
  return apiListerEtablissements(apiBaseUrl())
}

export { RejoindreError }
export type { EleveInscritInfo, RejoindreClasseInput }
export { InscrireEleveError }
export type { InscriptionEleveEnAttenteInfo, InscrireEleveInput }
export { InscrireEnseignantError }
export type { InscrireEnseignantInput }
