/**
 * Fake backend for the Playwright e2e tests (#259).
 *
 * Plain Node `http`, no dependency. Next (`next dev`, API_INTERNAL_URL) calls it from the
 * server, and the dev-only `/api` rewrite sends the browser's calls here too.
 *
 * Chapters are read from `content/` on each request, so a fixture never drifts from the
 * catalogue. They are served the way the backend serves them after ingestion
 * (ExerciceExtractor): evaluation fields stripped, `choices[].correct` removed, an
 * `exerciceId` added.
 *
 * Routes:
 *   GET /api/chapitres/{niveau}/{matiere}/{slug}  chapter from content/chapitres
 *   GET /api/moi, /api/progression/*              401: an anonymous visitor or an expired
 *                                                 session; with the test student's session
 *                                                 (E2E_SESSION), that student, who has not earned
 *                                                 any XP yet. The web middleware asks /api/moi
 *                                                 before every page (#279). With
 *                                                 E2E_SESSION_ENSEIGNANT, /api/moi answers a teacher
 *   GET /api/progression/parcours/{niveau}/{matiere}  that student's path, as ProgressionService
 *                                                 returns it before anything is recorded: every
 *                                                 chapter at 0 %, the first `en_cours`, the
 *                                                 others `verrouille`
 *   POST /api/exercices/{id}/soumissions          graded from content/ like the backend's
 *                                                 evaluators (#246); 401 without a session
 *   POST /api/chapitres/{id}/sections/{s}/lu      204 with a session, 401 without
 *   POST /api/cours/{id}/sections/{s}/lu          204/400/401/403/404, as CoursController (ADR 0050)
 *   GET  /api/progression/cours/{id}              a gauge for E2E_SESSION_COURS_EN_COURS on c001, else 204
 *   GET  /api/devoirs, /api/cours                 the test student's homework and courses (courses newest first)
 *   GET  /api/cours/{id}                          a published teacher course, as CoursController
 *                                                 serves it: 401 without a session, 400 for an id
 *                                                 UUID.fromString rejects (GlobalExceptionHandler's
 *                                                 body), then 404 with no body when unknown or not
 *                                                 published (checked before the scope), 403 with no
 *                                                 body when scoped to none of the reader's classes
 *                                                 (COURS_HORS_PORTEE; a teacher or a student in no
 *                                                 class has none), 200 the chapter shape (ADR 0019
 *                                                 §1): a catalogue chapter served under the
 *                                                 course's title
 *   GET  /api/moi/classes, /api/salons            the test student's class and salon, none for
 *                                                 E2E_SESSION_SANS_CLASSE; 401 without a session
 *   GET  /api/salons/{id}/messages                that salon's messages, own ones flagged
 *   POST /api/salons/{id}/messages                201 { id }; 422 on an empty body
 *   POST /api/salons/messages/{id}/signalement    204 with a session, 401 without
 *   GET  /api/reglages/communaute                 public, always active: the off state is covered
 *                                                 by Vitest, as it needs another server setting
 *   /api/communaute/**                            the Communauté (ADR 0035), kept in memory with
 *                                                 CommunauteService's rules; 403 for a teacher
 *   GET  /api/prof/classes                        the test teacher's classes (PROF_CLASSE, 3e C)
 *   GET  /api/prof/etablissements                 their établissement (EtablissementPublicInfo)
 *   GET  /api/classes/{id}/inscriptions           its one student, for the teacher; 403 otherwise
 *   POST /api/classes/{id}/inscriptions/{compteId}/reinitialisation-acces
 *                                                 teacher-led access reset (ADR 0036): the student's
 *                                                 identifier + a fresh provisional password, 7 days
 *   POST /api/sessions                            form login, only with a provisional password above
 *                                                 (dashes, spaces and case ignored, as the backend
 *                                                 does — the identifier's spaces and case too):
 *                                                 usable once, opens a session that must choose
 *                                                 its password (doitChangerMotDePasse, pseudonym
 *                                                 withheld); 401 otherwise, with the backend's body
 *   POST /api/moi/mot-de-passe                    204 lifts that flag; 400 under 8 chars or over 72
 *                                                 bytes of UTF-8 (what bcrypt hashes); 422
 *                                                 the provisional password again; 409 when nothing is
 *                                                 pending. While pending, every other call of that
 *                                                 session is a 403, as StatutCheckFilter does — except
 *                                                 DELETE /api/sessions (logout runs before it).
 *                                                 Afterwards /api/moi carries accesReinitialise
 *   3e C salon (PL-7, #399)                       a second class of the test teacher, with its own
 *                                                 salon and two students (E2E_SESSION_3EC_NOE writes,
 *                                                 E2E_SESSION_3EC_LOU reports), as MessagerieService
 *                                                 serves it: the teacher reads hidden messages too
 *                                                 (statut "masque"), the students only published ones;
 *                                                 POST …/messages authored by the session's account,
 *                                                 422 on a link or a phone number, 400 on a blank
 *                                                 body; signalement recorded, idempotent per
 *                                                 reporter, ignored on a hidden message (#402);
 *                                                 GET /api/prof/salons/signalements (403 for a
 *                                                 student), never the teacher's own messages nor
 *                                                 hidden ones (#410, #402);
 *                                                 POST /api/prof/salons/messages/{id}/masquer 204,
 *                                                 closing its open reports (400 non-UUID id, 404
 *                                                 unknown, 403 for a student, a 5e B message or
 *                                                 the teacher's own message, #410).
 *                                                 POST /api/prof/salons 201 { id } (403 for a class
 *                                                 not taught, 400/422 on the title), the salon kept
 *                                                 per teacher session (`e2e-enseignant-<uuid>`).
 *                                                 5e B is left untouched
 *   POST /api/communaute/{questions|reponses}/{id}/signalement
 *                                                 204, idempotent while open; 403 on one's own
 *                                                 message; the reported text is frozen (ADR 0044)
 *   GET  /api/admin/communaute/signalements       E2E_SESSION_ADMIN only (403 otherwise): open
 *                                                 reports grouped by target
 *   POST /api/admin/communaute/{type}/{id}/decision  masquer / rejeter / supprimer / restaurer
 *                                                 (masked only); a masked message leaves every read
 *   GET  /api/admin/communaute/contestations      [] (no member screen to contest yet, ADR 0044)
 *   anything else                                 404 (the catalogue too: the page falls back
 *                                                 to codes, nothing is invented)
 *
 * Add a route when a test needs one, never a value the real backend would not return.
 */
import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../content/chapitres')
const PORT = Number(process.env.FAKE_BACKEND_PORT ?? 8099)

// Mirrors ContenuService.SENSITIVE_EVAL_FIELDS.
const SENSITIVE_EVAL_FIELDS = [
  'answer',
  'tolerance',
  'acceptedAnswers',
  'caseSensitive',
  'referenceAnswer',
  'rubric',
  'items',
  'expected',
]

const SEGMENT = /^[a-z0-9-]+$/

