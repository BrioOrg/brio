/**
 * Route graph of the Next.js app in `web/` — the engine behind the click budget (#358, U1).
 *
 * Static analysis only: no build, no browser. It answers one question — "from this entry
 * screen, what is the fewest number of clicks that reaches that screen?" — by:
 *
 *  1. listing the routes from `web/app/**\/page.tsx` (route groups `(x)` are transparent,
 *     `[x]` segments are dynamic);
 *  2. reading the links a route offers: every route path written as a string in the page, in
 *     the layouts above it, and in every component those files import (transitively);
 *  3. running a 0-1 breadth-first search: a link costs one click, a page that does nothing
 *     but `redirect()` costs none.
 *
 * It is an *optimistic lower bound*: a link that exists in a component imported by the page
 * is counted even if a condition hides it for some users. That is the right bias for a
 * ratchet — the depth only ever moves when a link is added or removed in the code.
 *
 * Known blind spots (documented in docs/mesh/CARTE-ROUTES.md): links built from a variable
 * (`href={href}`), links delivered by the backend, and conditional rendering.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const PAGE_FILES = new Set(['page.tsx', 'page.ts', 'page.jsx', 'page.js'])
const LAYOUT_FILES = new Set(['layout.tsx', 'layout.ts', 'layout.jsx', 'layout.js'])
const SOURCE_EXT = ['.tsx', '.ts', '.jsx', '.js', '.mjs']
const PLACEHOLDER = '\u0000'

// ── Routes ─────────────────────────────────────────────────────────────────────────────────

function walk(dir, visit) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue
      walk(full, visit)
    } else {
      visit(full)
    }
  }
}

/** The URL segments of an `app/` directory: route groups vanish, `[x]` stays as a marker. */
function urlSegments(appDir, dir) {
  return relative(appDir, dir)
    .split(sep)
    .filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith('@'))
}

export function isDynamic(segment) {
  return /^\[.*\]$/.test(segment)
}

export function patternOf(segments) {
  return '/' + segments.join('/')
}

/**
 * Every page of the app, and the layouts that wrap it.
 * @returns {{pattern: string, segments: string[], file: string, layouts: string[]}[]}
 */
export function discoverRoutes(webDir) {
  const appDir = join(webDir, 'app')
  if (!existsSync(appDir)) throw new Error(`pas de dossier app/ dans ${webDir}`)
  const layoutsByDir = new Map()
  const pages = []
  walk(appDir, (file) => {
    const name = file.split(sep).pop()
    if (LAYOUT_FILES.has(name)) layoutsByDir.set(dirname(file), file)
    if (PAGE_FILES.has(name)) pages.push(file)
  })
  return pages.map((file) => {
    const dir = dirname(file)
    const segments = urlSegments(appDir, dir)
    // Layouts from the root down to the page's own directory.
    const layouts = []
    let cur = appDir
    const parts = relative(appDir, dir).split(sep).filter(Boolean)
    if (layoutsByDir.has(cur)) layouts.push(layoutsByDir.get(cur))
    for (const part of parts) {
      cur = join(cur, part)
      if (layoutsByDir.has(cur)) layouts.push(layoutsByDir.get(cur))
    }
    return { pattern: patternOf(segments), segments, file, layouts }
  })
}

// ── Source reading ─────────────────────────────────────────────────────────────────────────

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

function resolveImport(webDir, fromFile, spec) {
  let base
  if (spec.startsWith('@/')) base = join(webDir, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null // npm package or workspace package: no routes in there
  const candidates = [
    base,
    ...SOURCE_EXT.map((e) => base + e),
    ...SOURCE_EXT.map((e) => join(base, 'index' + e)),
  ]
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
}

function importsOf(webDir, file, src) {
  const specs = new Set()
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) specs.add(m[1])
  return [...specs].map((s) => resolveImport(webDir, file, s)).filter(Boolean)
}

/** A file, and everything it imports from `web/` (excluding tests). */
export function closureOf(webDir, entry, cache = new Map()) {
  if (cache.has(entry)) return cache.get(entry)
  const seen = new Set()
  const stack = [entry]
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f) || f.includes(`${sep}__tests__${sep}`)) continue
    seen.add(f)
    stack.push(...importsOf(webDir, f, stripComments(readFileSync(f, 'utf8'))))
  }
  cache.set(entry, seen)
  return seen
}

// ── Links ──────────────────────────────────────────────────────────────────────────────────

