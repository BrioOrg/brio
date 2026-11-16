#!/usr/bin/env node
// Contract-drift check (mesh Phase 3, #358) — the deterministic half of V2 Gardien des contrats.
//
// Four representations of the same API must agree:
//   1. docs/api/openapi.json            the committed contract (reference)
//   2. packages/api-client/src/*.ts     manual Zod wrappers (+ web/lib/*.ts that call /api/…)
//   3. web/e2e/fake-backend.mjs         the e2e fake backend
//   4. the real backend                 springdoc /v3/api-docs, compared via --actual
//
//   node scripts/mesh/verification/check-contract-drift.mjs \
//     [--actual backend/target/openapi-actual.json] [--out verdicts/verdict-V2.json] [--fail-on blocking]
//
// What it flags (severity in brackets):
//   - a client/web call to /api/… that the spec does not know          [blocking]
//   - a route documented in a wrapper's "Server contracts" docblock whose METHOD the spec lacks [blocking]
//   - a fake-backend route the spec does not know                      [blocking]
//   - committed spec ≠ real backend output (--actual)                  [blocking]
//   - a z.object() key found in no OpenAPI schema (heuristic)          [important]
//   - --actual given but missing                                       [important]
// Exceptions: mesh/verification/contract-allowlist.json (each entry needs a "reason").
// Limits (deliberate, skeleton): paths and property NAMES only — not types, required-ness or
// status codes; the Zod check is name-based. Typed comparison is the next iteration.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { makeVerdict } from './lib/verdict.mjs'

const METHODS = ['get', 'post', 'put', 'patch', 'delete']

// ── spec ─────────────────────────────────────────────────────────────────────
export function buildSpecIndex(spec) {
  const templates = Object.keys(spec.paths ?? {}).map((p) => ({
    template: p,
    regex: new RegExp('^' + p.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+') + '$'),
    methods: METHODS.filter((m) => spec.paths[p][m]),
  }))
  const props = new Set()
  const collect = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.properties) for (const k of Object.keys(node.properties)) props.add(k)
    for (const v of Object.values(node)) collect(v)
  }
  collect(spec.components?.schemas)
  for (const p of Object.values(spec.paths ?? {})) collect(p)
  return { templates, props, prefixes: Object.keys(spec.paths ?? {}) }
}

/** Matches a concrete or templated path (`{}` for a variable segment) against the spec. */
export function findPath(index, path) {
  const normalized = path.replace(/\{[^}]*\}/g, 'x').replace(/\/+$/, '')
  return index.templates.find((t) => t.regex.test(normalized))
}

// ── client calls ─────────────────────────────────────────────────────────────
const stripTemplates = (s) => s.replace(/\$\{[^}]*\}/g, '{}')

export function extractClientPaths(source) {
  const found = []
  source.split('\n').forEach((line, i) => {
    const t = line.trim()
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return
    if (!/[`'"]/.test(line)) return
    const cleaned = stripTemplates(line)
    for (const m of cleaned.matchAll(/(\/api\/[^`'"\s?#)]*)/g))
      // A `{}` glued to a word (`/api/x${qs}`, `/api/x${chemin}`) is a dynamic suffix (query string
      // or sub-path): only the prefix can be checked.
      found.push({ path: m[1].replace(/([\w-])\{\}$/, '$1'), dynamicSuffix: /([\w-])\{\}$/.test(m[1]), line: i + 1 })
  })
  return found
}

/** `GET /api/x/{id}` lines of the "Server contracts" docblocks. */
export function extractDocumentedContracts(source) {
  const found = []
  source.split('\n').forEach((line, i) => {
    const m = /^\s*\*\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/\S+)/.exec(line)
    if (!m) return
    const path = m[2].split('?')[0].replace(/[.,;:]+$/, '')
    // `{questions|reponses}` documents two routes at once.
    const alt = /\{([a-z-]+(?:\|[a-z-]+)+)\}/.exec(path)
    const paths = alt ? alt[1].split('|').map((a) => path.replace(alt[0], a)) : [path]
    for (const p of paths) found.push({ method: m[1].toLowerCase(), path: p, line: i + 1 })
  })
  return found
}

// ── fake backend ─────────────────────────────────────────────────────────────
/** Reads a regex literal starting at `i` (the leading `/`); handles escapes and character classes. */
function readRegexLiteral(src, i) {
  if (src[i] !== '/') return null
  let j = i + 1
  let inClass = false
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') j += 2
    else if (c === '[') (inClass = true), j++
    else if (c === ']') (inClass = false), j++
    else if (c === '/' && !inClass) return src.slice(i + 1, j)
    else if (c === '\n') return null
    else j++
  }
  return null
}

