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
 *   GET /api/moi, /api/progression/*              401: an anonymous visitor; with the test
 *                                                 student's session (E2E_SESSION), that student,
 *                                                 who has not earned any XP yet
 *   GET /api/progression/parcours/{niveau}/{matiere}  that student's path, as ProgressionService
 *                                                 returns it before anything is recorded: every
 *                                                 chapter at 0 %, the first `en_cours`, the
 *                                                 others `verrouille`
 *   POST /api/exercices/{id}/soumissions          graded from content/ like the backend's
 *                                                 evaluators (#246); 401 without a session
 *   POST /api/chapitres/{id}/sections/{s}/lu      204 with a session, 401 without
 *   GET  /api/moi/classes, /api/salons            the test student's class and salon; 401
 *                                                 without that student's session (F6b)
 *   GET  /api/salons/{id}/messages                that salon's messages, own ones flagged
 *   POST /api/salons/{id}/messages                201 { id }; 422 on an empty body
 *   POST /api/salons/messages/{id}/signalement    204 with a session, 401 without
 *   anything else                                 404 (the catalogue too: the page falls back
 *                                                 to codes, nothing is invented)
 *
 * Add a route when a test needs one, never a value the real backend would not return.
 */
import { createHash } from 'node:crypto'
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

function connecte(req) {
  return (req.headers.cookie ?? '').split(/;\s*/).includes(E2E_SESSION)
}

const ELEVE = {
  id: '00000000-0000-4000-8000-0000000000e2',
  role: 'eleve',
  statut: 'actif',
  nom: null,
  email: null,
}

// The logged-in student's class and its salon (F6b, #270), for /ma-classe. `estMoi` is derived
// per reader, as the real backend does — the student's own messages are the ones they authored.
const CLASSE = { id: 'classe-5eB', libelle: '5e B', niveauCode: '5e' }
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
  const { pathname } = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'GET') {
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
      if (pathname === '/api/moi') return send(res, 200, ELEVE)
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
      return send(res, 404)
    }

    // Class salon (F6b). A session that is not the test student's gets 401, as the backend
    // would for a logged-out caller — the client treats that as "no class".
    if (pathname === '/api/moi/classes') {
      return connecte(req) ? send(res, 200, [CLASSE]) : send(res, 401)
    }
    if (pathname === '/api/salons') {
      return connecte(req) ? send(res, 200, [SALON]) : send(res, 401)
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