/** `/${a}/x?y=1` → { segments: ['\0', 'x'], placeholders: true }; null when it is no route path. */
function parsePath(raw) {
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  const noPlaceholders = raw.replace(/\$\{[^}]*\}/g, PLACEHOLDER)
  const path = noPlaceholders.split(/[?#]/)[0]
  if (path.includes(' ') || path.includes('\\')) return null
  const segments = path.split('/').slice(1)
  const trimmed = segments.at(-1) === '' ? segments.slice(0, -1) : segments
  if (trimmed.some((s) => s === '')) return null
  return { segments: trimmed, placeholders: path.includes(PLACEHOLDER) }
}

/**
 * Pick the route a link points to. Next prefers the most specific match, so does this:
 * the route with the most static segments equal to the link's wins.
 */
export function matchRoute(parsed, routes) {
  if (parsed.segments[0] === 'api') return null
  let best = null
  for (const route of routes) {
    if (route.segments.length !== parsed.segments.length) continue
    // A path written without any placeholder points at a static route only.
    if (!parsed.placeholders && route.segments.some(isDynamic)) continue
    let score = 0
    let ok = true
    for (let i = 0; i < route.segments.length && ok; i++) {
      const r = route.segments[i]
      const l = parsed.segments[i]
      if (isDynamic(r)) continue
      if (r === l) score += 1
      else ok = false
    }
    if (ok && (!best || score > best.score)) best = { route, score }
  }
  return best?.route ?? null
}

const DEAD_LINK_CONTEXT = /(href\s*[=:]\s*\{?\s*|push\(\s*|replace\(\s*|redirect\(\s*)$/
const LINK_CONTEXT = /(href|push|replace|redirect|to|from|retour|chemin)\W{0,6}$/i

/**
 * Route links found in a source text.
 * @returns {{pattern: string, redirect: boolean}[]}
 */
export function linksIn(src, routes) {
  const text = stripComments(src)
  const found = []
  found.dead = []
  const literal = /(['"`])(\/(?:[^'"`\n\\]|\\.)*?)\1/g
  for (const m of text.matchAll(literal)) {
    const raw = m[2]
    const before = text.slice(Math.max(0, m.index - 40), m.index)
    // A lone "/" is far too common as a string: only count it next to a link-ish keyword.
    if (raw === '/' && !LINK_CONTEXT.test(before)) continue
    const parsed = parsePath(raw)
    if (!parsed) continue
    const route = parsed.segments.length === 0 ? routes.find((r) => r.pattern === '/') : matchRoute(parsed, routes)
    if (!route) {
      // A path handed to href / push / redirect that no page serves: a dead link.
      if (!parsed.placeholders && DEAD_LINK_CONTEXT.test(before) && parsed.segments[0] !== 'api') {
        found.dead.push('/' + parsed.segments.join('/'))
      }
      continue
    }
    found.push({ pattern: route.pattern, redirect: /redirect\(\s*$/.test(before) })
  }
  return found
}

/** A page whose only job is `redirect(...)` — it costs no click. */
export function isPureRedirect(src) {
  const body = stripComments(src).replace(/^\s*import[^\n]*\n/gm, '')
  return /redirect\(/.test(body) && !/<[A-Za-z]/.test(body) && !/\breturn\s*\(/.test(body)
}

// ── Graph ──────────────────────────────────────────────────────────────────────────────────

/**
 * @returns {{routes: object[], edges: Map<string, Map<string, {weight: number, via: string}>>, deadLinks: Map<string, Set<string>>}}
 */
export function buildGraph(webDir) {
  const routes = discoverRoutes(webDir)
  const cache = new Map()
  const rel = (f) => relative(webDir, f).split(sep).join('/')
  const edges = new Map(routes.map((r) => [r.pattern, new Map()]))
  const deadLinks = new Map() // path -> Set of files that carry it
  const add = (from, to, weight, via) => {
    if (from === to) return
    const cur = edges.get(from).get(to)
    if (!cur || weight < cur.weight) edges.get(from).set(to, { weight, via })
  }
  for (const page of routes) {
    const pureRedirect = isPureRedirect(readFileSync(page.file, 'utf8'))
    const entries = [page.file, ...page.layouts]
    for (const entry of entries) {
      for (const file of closureOf(webDir, entry, cache)) {
        const links = linksIn(readFileSync(file, 'utf8'), routes)
        for (const dead of links.dead) {
          // A file served from public/ (the icon sprite, a PDF) is not a page, and not dead.
          if (existsSync(join(webDir, 'public', dead))) continue
          if (!deadLinks.has(dead)) deadLinks.set(dead, new Set())
          deadLinks.get(dead).add(rel(file))
        }
        for (const link of links) {
          if (link.redirect) {
            // Only an unconditional redirect (the page does nothing else) is a free hop.
            if (pureRedirect && entry === page.file && file === page.file) {
              add(page.pattern, link.pattern, 0, rel(file))
            }
            continue
          }
          add(page.pattern, link.pattern, 1, rel(file))
        }
      }
    }
  }
  return { routes, edges, deadLinks }
}

/** 0-1 BFS: fewest clicks from `start` to every route, with the path that gets there. */
export function depthsFrom(graph, start, allow = () => true) {
  const dist = new Map([[start, 0]])
  const prev = new Map()
  const deque = [start]
  while (deque.length) {
    const node = deque.shift()
    for (const [to, { weight, via }] of graph.edges.get(node) ?? []) {
      if (!allow(to)) continue
      const d = dist.get(node) + weight
      if (!dist.has(to) || d < dist.get(to)) {
        dist.set(to, d)
        prev.set(to, { from: node, via })
        if (weight === 0) deque.unshift(to)
        else deque.push(to)
      }
    }
  }
  return { dist, prev }
}

export function pathTo(prev, start, target) {
  const hops = []
  let cur = target
  while (cur !== start && prev.has(cur)) {
    const { from, via } = prev.get(cur)
    hops.unshift({ from, to: cur, via })
    cur = from
  }
  return hops
}
