export { createApiClient } from './client.js'
export type { paths, components, operations } from './generated/schema.js'
export { login, logout, getMoi, LoginError, LogoutError, CompteInfoSchema } from './session.js'
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
  inscrireEnseignant,
  InscrireEnseignantError,
  listerEtablissements,
  EtablissementPublicSchema,
} from './enrollment.js'
export type { InscrireEnseignantInput, EtablissementPublic } from './enrollment.js'
export {
  getProgression,
  ProgressionInfoSchema,
  getParcours,
  ParcoursChapitreSchema,
  ParcoursSchema,
  getSerie,
  SerieInfoSchema,
  ChapitreAReprendreSchema,
  MaitriseInfoSchema,
} from './progression.js'
export type {
  ProgressionInfo,
  ParcoursChapitre,
  SerieInfo,
  ChapitreAReprendre,
  MaitriseInfo,
} from './progression.js'
export {
  listerMesCours,
  getCoursBrouillon,
  creerCours,
  enregistrerCours,
  definirPortees,
  publierCours,
  sectionsDuChapitrePublie,
  CoursApiError,
  ViolationContenuSchema,
} from './cours-edition.js'
export type {
  CoursResume,
  CoursDetail,
  PublicationResult,
  CreerCoursInput,
  EnregistrerCoursInput,
  ViolationContenu,
} from './cours-edition.js'
export {
  listerMesClasses,
  listerMesEtablissements,
  rattacherEtablissement,
  creerMaClasse,
  genererCodeClasse,
  getCodeClasse,
  listerInscrits,
  renommerEleve,
  CodeClasseCreeeSchema,
  CodeClasseInfoSchema,
  InscriptionInfoSchema,
} from './prof-classes.js'
export type {
  ClasseInfo,
  CodeClasseCreee,
  CodeClasseInfo,
  InscriptionInfo,
  CreerMaClasseInput,
} from './prof-classes.js'
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
export {
  mesClasses,
  listerFils,
  ouvrirFil,
  consulterFil,
  repondre,
  marquerUtile,
  signaler,
  fileSignalements,
  masquerMessage,
  sanctionner,
  EntraideError,
  FilVueSchema,
  FilDetailSchema,
  MessageVueSchema,
  SignalementVueSchema,
  MaClasseSchema,
} from './entraide.js'
export type {
  MaClasse,
  FilVue,
  FilDetail,
  MessageVue,
  SignalementVue,
  PorteeEntraide,
  OuvrirFilInput,
  TypeSanction,
  SanctionnerInput,
} from './entraide.js'
export {
  listerSalons,
  messagesDuSalon,
  publierDansSalon,
  signalerMessageSalon,
  creerSalon,
  fileSignalementsSalon,
  masquerMessageSalon,
  MessagerieError,
  SalonVueSchema,
  SalonMessageVueSchema,
  SalonSignalementVueSchema,
} from './salons.js'
export type { SalonVue, SalonMessageVue, SalonSignalementVue, CreerSalonInput } from './salons.js'
export { surSessionExpiree, signalerSessionExpiree } from './session-expiree.js'
export {
  lireReglageCommunaute,
  listerQuestions,
  consulterQuestion,
  poserQuestion,
  modifierQuestion,
  supprimerQuestion,
  repondre as repondreQuestion,
  commenter as commenterReponse,
  modifierReponse,
  supprimerReponse,
  voterUtile,
  resoudreQuestion,
  CommunauteError,
  AuteurCommunauteSchema,
  QuestionResumeSchema,
  PageQuestionsSchema,
  QuestionDetailSchema,
} from './communaute.js'
export type {
  AuteurCommunaute,
  QuestionResume,
  PageQuestions,
  QuestionDetail,
  ReponseCommunaute,
  CommentaireCommunaute,
  FiltresQuestions,
} from './communaute.js'
