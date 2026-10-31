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
 *   GET  /api/moi/classes, /api/salons            the test student's class and salon, none for
 *                                                 E2E_SESSION_SANS_CLASSE; 401 without a session
 *   GET  /api/salons/{id}/messages                that salon's messages, own ones flagged
 *   POST /api/salons/{id}/messages                201 { id }; 422 on an empty body
 *   POST /api/salons/messages/{id}/signalement    204 with a session, 401 without
 *   GET  /api/reglages/communaute                 public, always active: the off state is covered
 *                                                 by Vitest, as it needs another server setting
 *   /api/communaute/**                            the Communauté (ADR 0035), kept in memory with
 *                                                 CommunauteService's rules; 403 for a teacher
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

function cookies(req) {
  return (req.headers.cookie ?? '').split(/;\s*/)
}

/** Any live session. Another JSESSIONID (`e2e-expiree`…) is a session the backend has dropped. */
function connecte(req) {
  return cookies(req).includes(E2E_SESSION) || sansClasse(req) || enseignant(req)
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

const ENSEIGNANT = {
  id: '00000000-0000-4000-8000-0000000000e3',
  role: 'enseignant',
  statut: 'actif',
  nom: 'M. Dubois',
  email: 'prof.e2e@example.org',
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
// Their homework, one of which points to a chapter (#322), and a course of their class.
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
]
const COURS = [
  {
    id: 'cours-fractions',
    titre: 'Les fractions, version M. Dubois',
    niveauCode: '5e',
    matiereCode: 'mathematiques',
    enseignant: 'M. Dubois',
    publieAt: '2026-10-01T08:00:00Z',
    classeIds: [CLASSE.id],
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
      .filter((c) => c.parentId === r.id)
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
  if (enseignant(req)) return send(res, 403, { error: 'La Communauté est réservée aux élèves.' })
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
        .filter((q) => (!niveau || q.niveau === niveau) && (!matiere || q.matiere === matiere))
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
      return send(res, 200, {
        questions: trouvees.slice(page * taille, (page + 1) * taille).map((q) => ({
          ...questionCommune(q, lecteur),
          nombreReponses: reponsesCommunaute.filter((r) => r.questionId === q.id && !r.parentId)
            .length,
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
    /^\/api\/communaute\/questions\/([^/]+)(?:\/(vote|reponses)(?:\/([^/]+)\/resolution)?)?$/
  )
  if (routeQuestion) {
    const [, questionId, suite, reponseId] = routeQuestion
    const question = questionsCommunaute.find((q) => q.id === questionId)
    if (!question) return introuvable()
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
          .filter((r) => r.questionId === questionId && !r.parentId)
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
    /^\/api\/communaute\/reponses\/([^/]+)(?:\/(vote|commentaires))?$/
  )
  if (routeReponse) {
    const [, reponseId, suite] = routeReponse
    const reponse = reponsesCommunaute.find((r) => r.id === reponseId)
    if (!reponse) return introuvable()
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

async function corps(req) {
  const morceaux = []
  for await (const morceau of req) morceaux.push(morceau)
  try {
    return JSON.parse(Buffer.concat(morceaux).toString('utf8'))
  } catch {
    return null
  }
}

let soumissions = 0

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url ?? '/', 'http://localhost')

  if (pathname.startsWith('/api/communaute/')) {
    return communaute(req, res, pathname, searchParams)
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
      if (pathname === '/api/moi') return send(res, 200, enseignant(req) ? ENSEIGNANT : ELEVE)
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