/** `^\/api\/x\/([^/]+)(?:\/y)?$` → `/api/x/{}` (optional groups dropped, captures become `{}`). */
export function regexToPath(source) {
  let out = ''
  let i = 0
  const src = source.replace(/^\^/, '').replace(/\$$/, '')
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') {
      out += src[i + 1]
      i += 2
    } else if (c === '(') {
      let depth = 1
      let j = i + 1
      let inClass = false
      while (j < src.length && depth > 0) {
        if (src[j] === '\\') j++
        else if (src[j] === '[') inClass = true
        else if (src[j] === ']') inClass = false
        else if (!inClass && src[j] === '(') depth++
        else if (!inClass && src[j] === ')') depth--
        j++
      }
      const optional = src[j] === '?' || src[j] === '*'
      if (!optional && !src.startsWith('?:', i + 1)) out += '{}'
      else if (!optional) out += src.slice(i + 3, j - 1)
      i = j + (optional ? 1 : 0)
    } else {
      out += c
      i++
    }
  }
  return out
}

export function extractFakeBackendRoutes(source) {
  const routes = []
  const lineAt = (idx) => source.slice(0, idx).split('\n').length
  for (const m of source.matchAll(/pathname\s*===\s*'(\/api\/[^']*)'/g)) routes.push({ path: m[1], line: lineAt(m.index) })
  for (const m of source.matchAll(/pathname\.startsWith\('(\/api\/[^']*)'\)/g)) routes.push({ path: m[1], prefix: true, line: lineAt(m.index) })
  for (const m of source.matchAll(/pathname\.match\(\s*/g)) {
    const lit = readRegexLiteral(source, m.index + m[0].length)
    if (!lit) continue
    const path = regexToPath(lit)
    if (path.startsWith('/api/')) routes.push({ path, line: lineAt(m.index) })
  }
  return routes
}

// ── Zod keys ─────────────────────────────────────────────────────────────────
export function extractZodKeys(source) {
  const keys = []
  const lineAt = (idx) => source.slice(0, idx).split('\n').length
  for (const m of source.matchAll(/z\s*\.\s*object\s*\(\s*\{/g)) {
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    while (i < source.length && depth > 0) {
      const c = source[i]
      if (c === '{' || c === '(' || c === '[') depth++
      else if (c === '}' || c === ')' || c === ']') depth--
      i++
    }
    // Top-level keys of this object literal only.
    let d = 0
    const body = source.slice(start, i - 1)
    let lineStart = 0
    for (let j = 0; j <= body.length; j++) {
      const c = body[j]
      if (c === '{' || c === '(' || c === '[') d++
      else if (c === '}' || c === ')' || c === ']') d--
      if ((c === '\n' || j === body.length) && true) {
        lineStart = j + 1
      }
      if (d === 0 && (j === 0 || body[j - 1] === '\n' || body[j - 1] === ',' || body[j - 1] === '{')) {
        const km = /^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/.exec(body.slice(j))
        if (km && !/^\s*\/\//.test(body.slice(j))) keys.push({ key: km[1] ?? km[2] ?? km[3], line: lineAt(start + j + km[0].length - 1) })
      }
    }
  }
  return keys
}

// ── allowlist ────────────────────────────────────────────────────────────────
function loadAllowlist(path) {
  if (!existsSync(path)) return { clientPaths: [], fakeBackendPaths: [], zodFields: [], problems: [] }
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  const problems = []
  const norm = (arr = [], kind) =>
    arr.flatMap((e) => {
      if (!e || typeof e !== 'object' || !e.value || !e.reason) {
        problems.push(`entrée d'allowlist « ${kind} » sans valeur ou sans raison : ${JSON.stringify(e)}`)
        return []
      }
      return [e.value]
    })
  return { clientPaths: norm(raw.clientPaths, 'clientPaths'), fakeBackendPaths: norm(raw.fakeBackendPaths, 'fakeBackendPaths'), zodFields: norm(raw.zodFields, 'zodFields'), problems }
}

// ── real backend diff ────────────────────────────────────────────────────────
export function diffJson(a, b, path = '', out = [], limit = 10) {
  if (out.length >= limit) return out
  if (JSON.stringify(a) === JSON.stringify(b)) return out
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) diffJson(a[k], b[k], `${path}/${k}`, out, limit)
  } else {
    out.push(path || '/')
  }
  return out
}

// ── files ────────────────────────────────────────────────────────────────────
function listFiles(dir, exts, skip = ['generated', 'node_modules', '__tests__']) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return skip.includes(n) ? [] : listFiles(p, exts, skip)
    return exts.some((e) => n.endsWith(e)) ? [p] : []
  })
}

