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
 *   GET  /api/devoirs, /api/cours                 the test student's homework and courses
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
 *   GET  /api/prof/classes                        the test teacher's class (PROF_CLASSE)
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

/** A logged-in Brio admin: /api/moi answers admin_brio, the moderation console opens (#338). */
export const E2E_SESSION_ADMIN = 'JSESSIONID=e2e-admin'

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
    !!sessionReinit(req)
  )
}

function adminBrio(req) {
  return cookies(req).includes(E2E_SESSION_ADMIN)
}

function enseignant(req) {
  return cookies(req).includes(E2E_SESSION_ENSEIGNANT)
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
        return sansClasse(req) ? send(res, 204) : send(res, 200, REPRENDRE)
      }
      if (pathname === '/api/progression/maitrise') return send(res, 200, [])
      return send(res, 404)
    }
    if (pathname === '/api/referentiel/libelles') {
      if (!connecte(req)) return send(res, 401)
      return send(res, 200, [])
    }

    // The teacher's class and its roster (ADR 0029), for the access reset (ADR 0036).
    if (pathname === '/api/prof/classes') {
      if (!connecte(req)) return send(res, 401)
      return enseignant(req) ? send(res, 200, [PROF_CLASSE]) : send(res, 403)
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
      return send(res, 200, sansClasse(req) ? [] : COURS)
    }
    const unCours = pathname.match(/^\/api\/cours\/([^/]+)$/)
    if (unCours) return coursPublie(req, res, unCours[1])
    if (pathname === '/api/salons') {
      if (!connecte(req)) return send(res, 401)
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
