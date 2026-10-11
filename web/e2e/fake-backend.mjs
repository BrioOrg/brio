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
 *   GET /api/moi, /api/progression/*              401: an anonymous visitor
 *   anything else                                 404 (the catalogue too: the page falls back
 *                                                 to codes, nothing is invented)
 *
 * Add a route when a test needs one, never a value the real backend would not return.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
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
      return send(res, 401)
    }
  }

  send(res, 404)
})

server.listen(PORT, () => {
  console.log(`fake backend on http://localhost:${PORT}`)
})
