export { createApiClient } from './client.js'
export type { paths, components, operations } from './generated/schema.js'
export { login, logout, getMoi, LoginError, CompteInfoSchema } from './session.js'
export type { CompteInfo } from './session.js'
export { ensureCsrfToken, csrfHeaders, readXsrfToken } from './csrf.js'
export { rejoindreClasse, RejoindreError, EleveInscritInfoSchema } from './enrollment.js'
export type { EleveInscritInfo, RejoindreClasseInput } from './enrollment.js'
export {
  inscrireEleve,
  InscrireEleveError,
  InscriptionEleveEnAttenteInfoSchema,
} from './enrollment.js'
export type { InscriptionEleveEnAttenteInfo, InscrireEleveInput } from './enrollment.js'
export { getProgression, ProgressionInfoSchema } from './progression.js'
export type { ProgressionInfo } from './progression.js'