export function runCheck({ root, actualPath, requireActual = false }) {
  const rel = (p) => relative(root, p)
  const findings = []
  const specPath = join(root, 'docs/api/openapi.json')
  const spec = JSON.parse(readFileSync(specPath, 'utf8'))
  const index = buildSpecIndex(spec)
  const allow = loadAllowlist(join(root, 'mesh/verification/contract-allowlist.json'))
  for (const p of allow.problems) findings.push({ severity: 'important', file: 'mesh/verification/contract-allowlist.json', message: p })

  // 2. client wrappers + web/lib
  const clientFiles = [...listFiles(join(root, 'packages/api-client/src'), ['.ts']), ...listFiles(join(root, 'web/lib'), ['.ts', '.tsx'])]
  const seen = new Set()
  for (const f of clientFiles) {
    const src = readFileSync(f, 'utf8')
    for (const c of extractClientPaths(src)) {
      if (allow.clientPaths.includes(c.path) || seen.has(`${f}|${c.path}`)) continue
      seen.add(`${f}|${c.path}`)
      const known = c.dynamicSuffix ? index.prefixes.some((p) => p.startsWith(c.path)) : !!findPath(index, c.path)
      if (!known)
        findings.push({ severity: 'blocking', file: rel(f), line: c.line, rule: 'frontend.md · contrat OpenAPI', message: `Le client appelle \`${c.path}\`, route absente de docs/api/openapi.json.`, fix: 'Aligner le client sur le backend, ou régénérer la spec (`pnpm api:refresh`) si la route existe côté backend.' })
    }
    for (const d of extractDocumentedContracts(src)) {
      if (allow.clientPaths.includes(d.path)) continue
      const hit = findPath(index, d.path)
      if (!hit)
        findings.push({ severity: 'blocking', file: rel(f), line: d.line, rule: 'contrat documenté', message: `Contrat documenté \`${d.method.toUpperCase()} ${d.path}\` : route absente de la spec.` })
      else if (!hit.methods.includes(d.method))
        findings.push({ severity: 'blocking', file: rel(f), line: d.line, rule: 'contrat documenté', message: `Contrat documenté \`${d.method.toUpperCase()} ${d.path}\` : la spec n'expose que ${hit.methods.join(', ').toUpperCase() || 'aucune méthode'} sur \`${hit.template}\`.` })
    }
    // Zod keys (heuristic, name-based)
    const zodSeen = new Set()
    for (const k of extractZodKeys(src)) {
      if (index.props.has(k.key) || allow.zodFields.includes(k.key) || zodSeen.has(k.key)) continue
      zodSeen.add(k.key)
      findings.push({ severity: 'important', file: rel(f), line: k.line, rule: 'schéma Zod ↔ OpenAPI', message: `Champ Zod \`${k.key}\` introuvable dans les schémas OpenAPI (renommage non répercuté, ou champ inventé).`, fix: 'Vérifier le nom côté backend ; si le champ est volontairement local au client, l\'ajouter à contract-allowlist.json avec une raison.' })
    }
  }

  // 3. fake backend
  const fakePath = join(root, 'web/e2e/fake-backend.mjs')
  if (existsSync(fakePath)) {
    for (const r of extractFakeBackendRoutes(readFileSync(fakePath, 'utf8'))) {
      if (allow.fakeBackendPaths.includes(r.path)) continue
      const ok = r.prefix ? index.prefixes.some((p) => p.startsWith(r.path)) : !!findPath(index, r.path)
      if (!ok)
        findings.push({ severity: 'blocking', file: rel(fakePath), line: r.line, rule: 'frontend.md · faux backend', message: `Le faux backend sert \`${r.path}\`${r.prefix ? '*' : ''}, route que le vrai backend n'expose pas (spec).`, fix: 'Un faux backend ne renvoie que ce que le vrai backend renverrait : retirer la route ou ajouter l\'endpoint au backend.' })
    }
  }

  // 4. real backend
  let realChecked = false
  if (actualPath && existsSync(actualPath)) {
    realChecked = true
    const actual = JSON.parse(readFileSync(actualPath, 'utf8'))
    const diffs = diffJson(spec, actual)
    if (diffs.length)
      findings.push({ severity: 'blocking', file: 'docs/api/openapi.json', rule: 'OpenApiContractTest', message: `La spec committée diffère du backend réel (${diffs.length}${diffs.length >= 10 ? '+' : ''} écart(s)), p. ex. ${diffs.slice(0, 5).map((d) => '`' + d + '`').join(', ')}.`, fix: 'Si le changement est voulu : `pnpm api:refresh` puis commiter `docs/api/openapi.json`.' })
  } else if (requireActual) {
    findings.push({ severity: 'important', message: `Sortie réelle du backend absente (${actualPath ?? '--actual non fourni'}) : comparaison spec ↔ backend non faite.` })
  }

  const blocking = findings.filter((f) => f.severity === 'blocking').length
  const summary = `${clientFiles.length} fichiers client, ${index.templates.length} routes en spec${realChecked ? ', backend réel comparé' : ', backend réel non comparé'} — ${blocking} dérive(s) bloquante(s).`
  return makeVerdict('V2', 'Gardien des contrats', findings, summary)
}

function main() {
  const args = process.argv.slice(2)
  const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
  const root = process.cwd()
  const verdict = runCheck({ root, actualPath: opt('--actual'), requireActual: args.includes('--require-actual') })
  const out = opt('--out')
  if (out) {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(verdict, null, 2) + '\n')
  }
  console.log(`V2 · ${verdict.verdict} · ${verdict.summary}`)
  for (const f of verdict.findings.slice(0, 40)) console.log(`  ${f.severity.padEnd(10)} ${f.file ?? ''}${f.line ? ':' + f.line : ''}  ${f.message}`)
  if (opt('--fail-on') === 'blocking' && verdict.verdict === 'veto') process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