/** Stable across runs, unlike the backend's random UUIDs, so a test can rely on it. */
function exerciceIdFor(chapitreId, slug) {
  const h = createHash('sha256').update(`${chapitreId}/${slug}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

function asServed(chapitre) {
  for (const section of chapitre.sections ?? []) {
    section.blocks = (section.blocks ?? []).map((block) => {
      if (block.type !== 'exercise') return block
      const served = { ...block }
      for (const field of SENSITIVE_EVAL_FIELDS) delete served[field]
      if (Array.isArray(served.choices)) {
        served.choices = served.choices.map((choice) => {
          const stripped = { ...choice }
          delete stripped.correct
          return stripped
        })
      }
      served.exerciceId = exerciceIdFor(chapitre.id, block.id)
      return served
    })
  }
  return chapitre
}

/** The session cookie a spec sets to act as a logged-in student (Spring's default name). */
export const E2E_SESSION = 'JSESSIONID=e2e-eleve'

/** Another logged-in student, who has joined no class yet. */
export const E2E_SESSION_SANS_CLASSE = 'JSESSIONID=e2e-sans-classe'

/** A logged-in teacher: /api/moi answers ENSEIGNANT, so the teacher space (/prof) opens. */
export const E2E_SESSION_ENSEIGNANT = 'JSESSIONID=e2e-enseignant'

/** Two students of the test teacher's 3e C (PL-7, #399): one writes, the other reports. */
export const E2E_SESSION_3EC_NOE = 'JSESSIONID=e2e-eleve-3eC-noe'
export const E2E_SESSION_3EC_LOU = 'JSESSIONID=e2e-eleve-3eC-lou'
/** A logged-in Brio admin: /api/moi answers admin_brio, the moderation console opens (#338). */
export const E2E_SESSION_ADMIN = 'JSESSIONID=e2e-admin'

/**
 * A student (5e) whose competence to review is `c4.num.operations.diviser-decimal`: taught in a
 * lesson section of `division-decimale-problemes` (#371).
 */
export const E2E_SESSION_A_REVOIR = 'JSESSIONID=e2e-a-revoir'

/**
 * A student whose competence to review is `c4.geo.pythagore.reciproque`, which only an `exercises`
 * section carries: no lesson to link, so the Accueil hides « À revoir » (#371).
 */
export const E2E_SESSION_A_REVOIR_ORPHELIN = 'JSESSIONID=e2e-a-revoir-orphelin'

/**
 * A student of the class who left a teacher course unfinished (PL-6b, ADR 0050): « Reprendre »
 * proposes that course, and progression has their gauge for it. Any other student never opened one.
 */
export const E2E_SESSION_COURS_EN_COURS = 'JSESSIONID=e2e-cours-en-cours'

function coursEnCours(req) {
  return cookies(req).includes(E2E_SESSION_COURS_EN_COURS)
}

function cookies(req) {
  return (req.headers.cookie ?? '').split(/;\s*/)
}

// Teacher-led access reset (ADR 0036). Each reset issues its own provisional password, valid once:
// the desktop and mobile projects run the same spec at once against this one server, so a reset
// must not invalidate the other project's (the real backend keeps only the latest — a detail
// no spec relies on). A login with one opens a session, keyed by its cookie value.
const IDENTIFIANT_REINIT = 'k7m4p9xa3r'
const ALPHABET_PROVISOIRE = '23456789abcdefghjkmnpqrstuvwxyz'
/** canonical provisional password -> when its reset happened (the date told to the student) */
const provisoiresValides = new Map()
/** cookie value -> { aChanger, provisoire, le } for a session opened with a provisional password */
const sessionsReinit = new Map()

/**
 * The backend's canonical form of a provisional password (MotDePasseProvisoire.normaliser). JS's
 * \s covers the non-breaking spaces (U+00A0, U+202F) the backend drops too.
 */
function canonique(motDePasse) {
  return motDePasse.replace(/[-\s]/g, '').toLowerCase()
}

/** The backend's tolerant reading of a typed identifier (IdentifiantConnexion.normaliser). */
function identifiantCanonique(identifiant) {
  return identifiant.replace(/\s/g, '').toLowerCase()
}

function provisoire() {
  const groupe = () =>
    Array.from({ length: 4 }, () =>
      ALPHABET_PROVISOIRE.charAt(Math.floor(Math.random() * ALPHABET_PROVISOIRE.length))
    ).join('')
  return `${groupe()}-${groupe()}-${groupe()}`
}

/** The session opened with a provisional password, if this request carries one. */
function sessionReinit(req) {
  const valeur = cookies(req)
    .find((c) => c.startsWith('JSESSIONID='))
    ?.slice('JSESSIONID='.length)
  return valeur && sessionsReinit.has(valeur) ? valeur : null
}

/** Any live session. Another JSESSIONID (`e2e-expiree`…) is a session the backend has dropped. */
function connecte(req) {
  return (
    cookies(req).includes(E2E_SESSION) ||
    sansClasse(req) ||
    enseignant(req) ||
    adminBrio(req) ||
    !!sessionReinit(req) ||
    !!eleve3eC(req) ||
    coursEnCours(req) ||
    competenceARevoir(req) !== null
  )
}

function adminBrio(req) {
  return cookies(req).includes(E2E_SESSION_ADMIN)
}

/** The competence a #371 session has to review, null for any other session. */
function competenceARevoir(req) {
  if (cookies(req).includes(E2E_SESSION_A_REVOIR)) return 'c4.num.operations.diviser-decimal'
  if (cookies(req).includes(E2E_SESSION_A_REVOIR_ORPHELIN)) return 'c4.geo.pythagore.reciproque'
  return null
}

function enseignant(req) {
  return sessionEnseignant(req) !== null
}

/**
 * The teacher session's cookie value: `e2e-enseignant`, or `e2e-enseignant-<uuid>` for a spec that
 * needs state of its own (PL-7, #399: opening a salon must not be seen by the other project).
 */
function sessionEnseignant(req) {
  const valeur = cookies(req)
    .find((c) => c.startsWith('JSESSIONID='))
    ?.slice('JSESSIONID='.length)
  return valeur === 'e2e-enseignant' || /^e2e-enseignant-[0-9a-f-]{36}$/.test(valeur ?? '')
    ? valeur
    : null
}

function sansClasse(req) {
  return cookies(req).includes(E2E_SESSION_SANS_CLASSE)
}

const ELEVE = {
  id: '00000000-0000-4000-8000-0000000000e2',
  role: 'eleve',
  statut: 'actif',
  nom: null,
  email: null,
  pseudonyme: 'Renard-Indigo',
  niveau: '5e',
}

const ADMIN = {
  id: '00000000-0000-4000-8000-0000000000e4',
  role: 'admin_brio',
  statut: 'actif',
  nom: 'Équipe brio',
  email: 'admin.e2e@example.org',
}

const ENSEIGNANT = {
  id: '00000000-0000-4000-8000-0000000000e3',
  role: 'enseignant',
  statut: 'actif',
  nom: 'M. Dubois',
  email: 'prof.e2e@example.org',
}

// The test teacher's class and its one student, whose access the teacher can reset (ADR 0036).
const PROF_CLASSE = {
  id: 'classe-4eA',
  etablissementId: 'etab-e2e',
  niveauCode: '4e',
  libelle: '4e A',
  anneeScolaire: '2026-2027',
  statut: 'active',
  enseignantPrincipalId: '00000000-0000-4000-8000-0000000000e3',
}
const PROF_INSCRIT = {
  compteId: '00000000-0000-4000-8000-0000000000e4',
  nomAffiche: 'Inès',
  depuis: '2026-09-02',
  homonyme: false,
}

// The logged-in student's class and its salon (F6b, #270), for /ma-classe. `estMoi` is derived
// per reader, as the real backend does — the student's own messages are the ones they authored.
const CLASSE = {
  id: 'classe-5eB',
  libelle: '5e B',
  niveauCode: '5e',
  etablissementNom: 'Collège Jean Moulin',
  anneeScolaire: '2026-2027',
  nomAffiche: 'Inès',
}
// A course of their class, and a published course scoped to another class only: the backend
// leaves it out of the student's list and answers 403 on it (#370). Stable UUIDs, as the backend
// parses the path id as one.
const COURS = [
  {
    id: '00000000-0000-4000-8000-00000000c001',
    titre: 'Les fractions, version M. Dubois',
    niveauCode: '5e',
    matiereCode: 'mathematiques',
    enseignant: 'M. Dubois',
    publieAt: '2026-10-01T08:00:00Z',
    classeIds: [CLASSE.id],
  },
  {
    id: '00000000-0000-4000-8000-00000000c003',
    titre: 'Les angles, version M. Dubois',
    niveauCode: '5e',
    matiereCode: 'mathematiques',
    enseignant: 'M. Dubois',
    publieAt: '2026-10-14T08:00:00Z',
    classeIds: [CLASSE.id],
  },
  {
    id: '00000000-0000-4000-8000-00000000c004',
    titre: 'Le cercle, version M. Dubois',
    niveauCode: '5e',
    matiereCode: 'mathematiques',
    enseignant: 'M. Dubois',
    publieAt: '2026-10-08T08:00:00Z',
    classeIds: [CLASSE.id],
  },
  {
    id: '00000000-0000-4000-8000-00000000c005',
    titre: 'Les priorités opératoires, version M. Dubois',
    niveauCode: '5e',
    matiereCode: 'mathematiques',
    enseignant: 'M. Dubois',
    publieAt: '2026-09-20T08:00:00Z',
    classeIds: [CLASSE.id],
  },
]
const COURS_HORS_PORTEE = {
  id: '00000000-0000-4000-8000-00000000c002',
  titre: 'Les nombres relatifs, version 4e A',
  niveauCode: '4e',
  matiereCode: 'mathematiques',
  enseignant: 'M. Dubois',
  publieAt: '2026-10-02T08:00:00Z',
  classeIds: [PROF_CLASSE.id],
}
/** A well-formed course id that names no course: GET /api/cours/{id} answers 404. */
const COURS_INCONNU_ID = '00000000-0000-4000-8000-00000000c404'
/** What a published course's content is in this fake: a catalogue chapter (#370). */
const CONTENU_DES_COURS = ['5e', 'mathematiques', 'fractions-comparer-additionner']

// Their homework: one points to a chapter (#322), three to a teacher course (#370) — one the
// student can read, one scoped to another class (403), one unknown (404). The unknown one is due
// last: Accueil shows the three soonest, Ma classe shows them all.
const DEVOIRS = [
  {
    id: 'devoir-pythagore',
    classeId: CLASSE.id,
    titre: 'Réviser Pythagore',
    enseignant: 'M. Dubois',
    sourceType: 'chapitre',
    sourceRef: 'theoreme-de-pythagore',
    echeanceAt: '2026-10-20T16:00:00Z',
    nombreExercices: 2,
    statutRendu: 'non_commence',
    corrige: false,
  },
  {
    id: '00000000-0000-4000-8000-00000000d404',
    classeId: CLASSE.id,
    titre: 'Lire le cours sur les aires',
    enseignant: 'M. Dubois',
    sourceType: 'cours',
    sourceRef: COURS_INCONNU_ID,
    echeanceAt: '2026-11-05T16:00:00Z',
    nombreExercices: 1,
    statutRendu: 'non_commence',
    corrige: false,
  },
  {
    id: '00000000-0000-4000-8000-00000000d403',
    classeId: CLASSE.id,
    titre: 'Lire le cours sur les relatifs',
    enseignant: 'M. Dubois',
    sourceType: 'cours',
    sourceRef: COURS_HORS_PORTEE.id,
    echeanceAt: '2026-10-24T16:00:00Z',
    nombreExercices: 1,
    statutRendu: 'non_commence',
    corrige: false,
  },
  {
    id: '00000000-0000-4000-8000-00000000d200',
    classeId: CLASSE.id,
    titre: 'Relire le cours sur les fractions',
    enseignant: 'M. Dubois',
    sourceType: 'cours',
    sourceRef: COURS[0].id,
    echeanceAt: '2026-10-19T16:00:00Z',
    nombreExercices: 2,
    statutRendu: 'non_commence',
    corrige: false,
  },
]
// The chapter they left unfinished; a student with no class has nothing to resume.
const REPRENDRE = {
  type: 'chapitre',
  chapitreId: 'theoreme-de-pythagore',
  titre: 'Le théorème de Pythagore',
  niveauCode: '3e',
  matiereCode: 'mathematiques',
  sectionsLues: 2,
  sectionsTotal: 5,
  derniereActivite: '2026-10-15T16:00:00Z',
}
const SALON = {
  id: 'salon-5eB',
  classeId: CLASSE.id,
  titre: 'Salon de la 5e B',
  statut: 'ouvert',
  nbMessages: 2,
  createdAt: '2026-10-12T08:00:00Z',
}
const salonMessages = [
  {
    id: 'msg-1',
    auteurId: 'prof-1',
    auteurNom: 'M. Dubois',
    corps: 'Bonjour la 5e B ! Pensez aux fractions pour mardi.',
    statut: 'publie',
    createdAt: '2026-10-12T08:01:00Z',
  },
  {
    id: 'msg-2',
    auteurId: 'eleve-lea',
    auteurNom: 'Léa',
    corps: 'Bonjour monsieur, c’est noté.',
    statut: 'publie',
    createdAt: '2026-10-12T08:05:00Z',
  },
]
const salonMessageVue = (m) => ({ ...m, estMoi: m.auteurId === ELEVE.id })

// PL-7 (#399): the teacher's salon. A class apart from 5e B, whose salon ma-classe.spec reads in
// strict mode (one more message from M. Dubois there would break it). The teacher teaches 3e C, so
// /api/prof/classes lists it and /api/salons gives the teacher its salon only (the backend lists
// the salons of the classes the caller is a member of). Message and salon ids are UUIDs: the
// backend binds them as UUID path variables.
const PROF_CLASSE_3EC = {
  id: 'classe-3eC',
  etablissementId: 'etab-e2e',
  niveauCode: '3e',
  libelle: '3e C',
  anneeScolaire: '2026-2027',
  statut: 'active',
  enseignantPrincipalId: ENSEIGNANT.id,
}
/** cookie value -> the student's account and roster entry (InscriptionInfo) */
const ELEVES_3EC = {
  'e2e-eleve-3eC-noe': {
    compteId: '00000000-0000-4000-8000-0000000003c1',
    nomAffiche: 'Noé',
    depuis: '2026-09-02',
    homonyme: false,
  },
  'e2e-eleve-3eC-lou': {
    compteId: '00000000-0000-4000-8000-0000000003c2',
    nomAffiche: 'Lou',
    depuis: '2026-09-02',
    homonyme: false,
  },
}
const SALON_3EC = {
  id: '00000000-0000-4000-8000-0000000053c0',
  classeId: PROF_CLASSE_3EC.id,
  titre: 'Salon de la 3e C',
  statut: 'ouvert',
  createdAt: '2026-10-12T08:00:00Z',
}
// Seed: one from the teacher, one from a student, one already hidden. Specs never hide these:
// each test hides only a message it wrote itself (both projects share this server).
const messages3eC = [
  {
    id: '00000000-0000-4000-8000-0000000053c1',
    auteurId: ENSEIGNANT.id,
    corps: 'Bonjour la 3e C, le salon de la classe est ouvert.',
    statut: 'publie',
    createdAt: '2026-10-12T08:01:00Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000053c2',
    auteurId: ELEVES_3EC['e2e-eleve-3eC-noe'].compteId,
    corps: 'Bonjour monsieur, bien reçu.',
    statut: 'publie',
    createdAt: '2026-10-12T08:05:00Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000053c3',
    auteurId: ELEVES_3EC['e2e-eleve-3eC-lou'].compteId,
    corps: 'Un message hors sujet, déjà masqué.',
    statut: 'masque',
    createdAt: '2026-10-12T08:07:00Z',
  },
]
/** { id, messageId, signalePar, motif, statut: 'ouvert' | 'traite', createdAt } */
const signalements3eC = []

/** The 3e C student of this session, or null. */
function eleve3eC(req) {
  const valeur = cookies(req)
    .find((c) => c.startsWith('JSESSIONID='))
    ?.slice('JSESSIONID='.length)
  return (valeur && ELEVES_3EC[valeur]) || null
}

/** The account id of the session, for the 3e C salon (null: no member of it). */
function membre3eC(req) {
  if (enseignant(req)) return ENSEIGNANT.id
  return eleve3eC(req)?.compteId ?? null
}

/** MessagerieService.resoudreNoms: the roster's names, then the teachers'; « Membre » otherwise. */
function nom3eC(compteId) {
  if (compteId === ENSEIGNANT.id) return ENSEIGNANT.nom
  return Object.values(ELEVES_3EC).find((e) => e.compteId === compteId)?.nomAffiche ?? 'Membre'
}

/** SalonVue: nbMessages counts the visible messages only (MessagerieService.listerSalons). */
function salon3eCVue() {
  return {
    ...SALON_3EC,
    nbMessages: messages3eC.filter((m) => m.statut === 'publie').length,
  }
}

const LIEN_EXTERNE = /(https?:\/\/|\bwww\.)/i
// ModerationPreventive.TELEPHONE_FR, same pattern.
const TELEPHONE_FR = /(?:(?:\+|00)33|0)\s?[1-9](?:[ .\u00A0-]?\d){8}/

/**
 * Why a salon message is refused, as [status, body], or null: @NotBlank on PublierRequest (400,
 * before the service; message in the server's locale), then ModerationPreventive.valider (422).
 * The rate limit (429) is covered by Vitest, not simulated.
 */
function refusDuMessage(brut) {
  if (typeof brut !== 'string' || brut.trim() === '') {
    return [400, { error: 'corps: must not be blank' }]
  }
  const texte = brut.trim()
  if (texte.length > 2000) {
    return [422, { error: 'Le message est trop long (max 2000 caractères).' }]
  }
  if (LIEN_EXTERNE.test(texte)) {
    return [422, { error: 'Les liens externes ne sont pas autorisés.' }]
  }
  if (TELEPHONE_FR.test(texte)) {
    return [422, { error: 'Les numéros de téléphone ne sont pas autorisés.' }]
  }
  return null
}

// Salons opened by a teacher session (POST /api/prof/salons, critère 5 of PL-7): kept per session
// cookie, so that the desktop and mobile projects each open their own (the real backend has one
// account and would see both). session -> [{ id, classeId, titre, statut, createdAt, messages }]
const salonsOuverts = new Map()
const CLASSES_ENSEIGNEES = () => [PROF_CLASSE.id, PROF_CLASSE_3EC.id]
const TITRE_MAX = 120

function salonsDeLaSession(req) {
  return salonsOuverts.get(sessionEnseignant(req)) ?? []
}

/** SalonVue of a salon opened by this session (its messages are the teacher's only). */
function salonOuvertVue(salon) {
  return {
    id: salon.id,
    classeId: salon.classeId,
    titre: salon.titre,
    statut: salon.statut,
    nbMessages: salon.messages.filter((m) => m.statut === 'publie').length,
    createdAt: salon.createdAt,
  }
}

/** The 3e C salon routes (PL-7, #399), in MessagerieService's order of checks. */
async function salonDe3eC(req, res, pathname) {
  const methode = req.method
  const eleve = eleve3eC(req)

  // The 3e C students' own class space: their class and salon, no homework or course.
  if (eleve && methode === 'GET') {
    if (pathname === '/api/moi') {
      return send(res, 200, {
        ...ELEVE,
        id: eleve.compteId,
        pseudonyme: `Eleve-${eleve.nomAffiche}`,
        niveau: '3e',
      })
    }
    if (pathname === '/api/moi/classes') {
      return send(res, 200, [
        {
          id: PROF_CLASSE_3EC.id,
          libelle: PROF_CLASSE_3EC.libelle,
          niveauCode: PROF_CLASSE_3EC.niveauCode,
          etablissementNom: 'Collège Jean Moulin',
          anneeScolaire: PROF_CLASSE_3EC.anneeScolaire,
          nomAffiche: eleve.nomAffiche,
        },
      ])
    }
    if (pathname === '/api/devoirs' || pathname === '/api/cours') return send(res, 200, [])
    if (pathname === '/api/salons') return send(res, 200, [salon3eCVue()])
  }

  if (methode === 'GET' && pathname === `/api/classes/${PROF_CLASSE_3EC.id}/inscriptions`) {
    if (!connecte(req)) return send(res, 401)
    if (!enseignant(req)) return send(res, 403)
    return send(res, 200, Object.values(ELEVES_3EC))
  }

  const routeMessages = pathname === `/api/salons/${SALON_3EC.id}/messages`
  if (routeMessages && methode === 'GET') {
    if (!connecte(req)) return send(res, 401)
    const lecteur = membre3eC(req)
    if (!lecteur) return send(res, 403, { error: "Vous n'êtes pas membre de cette classe." })
    // The class teacher (the moderator) sees the hidden messages too.
    const moderateur = enseignant(req)
    return send(
      res,
      200,
      messages3eC
        .filter((m) => moderateur || m.statut === 'publie')
        .map((m) => ({
          id: m.id,
          auteurId: m.auteurId,
          auteurNom: nom3eC(m.auteurId),
          corps: m.corps,
          statut: m.statut,
          estMoi: m.auteurId === lecteur,
          createdAt: m.createdAt,
        }))
    )
  }
  if (routeMessages && methode === 'POST') {
    if (!connecte(req)) return send(res, 401)
    const brut = (await corps(req))?.corps
    const refus = refusDuMessage(brut)
    if (refus?.[0] === 400) return send(res, ...refus)
    const auteur = membre3eC(req)
    if (!auteur) return send(res, 403, { error: "Vous n'êtes pas membre de cette classe." })
    if (refus) return send(res, ...refus)
    const texte = brut.trim()
    const id = randomUUID()
    messages3eC.push({
      id,
      auteurId: auteur,
      corps: texte,
      statut: 'publie',
      createdAt: new Date().toISOString(),
    })
    return send(res, 201, { id })
  }

  const signalement = pathname.match(/^\/api\/salons\/messages\/([^/]+)\/signalement$/)
  const signale = signalement && messages3eC.find((m) => m.id === signalement[1].toLowerCase())
  if (signale && methode === 'POST') {
    if (!connecte(req)) return send(res, 401)
    const signaleur = membre3eC(req)
    if (!signaleur) return send(res, 403, { error: "Vous n'êtes pas membre de cette classe." })
    // A hidden message is not reported again: nothing left to moderate (#402).
    if (signale.statut !== 'publie') return send(res, 204)
    if (!signalements3eC.some((s) => s.messageId === signale.id && s.signalePar === signaleur)) {
      const motif = (await corps(req))?.motif ?? null
      signalements3eC.push({
        id: randomUUID(),
        messageId: signale.id,
        signalePar: signaleur,
        motif,
        statut: 'ouvert',
        createdAt: new Date().toISOString(),
      })
    }
    return send(res, 204)
  }

  // /api/prof/** is ENSEIGNANT only (SecurityConfig): 401 logged out, 403 with no body otherwise.
  if (methode === 'GET' && pathname === '/api/prof/salons/signalements') {
    if (!connecte(req)) return send(res, 401)
    if (!enseignant(req)) return send(res, 403)
    return send(
      res,
      200,
      signalements3eC
        .filter((s) => s.statut === 'ouvert')
        // Never a report on the teacher's own message (#410), nor on a hidden one (#402).
        .filter((s) => {
          const m = messages3eC.find((x) => x.id === s.messageId)
          return m.auteurId !== ENSEIGNANT.id && m.statut === 'publie'
        })
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((s) => {
          const m = messages3eC.find((x) => x.id === s.messageId)
          return {
            id: s.id,
            messageId: m.id,
            salonId: SALON_3EC.id,
            salonTitre: SALON_3EC.titre,
            auteurMessageId: m.auteurId,
            auteurMessageNom: nom3eC(m.auteurId),
            extraitMessage: m.corps.length <= 160 ? m.corps : `${m.corps.slice(0, 160)}…`,
            signalePar: s.signalePar,
            motif: s.motif,
            createdAt: s.createdAt,
          }
        })
    )
  }
  // ProfMessagerieController.creer → MessagerieService.creerSalon: bean validation (400), then
  // « teaches this class » (403), then validerTitre (422). No uniqueness per class in the backend.
  if (methode === 'POST' && pathname === '/api/prof/salons') {
    if (!connecte(req)) return send(res, 401)
    if (!enseignant(req)) return send(res, 403)
    const demande = await corps(req)
    if (typeof demande?.classeId !== 'string') {
      return send(res, 400, { error: 'classeId: must not be null' })
    }
    if (typeof demande?.titre !== 'string' || demande.titre.trim() === '') {
      return send(res, 400, { error: 'titre: must not be blank' })
    }
    if (!CLASSES_ENSEIGNEES().includes(demande.classeId)) {
      return send(res, 403, { error: "Vous n'enseignez pas cette classe." })
    }
    const titre = demande.titre.trim()
    if (titre.length > TITRE_MAX) {
      return send(res, 422, { error: `Le titre est trop long (max ${TITRE_MAX} caractères).` })
    }
    const salon = {
      id: randomUUID(),
      classeId: demande.classeId,
      titre,
      statut: 'ouvert',
      createdAt: new Date().toISOString(),
      messages: [],
    }
    const session = sessionEnseignant(req)
    salonsOuverts.set(session, [...(salonsOuverts.get(session) ?? []), salon])
    return send(res, 201, { id: salon.id })
  }

  // The messages of a salon this session opened: its teacher is the only member with a session.
  const routeOuvert = pathname.match(/^\/api\/salons\/([^/]+)\/messages$/)
  const ouvert = routeOuvert && salonsDeLaSession(req).find((x) => x.id === routeOuvert[1])
  if (ouvert && methode === 'GET') {
    return send(
      res,
      200,
      ouvert.messages.map((m) => ({ ...m, auteurNom: ENSEIGNANT.nom, estMoi: true }))
    )
  }
  if (ouvert && methode === 'POST') {
    const brut = (await corps(req))?.corps
    const refus = refusDuMessage(brut)
    if (refus) return send(res, ...refus)
    const id = randomUUID()
    ouvert.messages.push({
      id,
      auteurId: ENSEIGNANT.id,
      corps: brut.trim(),
      statut: 'publie',
      createdAt: new Date().toISOString(),
    })
    return send(res, 201, { id })
  }

  const masquer = pathname.match(/^\/api\/prof\/salons\/messages\/([^/]+)\/masquer$/)
  if (masquer && methode === 'POST') {
    if (!connecte(req)) return send(res, 401)
    if (!enseignant(req)) return send(res, 403)
    const id = decodeURIComponent(masquer[1])
    // A message of 5e B, a class the test teacher does not teach: PasModerateurException. (5e B's
    // ids are not UUIDs, an existing simplification of this fake: the real ones would be.)
    if (salonMessages.some((m) => m.id === id)) {
      return send(res, 403, { error: 'Vous ne modérez pas cette classe.' })
    }
    if (!UUID_JAVA.test(id)) return send(res, 400, { error: 'Requête invalide' })
    const cible =
      messages3eC.find((m) => m.id === id.toLowerCase()) ??
      salonsDeLaSession(req)
        .flatMap((x) => x.messages)
        .find((m) => m.id === id.toLowerCase())
    if (!cible) return send(res, 404, { error: `Message de salon introuvable : ${id}` })
    if (cible.auteurId === ENSEIGNANT.id) {
      return send(res, 403, { error: 'Vous ne pouvez pas modérer votre propre message.' })
    }
    // Idempotent: hiding twice is a 204 with no further effect.
    cible.statut = 'masque'
    for (const s of signalements3eC) {
      if (s.messageId === cible.id && s.statut === 'ouvert') s.statut = 'traite'
    }
    return send(res, 204)
  }

  return null
}

// The Communauté (ADR 0035). Two students, so that one can answer the other's question: a student
// cannot keep their own answer. As in the real API, no response ever carries an account id.
const MEMBRES_COMMUNAUTE = {
  [ELEVE.id]: { pseudonyme: 'Renard-Indigo', niveau: '5e' },
  'eleve-sans-classe': { pseudonyme: 'Loutre-Corail', niveau: '5e' },
  'eleve-de-3e': { pseudonyme: 'Hibou-Turquoise', niveau: '3e' },
}
const ID_BLOC = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PALETTE = new Set(['prose', 'formula', 'code', 'list'])

const questionsCommunaute = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    auteurId: 'eleve-de-3e',
    titre: 'Comment développer (a + b)² ?',
    corps: [{ id: 'b1', type: 'prose', text: 'Je mélange tout avec le **double produit**.' }],
    niveau: '3e',
    matiere: 'mathematiques',
    reponseResolueId: null,
    votes: new Set(),
    modifie: false,
    createdAt: '2026-10-20T16:00:00Z',
  },
]
const reponsesCommunaute = []
/** Open and processed reports (ADR 0044): { cibleType, cibleId, signalePar, motif, extrait, statut }. */
const signalementsCommunaute = []

/** A message the moderation masked or deleted is gone from every member read. */
const visible = (message) => (message.statut ?? 'publie') === 'publie'

function extraitDe(message) {
  if (message.titre !== undefined) return message.titre
  return (message.corps ?? []).map((b) => b.text ?? '').join(' ')
}

function signaler(req, res, cibleType, message, lecteur, motif) {
  if (message.auteurId === lecteur) {
    return send(res, 403, { error: 'On ne signale pas son propre message.' })
  }
  const ouvert = signalementsCommunaute.some(
    (s) => s.cibleId === message.id && s.signalePar === lecteur && s.statut === 'ouvert'
  )
  if (!ouvert) {
    signalementsCommunaute.push({
      cibleType,
      cibleId: message.id,
      signalePar: lecteur,
      motif: motif?.trim() ? motif.trim() : null,
      extrait: extraitDe(message),
      statut: 'ouvert',
      createdAt: new Date().toISOString(),
    })
  }
  res.writeHead(204)
  return res.end()
}

async function moderationAdmin(req, res, pathname) {
  if (!connecte(req)) return send(res, 401)
  if (!adminBrio(req)) return send(res, 403)
  const message = (type, id) =>
    type === 'question'
      ? questionsCommunaute.find((q) => q.id === id)
      : reponsesCommunaute.find((r) => r.id === id)

  if (req.method === 'GET' && pathname === '/api/admin/communaute/signalements') {
    const parCible = new Map()
    for (const s of signalementsCommunaute.filter((s) => s.statut === 'ouvert')) {
      parCible.set(s.cibleId, [...(parCible.get(s.cibleId) ?? []), s])
    }
    const vues = []
    for (const groupe of parCible.values()) {
      const [premier] = groupe
      const cible = message(premier.cibleType, premier.cibleId)
      if (!cible) continue
      const question =
        premier.cibleType === 'question'
          ? cible
          : questionsCommunaute.find((q) => q.id === cible.questionId)
      vues.push({
        cibleType: premier.cibleType,
        cibleId: cible.id,
        questionId: question?.id ?? cible.id,
        auteurPseudonyme: MEMBRES_COMMUNAUTE[cible.auteurId]?.pseudonyme ?? 'Membre',
        extrait: extraitDe(cible),
        extraitAuSignalement: premier.extrait,
        statutContenu: cible.statut ?? 'publie',
        estReponseResolue:
          premier.cibleType === 'reponse' && question?.reponseResolueId === cible.id,
        xpDejaRevoquee: false,
        nombreSignalements: groupe.length,
        motifs: groupe.map((s) => s.motif).filter(Boolean),
        premierSignalementAt: premier.createdAt,
      })
    }
    return send(res, 200, vues)
  }
  if (req.method === 'GET' && pathname === '/api/admin/communaute/contestations') {
    return send(res, 200, [])
  }
  const decision = pathname.match(
    /^\/api\/admin\/communaute\/(question|reponse)\/([^/]+)\/decision$/
  )
  if (req.method === 'POST' && decision) {
    const [, type, id] = decision
    const cible = message(type, id)
    if (!cible) return send(res, 404, { error: 'Ce message n’existe pas ou plus.' })
    const action = (await corps(req))?.action
    const statut = cible.statut ?? 'publie'
    if (action === 'masquer' || action === 'supprimer') {
      if (statut === 'supprime') return send(res, 422, { error: 'Ce contenu a déjà été supprimé.' })
      cible.statut = action === 'masquer' ? 'masque' : 'supprime'
    } else if (action === 'restaurer') {
      if (statut !== 'masque') {
        return send(res, 422, { error: 'Seul un contenu masqué peut être restauré.' })
      }
      cible.statut = 'publie'
    } else if (action !== 'rejeter') {
      return send(res, 422, { error: 'Action de modération inconnue.' })
    }
    for (const s of signalementsCommunaute) {
      if (s.cibleId === id && s.statut === 'ouvert') s.statut = 'traite'
    }
    return send(res, 201, { id: randomUUID() })
  }
  return send(res, 404)
}

function lecteurCommunaute(req) {
  return sansClasse(req) ? 'eleve-sans-classe' : ELEVE.id
}

/** Mirrors CorpsCommunaute.valider, in what a test can reach. */
function corpsValide(blocs) {
  return (
    Array.isArray(blocs) &&
    blocs.length > 0 &&
    blocs.every((b) => PALETTE.has(b?.type) && ID_BLOC.test(b?.id ?? ''))
  )
}

const auteurVue = (id) => MEMBRES_COMMUNAUTE[id]

function commentaireVue(c, lecteur) {
  return {
    id: c.id,
    corps: c.corps,
    auteur: auteurVue(c.auteurId),
    estAuteur: c.auteurId === lecteur,
    modifie: c.modifie,
    createdAt: c.createdAt,
  }
}

function reponseVue(r, question, lecteur) {
  return {
    ...commentaireVue(r, lecteur),
    nombreUtile: r.votes.size,
    aVote: r.votes.has(lecteur),
    aResolu: question.reponseResolueId === r.id,
    commentaires: reponsesCommunaute
      .filter((c) => c.parentId === r.id && visible(c))
      .map((c) => commentaireVue(c, lecteur)),
  }
}

function questionCommune(q, lecteur) {
  return {
    id: q.id,
    titre: q.titre,
    auteur: auteurVue(q.auteurId),
    niveau: q.niveau,
    matiere: q.matiere,
    resolue: q.reponseResolueId !== null,
    nombreUtile: q.votes.size,
    aVote: q.votes.has(lecteur),
    estAuteur: q.auteurId === lecteur,
    modifie: q.modifie,
    createdAt: q.createdAt,
  }
}

async function communaute(req, res, pathname, search) {
  if (!connecte(req)) return send(res, 401)
  if (enseignant(req) || adminBrio(req)) {
    return send(res, 403, { error: 'La Communauté est réservée aux élèves.' })
  }
  const lecteur = lecteurCommunaute(req)
  const methode = req.method
  const introuvable = () => send(res, 404, { error: 'Ce message n’existe pas ou plus.' })
  const creer = (message, liste) => {
    liste.push(message)
    return send(res, 201, { id: message.id })
  }
  const nouveauMessage = (corpsMessage) => ({
    id: randomUUID(),
    auteurId: lecteur,
    corps: corpsMessage,
    votes: new Set(),
    modifie: false,
    createdAt: new Date().toISOString(),
  })
  const voter = (message) => {
    if (methode === 'DELETE') message.votes.delete(lecteur)
    else if (message.auteurId === lecteur) {
      return send(res, 403, { error: 'On ne vote pas pour son propre message.' })
    } else message.votes.add(lecteur)
    return send(res, 204)
  }

  if (pathname === '/api/communaute/questions') {
    if (methode === 'GET') {
      const niveau = search.get('niveau')
      const matiere = search.get('matiere')
      const page = Number(search.get('page') ?? 0)
      const taille = 20
      const trouvees = questionsCommunaute
        .filter(visible)
        .filter((q) => (!niveau || q.niveau === niveau) && (!matiere || q.matiere === matiere))
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
      return send(res, 200, {
        questions: trouvees.slice(page * taille, (page + 1) * taille).map((q) => ({
          ...questionCommune(q, lecteur),
          nombreReponses: reponsesCommunaute.filter(
            (r) => r.questionId === q.id && !r.parentId && visible(r)
          ).length,
        })),
        pageSuivante: trouvees.length > (page + 1) * taille,
      })
    }
    if (methode === 'POST') {
      const demande = await corps(req)
      const titre = (demande?.titre ?? '').trim()
      if (!titre || titre.length > 200 || !corpsValide(demande?.corps)) {
        return send(res, 422, { error: 'Le message est invalide.' })
      }
      return creer(
        {
          ...nouveauMessage(demande.corps),
          titre,
          niveau: MEMBRES_COMMUNAUTE[lecteur].niveau,
          matiere: demande.matiere ?? 'mathematiques',
          reponseResolueId: null,
        },
        questionsCommunaute
      )
    }
  }

  const routeQuestion = pathname.match(
    /^\/api\/communaute\/questions\/([^/]+)(?:\/(vote|reponses|signalement)(?:\/([^/]+)\/resolution)?)?$/
  )
  if (routeQuestion) {
    const [, questionId, suite, reponseId] = routeQuestion
    const question = questionsCommunaute.find((q) => q.id === questionId && visible(q))
    if (!question) return introuvable()
    if (suite === 'signalement' && methode === 'POST') {
      return signaler(req, res, 'question', question, lecteur, (await corps(req))?.motif)
    }
    if (suite === 'vote') return voter(question)
    if (suite === 'reponses' && reponseId && methode === 'POST') {
      if (question.auteurId !== lecteur) {
        return send(res, 403, { error: 'Seul l’auteur de la question peut la marquer.' })
      }
      const reponse = reponsesCommunaute.find((r) => r.id === reponseId)
      if (!reponse || reponse.questionId !== questionId) return introuvable()
      if (reponse.parentId) return send(res, 422, { error: 'Un commentaire ne résout rien.' })
      if (reponse.auteurId === lecteur) {
        return send(res, 422, { error: 'On ne retient pas sa propre réponse.' })
      }
      if (question.reponseResolueId && question.reponseResolueId !== reponseId) {
        return send(res, 409, { error: 'Cette question est déjà résolue.' })
      }
      question.reponseResolueId = reponseId
      return send(res, 204)
    }
    if (suite === 'reponses' && methode === 'POST') {
      const demande = await corps(req)
      if (!corpsValide(demande?.corps)) return send(res, 422, { error: 'Le message est vide.' })
      return creer(
        { ...nouveauMessage(demande.corps), questionId, parentId: null },
        reponsesCommunaute
      )
    }
    if (!suite && methode === 'GET') {
      return send(res, 200, {
        ...questionCommune(question, lecteur),
        corps: question.corps,
        reponses: reponsesCommunaute
          .filter((r) => r.questionId === questionId && !r.parentId && visible(r))
          .map((r) => reponseVue(r, question, lecteur)),
      })
    }
    if (!suite && question.auteurId !== lecteur) {
      return send(res, 403, { error: 'Ce message n’est pas le vôtre.' })
    }
    if (!suite && methode === 'PUT') {
      const demande = await corps(req)
      if (!(demande?.titre ?? '').trim() || !corpsValide(demande?.corps)) {
        return send(res, 422, { error: 'Le message est invalide.' })
      }
      Object.assign(question, { titre: demande.titre, corps: demande.corps, modifie: true })
      return send(res, 204)
    }
    if (!suite && methode === 'DELETE') {
      questionsCommunaute.splice(questionsCommunaute.indexOf(question), 1)
      return send(res, 204)
    }
  }

  const routeReponse = pathname.match(
    /^\/api\/communaute\/reponses\/([^/]+)(?:\/(vote|commentaires|signalement))?$/
  )
  if (routeReponse) {
    const [, reponseId, suite] = routeReponse
    const reponse = reponsesCommunaute.find((r) => r.id === reponseId && visible(r))
    if (!reponse) return introuvable()
    if (suite === 'signalement' && methode === 'POST') {
      return signaler(req, res, 'reponse', reponse, lecteur, (await corps(req))?.motif)
    }
    if (suite === 'vote') {
      if (reponse.parentId) return send(res, 422, { error: 'On ne vote pas sur un commentaire.' })
      return voter(reponse)
    }
    if (suite === 'commentaires' && methode === 'POST') {
      if (reponse.parentId) return send(res, 422, { error: 'On ne répond pas à un commentaire.' })
      const demande = await corps(req)
      if (!corpsValide(demande?.corps)) return send(res, 422, { error: 'Le message est vide.' })
      return creer(
        { ...nouveauMessage(demande.corps), questionId: reponse.questionId, parentId: reponseId },
        reponsesCommunaute
      )
    }
    if (!suite && reponse.auteurId !== lecteur) {
      return send(res, 403, { error: 'Ce message n’est pas le vôtre.' })
    }
    if (!suite && methode === 'PUT') {
      const demande = await corps(req)
      if (!corpsValide(demande?.corps)) return send(res, 422, { error: 'Le message est vide.' })
      Object.assign(reponse, { corps: demande.corps, modifie: true })
      return send(res, 204)
    }
    if (!suite && methode === 'DELETE') {
      const question = questionsCommunaute.find((q) => q.id === reponse.questionId)
      if (question?.reponseResolueId === reponseId) question.reponseResolueId = null
      reponsesCommunaute.splice(reponsesCommunaute.indexOf(reponse), 1)
      return send(res, 204)
    }
  }

  return send(res, 404)
}

async function chapitres() {
  const out = []
  for (const niveau of await readdir(CONTENT_DIR)) {
    for (const matiere of await readdir(join(CONTENT_DIR, niveau))) {
      for (const fichier of await readdir(join(CONTENT_DIR, niveau, matiere))) {
        if (!fichier.endsWith('.json')) continue
        out.push(JSON.parse(await readFile(join(CONTENT_DIR, niveau, matiere, fichier), 'utf8')))
      }
    }
  }
  return out
}

const REFERENTIEL_DIR = join(CONTENT_DIR, '../referentiel')

/** Competence labels as /api/referentiel/libelles serves them (deprecated codes included). */
async function libelles() {
  const out = []
  for (const fichier of await readdir(REFERENTIEL_DIR)) {
    if (!fichier.endsWith('.json')) continue
    const { competences } = JSON.parse(await readFile(join(REFERENTIEL_DIR, fichier), 'utf8'))
    for (const { code, intitule } of competences) out.push({ code, intitule })
  }
  return out
}

// Mirrors V5 (contenu.niveaux.ordre): the order the catalogue lists levels in.
const NIVEAUX = ['6e', '5e', '4e', '3e']

/**
 * The lesson section that teaches a competence (#371, ADR 0043), the same rule as the backend:
 * published chapters of content/chapitres (annales and teacher courses live elsewhere) with a
 * `lesson` section whose exercise block carries the code; the requested level's chapters first,
 * then level order, matiere, `_index.json` order; in the chapter, the first such section.
 */
async function leconDe(code, niveauDemande) {
  const candidats = []
  for (const niveau of NIVEAUX) {
    let matieres
    try {
      matieres = (await readdir(join(CONTENT_DIR, niveau))).sort()
    } catch {
      continue
    }
    for (const matiere of matieres) {
      let ordre
      try {
        ordre = JSON.parse(
          await readFile(join(CONTENT_DIR, niveau, matiere, '_index.json'), 'utf8')
        )
      } catch {
        continue
      }
      for (const slug of ordre) {
        let chapitre
        try {
          chapitre = JSON.parse(
            await readFile(join(CONTENT_DIR, niveau, matiere, `${slug}.json`), 'utf8')
          )
        } catch {
          continue
        }
        if ((chapitre.status ?? 'published') !== 'published') continue
        const section = (chapitre.sections ?? []).find(
          (sec) =>
            sec.kind === 'lesson' &&
            (sec.blocks ?? []).some(
              (b) => b.type === 'exercise' && (b.competencies ?? []).includes(code)
            )
        )
        if (!section) continue
        candidats.push({
          niveauCode: niveau,
          matiereCode: matiere,
          chapitreId: chapitre.id,
          sectionId: section.id,
          sectionTitre: section.title,
        })
      }
    }
  }
  // Stable sort: the level asked for first, the catalogue order kept for the rest.
  candidats.sort(
    (a, b) => Number(b.niveauCode === niveauDemande) - Number(a.niveauCode === niveauDemande)
  )
  return candidats[0] ?? null
}

/** A track in its catalogue order (`_index.json`), for a student with nothing recorded. */
async function parcours(niveau, matiere) {
  if (![niveau, matiere].every((s) => SEGMENT.test(s))) return []
  let ordre = []
  try {
    ordre = JSON.parse(await readFile(join(CONTENT_DIR, niveau, matiere, '_index.json'), 'utf8'))
  } catch {
    return []
  }
  return ordre.map((chapitreId, i) => ({
    chapitreId,
    ordre: i + 1,
    etat: i === 0 ? 'en_cours' : 'verrouille',
    pourcentage: 0,
  }))
}

/** The exercise block an `exerciceId` names, with its evaluation fields (not stripped). */
async function exercice(exerciceId) {
  for (const chapitre of await chapitres()) {
    for (const section of chapitre.sections ?? []) {
      for (const block of section.blocks ?? []) {
        if (block.type === 'exercise' && exerciceIdFor(chapitre.id, block.id) === exerciceId) {
          return block
        }
      }
    }
  }
  return null
}

// Mirrors ShortAnswerEvaluator.normalise (ADR 0012).
function normalise(text, caseSensitive) {
  let out = text.trim().normalize('NFD').replace(/\p{M}/gu, '')
  if (!caseSensitive) out = out.toLowerCase()
  return out.replace(/[\s.!?;]+$/, '')
}

/** Mirrors the backend's evaluators. `null`: an answer the backend would reject (400). */
function evaluer(block, answer) {
  const caseSensitive = block.caseSensitive === true
  switch (block.exerciseType) {
    case 'multiple-choice': {
      if (!Array.isArray(answer?.choiceIds)) return null
      const choisis = new Set(answer.choiceIds)
      const justes = new Set(block.choices.filter((c) => c.correct).map((c) => c.id))
      const correct = choisis.size === justes.size && [...choisis].every((id) => justes.has(id))
      const choiceFeedback = block.choices.map((c) => ({ choiceId: c.id, correct: !!c.correct }))
      return { correct, choiceFeedback, expectedValue: null }
    }
    case 'numeric': {
      if (typeof answer?.value !== 'number') return null
      const correct = Math.abs(answer.value - block.answer) <= (block.tolerance ?? 0)
      return { correct, choiceFeedback: [], expectedValue: block.answer }
    }
    case 'short-answer': {
      if (typeof answer?.text !== 'string' || answer.text.trim() === '') return null
      const saisie = normalise(answer.text, caseSensitive)
      const correct = block.acceptedAnswers.some((a) => normalise(a, caseSensitive) === saisie)
      return { correct, choiceFeedback: [], expectedValue: null }
    }
    case 'fill-blank': {
      const blanks = answer?.blanks
      if (!Array.isArray(blanks) || blanks.length !== block.expected.length) return null
      const correct = block.expected.every(
        (e, i) => normalise(String(blanks[i]), caseSensitive) === normalise(e, caseSensitive)
      )
      return { correct, choiceFeedback: [], expectedValue: null }
    }
    default:
      return null
  }
}

async function texte(req) {
  const morceaux = []
  for await (const morceau of req) morceaux.push(morceau)
  return Buffer.concat(morceaux).toString('utf8')
}

async function corps(req) {
  const morceaux = []
  for await (const morceau of req) morceaux.push(morceau)
  try {
    return JSON.parse(Buffer.concat(morceaux).toString('utf8'))
  } catch {
    return null
  }
}

// What UUID.fromString accepts: five dash-separated hex groups, each no longer than its slot.
const UUID_JAVA = /^[0-9a-f]{1,8}-[0-9a-f]{1,4}-[0-9a-f]{1,4}-[0-9a-f]{1,4}-[0-9a-f]{1,12}$/i

/** GET /api/cours/{id}, in CoursController.getCoursPublie's order. */
async function coursPublie(req, res, segment) {
  if (!connecte(req)) return send(res, 401)
  let coursId = ''
  try {
    coursId = decodeURIComponent(segment)
  } catch {
    // A malformed escape is no UUID either.
  }
  // A path id that is no UUID fails conversion: GlobalExceptionHandler's generic 400.
  if (!UUID_JAVA.test(coursId)) return send(res, 400, { error: 'Requête invalide' })
  const cours = [...COURS, COURS_HORS_PORTEE].find((c) => c.id === coursId.toLowerCase())
  if (!cours) return send(res, 404)
  const classesDuLecteur = sansClasse(req) || enseignant(req) ? [] : [CLASSE.id]
  if (!cours.classeIds.some((id) => classesDuLecteur.includes(id))) return send(res, 403)
  const [niveau, matiere, slug] = CONTENU_DES_COURS
  const json = await readFile(join(CONTENT_DIR, niveau, matiere, `${slug}.json`), 'utf8')
  return send(res, 200, { ...asServed(JSON.parse(json)), title: cours.titre })
}

/** The section ids of a published course's content in this fake (CONTENU_DES_COURS). */
async function sectionsDesCours() {
  const [niveau, matiere, slug] = CONTENU_DES_COURS
  const json = await readFile(join(CONTENT_DIR, niveau, matiere, `${slug}.json`), 'utf8')
  return JSON.parse(json).sections.map((section) => section.id)
}

/** The course id of a path segment, or null when UUID.fromString would refuse it (400). */
function idDeCours(segment) {
  let coursId = ''
  try {
    coursId = decodeURIComponent(segment)
  } catch {
    // A malformed escape is no UUID either.
  }
  return UUID_JAVA.test(coursId) ? coursId.toLowerCase() : null
}

/**
 * POST /api/cours/{coursId}/sections/{sectionId}/lu, in CoursController.marquerSectionCoursLue's
 * order: 400 (no UUID, id over 128), 404 (no course), 403 (out of scope), 404 (no such section).
 */
async function sectionCoursLue(req, res, segmentCours, segmentSection) {
  if (!connecte(req)) return send(res, 401)
  const coursId = idDeCours(segmentCours)
  const sectionId = decodeURIComponent(segmentSection)
  if (coursId === null || sectionId.length > 128) return send(res, 400)
  const cours = [...COURS, COURS_HORS_PORTEE].find((c) => c.id === coursId)
  if (!cours) return send(res, 404)
  const classesDuLecteur = sansClasse(req) || enseignant(req) ? [] : [CLASSE.id]
  if (!cours.classeIds.some((id) => classesDuLecteur.includes(id))) return send(res, 403)
  if (!(await sectionsDesCours()).includes(sectionId)) return send(res, 404)
  res.writeHead(204)
  return res.end()
}

/** GET /api/progression/cours/{coursId}: the gauge only for a student with rows on it, else 204. */
async function jaugeCours(req, res, segment) {
  const coursId = idDeCours(segment)
  if (coursId === null) return send(res, 400)
  if (!coursEnCours(req) || coursId !== COURS[0].id) return send(res, 204)
  const sectionsTotal = (await sectionsDesCours()).length
  return send(res, 200, {
    coursId,
    pourcentage: Math.round((100 * 1) / sectionsTotal),
    termine: false,
    sectionsLues: 1,
    sectionsTotal,
  })
}

/** « Reprendre » for E2E_SESSION_COURS_EN_COURS: the course, its published title (ADR 0050 §5). */
async function reprendreCours() {
  return {
    type: 'cours',
    coursId: COURS[0].id,
    titre: COURS[0].titre,
    sectionsLues: 1,
    sectionsTotal: (await sectionsDesCours()).length,
    derniereActivite: '2026-10-20T16:00:00Z',
  }
}

let soumissions = 0

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url ?? '/', 'http://localhost')

  // A session opened with a provisional password may only choose its password (ADR 0036 §5).
  const reinit = sessionReinit(req)
  const etatReinit = reinit ? sessionsReinit.get(reinit) : null
  if (reinit && req.method === 'DELETE' && pathname === '/api/sessions') {
    // Logout is handled before StatutCheckFilter: allowed even while the change is pending.
    sessionsReinit.delete(reinit)
    res.writeHead(204, { 'set-cookie': 'JSESSIONID=; Path=/; Max-Age=0' })
    return res.end()
  }
  if (etatReinit?.aChanger) {
    if (req.method === 'GET' && pathname === '/api/moi') {
      // The pseudonym is withheld until the student chose their password (ADR 0036 §9).
      return send(res, 200, {
        ...ELEVE,
        pseudonyme: null,
        doitChangerMotDePasse: true,
        accesReinitialise: null,
      })
    }
    if (req.method === 'POST' && pathname === '/api/moi/mot-de-passe') {
      const nouveau = (await corps(req))?.nouveauMotDePasse
      if (
        typeof nouveau !== 'string' ||
        nouveau.length < 8 ||
        Buffer.byteLength(nouveau, 'utf8') > 72
      ) {
        return send(res, 400, { error: 'Ton mot de passe est trop long.' })
      }
      if (canonique(nouveau) === etatReinit.provisoire) {
        return send(res, 422, {
          error: 'Choisis un mot de passe différent du mot de passe provisoire.',
        })
      }
      sessionsReinit.set(reinit, { ...etatReinit, aChanger: false })
      res.writeHead(204)
      return res.end()
    }
    return send(res, 403, { error: 'Choisis ton nouveau mot de passe avant de continuer.' })
  }
  if (etatReinit && req.method === 'GET' && pathname === '/api/moi') {
    // Once chosen, the student is told about the reset (ADR 0036 §8).
    return send(res, 200, {
      ...ELEVE,
      doitChangerMotDePasse: false,
      accesReinitialise: { le: etatReinit.le, par: 'enseignant' },
    })
  }

  if (pathname.startsWith('/api/communaute/')) {
    return communaute(req, res, pathname, searchParams)
  }
  if (pathname.startsWith('/api/admin/communaute/')) {
    return moderationAdmin(req, res, pathname)
  }

  // PL-7 (#399): the 3e C salon and its students. null when the request is none of them.
  if ((await salonDe3eC(req, res, pathname)) !== null) return

  if (req.method === 'GET') {
    if (pathname === '/api/reglages/communaute') return send(res, 200, { active: true })
    const chapitre = pathname.match(/^\/api\/chapitres\/([^/]+)\/([^/]+)\/([^/]+)$/)
    if (chapitre) {
      const [, niveau, matiere, slug] = chapitre
      if (![niveau, matiere, slug].every((s) => SEGMENT.test(s))) return send(res, 404)
      try {
        const json = await readFile(join(CONTENT_DIR, niveau, matiere, `${slug}.json`), 'utf8')
        return send(res, 200, asServed(JSON.parse(json)))
      } catch {
        return send(res, 404)
      }
    }
    if (pathname === '/api/moi' || pathname.startsWith('/api/progression/')) {
      if (!connecte(req)) return send(res, 401)
      // A student who has not earned anything yet, as ProgressionService returns them.
      if (pathname === '/api/moi') {
        return send(res, 200, enseignant(req) ? ENSEIGNANT : adminBrio(req) ? ADMIN : ELEVE)
      }
      if (pathname === '/api/progression/moi') return send(res, 200, { xpTotal: 0, niveau: 0 })
      const track = pathname.match(/^\/api\/progression\/parcours\/([^/]+)\/([^/]+)$/)
      if (track) return send(res, 200, await parcours(track[1], track[2]))
      if (pathname === '/api/progression/serie') {
        return send(res, 200, {
          joursConsecutifs: 0,
          dernierJourActif: null,
          gelsRestants: 1,
          actifAujourdhui: false,
        })
      }
      if (pathname === '/api/progression/reprendre') {
        if (coursEnCours(req)) return send(res, 200, await reprendreCours())
        return sansClasse(req) ? send(res, 204) : send(res, 200, REPRENDRE)
      }
      const jauge = pathname.match(/^\/api\/progression\/cours\/([^/]+)$/)
      if (jauge) return jaugeCours(req, res, jauge[1])
      if (pathname === '/api/progression/maitrise') {
        const code = competenceARevoir(req)
        if (code === null) return send(res, 200, [])
        // Worked yesterday, computed at run time so it stays inside the 30 days competenceARevoir keeps.
        const hier = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        return send(res, 200, [
          { competenceCode: code, niveau: 1, echantillon: 5, dernierTravail: hier },
        ])
      }
      return send(res, 404)
    }
    if (pathname === '/api/referentiel/libelles') {
      if (!connecte(req)) return send(res, 401)
      return send(res, 200, competenceARevoir(req) === null ? [] : await libelles())
    }
    if (pathname === '/api/referentiel/lecon') {
      if (!connecte(req)) return send(res, 401)
      const code = searchParams.get('competence')
      if (!code?.trim()) return send(res, 400)
      const lecon = await leconDe(code, searchParams.get('niveau'))
      return lecon ? send(res, 200, lecon) : send(res, 204)
    }

    // The teacher's class and its roster (ADR 0029), for the access reset (ADR 0036).
    if (pathname === '/api/prof/classes') {
      if (!connecte(req)) return send(res, 401)
      return enseignant(req) ? send(res, 200, [PROF_CLASSE, PROF_CLASSE_3EC]) : send(res, 403)
    }
    // The teacher's établissement (EtablissementPublicInfo), that /prof/classes groups the
    // classes by (PL-7, #399): without it the page cannot list the classes to click.
    if (pathname === '/api/prof/etablissements') {
      if (!connecte(req)) return send(res, 401)
      if (!enseignant(req)) return send(res, 403)
      return send(res, 200, [
        { id: PROF_CLASSE.etablissementId, nom: 'Collège Jean Moulin', type: 'college' },
      ])
    }
    const inscrits = pathname.match(/^\/api\/classes\/([^/]+)\/inscriptions$/)
    if (inscrits) {
      if (!connecte(req)) return send(res, 401)
      if (!enseignant(req) || inscrits[1] !== PROF_CLASSE.id) return send(res, 403)
      return send(res, 200, [PROF_INSCRIT])
    }

    // Class salon (F6b). A session that is not the test student's gets 401, as the backend
    // would for a logged-out caller — the client treats that as "no class".
    if (pathname === '/api/moi/classes') {
      if (!connecte(req)) return send(res, 401)
      return send(res, 200, sansClasse(req) ? [] : [CLASSE])
    }
    if (pathname === '/api/devoirs') {
      if (!connecte(req)) return send(res, 401)
      return send(res, 200, sansClasse(req) ? [] : DEVOIRS)
    }
    if (pathname === '/api/cours') {
      if (!connecte(req)) return send(res, 401)
      return send(
        res,
        200,
        sansClasse(req) ? [] : [...COURS].sort((a, b) => b.publieAt.localeCompare(a.publieAt))
      )
    }
    const unCours = pathname.match(/^\/api\/cours\/([^/]+)$/)
    if (unCours) return coursPublie(req, res, unCours[1])
    if (pathname === '/api/salons') {
      if (!connecte(req)) return send(res, 401)
      // The teacher teaches 4e A (no salon) and 3e C, not 5e B (PL-7, #399).
      if (enseignant(req)) {
        return send(res, 200, [salon3eCVue(), ...salonsDeLaSession(req).map(salonOuvertVue)])
      }
      return send(res, 200, sansClasse(req) ? [] : [SALON])
    }
    const messagesDuSalon = pathname.match(/^\/api\/salons\/([^/]+)\/messages$/)
    if (messagesDuSalon) {
      if (!connecte(req)) return send(res, 401)
      if (messagesDuSalon[1] !== SALON.id) return send(res, 404)
      return send(res, 200, salonMessages.filter((m) => m.statut !== 'masque').map(salonMessageVue))
    }
  }

  if (req.method === 'POST') {
    // Teacher-led access reset (ADR 0036): the class teacher only, for a student of the class.
    const reinitialisation = pathname.match(
      /^\/api\/classes\/([^/]+)\/inscriptions\/([^/]+)\/reinitialisation-acces$/
    )
    if (reinitialisation) {
      if (!connecte(req)) return send(res, 401)
      if (!enseignant(req) || reinitialisation[1] !== PROF_CLASSE.id) return send(res, 403)
      if (reinitialisation[2] !== PROF_INSCRIT.compteId) {
        return send(res, 404, { error: 'Élève non inscrit dans cette classe' })
      }
      const motDePasse = provisoire()
      provisoiresValides.set(canonique(motDePasse), new Date().toISOString())
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      return res.end(
        JSON.stringify({
          identifiantConnexion: IDENTIFIANT_REINIT,
          motDePasseProvisoire: motDePasse,
          expireLe: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        })
      )
    }
    // Form login (Spring Security's processing URL, not in the OpenAPI spec): only the student
    // above, with a provisional password, once. Everything else is the backend's single 401.
    if (pathname === '/api/sessions') {
      const form = new URLSearchParams(await texte(req))
      const motDePasse = canonique(form.get('mot_de_passe') ?? '')
      if (
        identifiantCanonique(form.get('identifiant') ?? '') !== IDENTIFIANT_REINIT ||
        !provisoiresValides.has(motDePasse)
      ) {
        return send(res, 401, { error: 'Identifiant ou mot de passe incorrect' })
      }
      const le = provisoiresValides.get(motDePasse)
      provisoiresValides.delete(motDePasse)
      const session = `e2e-reinit-${randomUUID()}`
      sessionsReinit.set(session, { aChanger: true, provisoire: motDePasse, le })
      res.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': `JSESSIONID=${session}; Path=/; HttpOnly; SameSite=Lax`,
      })
      return res.end(
        JSON.stringify({
          ...ELEVE,
          pseudonyme: null,
          doitChangerMotDePasse: true,
          accesReinitialise: null,
        })
      )
    }
    if (pathname === '/api/moi/mot-de-passe') {
      if (!connecte(req)) return send(res, 401)
      return send(res, 409, {
        error: "Aucun changement de mot de passe n'est demandé pour ce compte.",
      })
    }
    const soumission = pathname.match(/^\/api\/exercices\/([^/]+)\/soumissions$/)
    if (soumission) {
      if (!connecte(req)) return send(res, 401)
      const block = await exercice(soumission[1])
      if (!block) return send(res, 404)
      const resultat = evaluer(block, (await corps(req))?.answer)
      if (!resultat) return send(res, 400)
      soumissions += 1
      // T0 (#253), as SoumissionResponse.from: nothing that gives the answer away when wrong.
      return send(res, 200, {
        soumissionId: `00000000-0000-4000-8000-${String(soumissions).padStart(12, '0')}`,
        correct: resultat.correct,
        score: resultat.correct ? 1 : 0,
        choiceFeedback: resultat.choiceFeedback,
        expectedValue: resultat.correct ? resultat.expectedValue : null,
        explanation: resultat.correct ? (block.explanation ?? null) : null,
      })
    }
    const tuteur = pathname.match(/^\/api\/chapitres\/([^/]+)\/([^/]+)\/([^/]+)\/tuteur$/)
    if (tuteur) {
      if (!connecte(req)) return send(res, 401)
      const [, niveau, matiere, slug] = tuteur
      if (![niveau, matiere, slug].every((s) => SEGMENT.test(s))) return send(res, 404)
      const question = (await corps(req))?.question
      if (typeof question !== 'string' || question.trim() === '') return send(res, 400)
      let chapitre
      try {
        chapitre = JSON.parse(
          await readFile(join(CONTENT_DIR, niveau, matiere, `${slug}.json`), 'utf8')
        )
      } catch {
        return send(res, 404)
      }
      // No model here: a fixed answer citing a block that exists, as the server checks (ADR 0015).
      const section = chapitre.sections[0]
      return send(res, 200, {
        reponse: 'Relis le début du chapitre : la réponse s’y trouve.',
        citations: [`${section.id}/${section.blocks[0].id}`],
      })
    }
    const luCours = pathname.match(/^\/api\/cours\/([^/]+)\/sections\/([^/]+)\/lu$/)
    if (luCours && req.method === 'POST') return sectionCoursLue(req, res, luCours[1], luCours[2])
    if (/^\/api\/chapitres\/[^/]+\/sections\/[^/]+\/lu$/.test(pathname)) {
      res.writeHead(connecte(req) ? 204 : 401)
      return res.end()
    }

    // Class salon (F6b): publish a message, report a message.
    const publier = pathname.match(/^\/api\/salons\/([^/]+)\/messages$/)
    if (publier) {
      if (!connecte(req)) return send(res, 401)
      if (publier[1] !== SALON.id) return send(res, 404)
      const texte = ((await corps(req))?.corps ?? '').trim()
      if (!texte) return send(res, 422, { error: 'Message vide.' })
      const id = `msg-${salonMessages.length + 1}`
      salonMessages.push({
        id,
        auteurId: ELEVE.id,
        auteurNom: 'Moi',
        corps: texte,
        statut: 'publie',
        createdAt: '2026-10-12T10:00:00Z',
      })
      return send(res, 201, { id })
    }
    if (/^\/api\/salons\/messages\/[^/]+\/signalement$/.test(pathname)) {
      return send(res, connecte(req) ? 204 : 401)
    }
  }

  send(res, 404)
})

server.listen(PORT, () => {
  console.log(`fake backend on http://localhost:${PORT}`)
})
