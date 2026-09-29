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
export {
  getProgression,
  ProgressionInfoSchema,
  getParcours,
  ParcoursChapitreSchema,
  ParcoursSchema,
  getSerie,
  SerieInfoSchema,
} from './progression.js'
export type { ProgressionInfo, ParcoursChapitre, SerieInfo } from './progression.js'
export {
  listerMesCours,
  getCoursBrouillon,
  creerCours,
  enregistrerCours,
  definirPortees,
  publierCours,
  CoursApiError,
} from './cours-edition.js'
export type {
  CoursResume,
  CoursDetail,
  PublicationResult,
  CreerCoursInput,
  EnregistrerCoursInput,
} from './cours-edition.js'
export { listerMesClasses } from './prof-classes.js'
export type { ClasseInfo } from './prof-classes.js'
export {
  creerDevoir,
  listerDevoirsClasse,
  getTableauDeBord,
  listerMesDevoirs,
  controleActif,
  DevoirEleveVueSchema,
  DevoirClasseVueSchema,
  TableauDeBordDevoirSchema,
  LigneEleveSchema,
  ReussiteCompetenceSchema,
  ControleActifSchema,
  deposerCopie,
  listerPiecesRendu,
  corrigerRendu,
  urlPiece,
  PieceInfoSchema,
} from './devoirs.js'
export type {
  DevoirEleveVue,
  DevoirClasseVue,
  TableauDeBordDevoir,
  LigneEleve,
  ReussiteCompetence,
  CreerDevoirInput,
  ControleActif,
  PieceInfo,
} from './devoirs.js'
export { listerCompetences } from './referentiel.js'
export type { Competence } from './referentiel.js'
export {
  listerAnnales,
  entrainementParCompetence,
  demarrerExamen,
  rendreExamen,
  examenActif,
  AnnaleVueSchema,
  EntrainementExerciceSchema,
  ExamenActifSchema,
  ExamenDemarreSchema,
} from './annales.js'
export type { AnnaleVue, EntrainementExercice, ExamenActif, ExamenDemarre } from './annales.js'
