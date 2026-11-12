import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { compareToBase, evaluate, validateTasks } from '../lib/click-budget.mjs'
import { buildGraph, depthsFrom, discoverRoutes, linksIn, matchRoute } from '../lib/route-graph.mjs'

/** A throwaway `web/` directory from { 'relative/path': 'source' }. */
function fixture(files) {
  const web = mkdtempSync(join(tmpdir(), 'mesh-routes-'))
  for (const [path, src] of Object.entries(files)) {
    const full = join(web, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, src)
  }
  return web
}

const APP = {
  'app/layout.tsx': 'export default function L({children}){return children}',
  'app/(app)/layout.tsx': `import { Nav } from '@/components/nav'\nexport default function L({children}){return <Nav>{children}</Nav>}`,
  'components/nav.tsx': `export const Nav = () => <nav><a href="/">Accueil</a><a href="/explorer">Explorer</a><a href="/profil">Profil</a></nav>`,
  'app/(app)/page.tsx': `import Link from 'next/link'\nexport default () => <><Link href="/ma-classe">Classe</Link><Link href="/devoirs">Devoirs</Link></>`,
  'app/(app)/explorer/page.tsx': 'export default () => <a href={`/${n}/${m}`}>matière</a>',
  'app/(app)/ma-classe/page.tsx': `export default () => <a href="/ma-classe/salon">Salon</a>`,
  'app/(app)/ma-classe/salon/page.tsx': `export default () => <p>Salon</p>`,
  'app/(app)/[niveau]/[matiere]/page.tsx': 'export default () => <a href={`/${n}/${m}/${s}`}>chapitre</a>',
  'app/(app)/[niveau]/[matiere]/[slug]/page.tsx': 'export default () => <p>chapitre</p>',
  'app/(app)/devoirs/page.tsx': `import { redirect } from 'next/navigation'\nexport default function P() { redirect('/ma-classe') }`,
  'app/(app)/profil/page.tsx': `export default function P() { if (!ok) redirect('/explorer'); return (<p>profil</p>) }`,
  'app/(app)/orpheline/page.tsx': 'export default () => <p>personne ne me lie</p>',
}

test('discoverRoutes: route groups vanish, dynamic segments stay', () => {
  const routes = discoverRoutes(fixture(APP))
  const patterns = routes.map((r) => r.pattern).sort()
  assert.ok(patterns.includes('/'))
  assert.ok(patterns.includes('/[niveau]/[matiere]/[slug]'))
  assert.ok(!patterns.some((p) => p.includes('(app)')))
})

test('matchRoute: the most specific route wins, plain paths never hit dynamic routes', () => {
  const routes = [
    { pattern: '/ma-classe/salon', segments: ['ma-classe', 'salon'] },
    { pattern: '/[niveau]/[matiere]', segments: ['[niveau]', '[matiere]'] },
  ]
  const placeholder = '\u0000'
  assert.equal(matchRoute({ segments: ['ma-classe', 'salon'], placeholders: false }, routes).pattern, '/ma-classe/salon')
  assert.equal(matchRoute({ segments: [placeholder, placeholder], placeholders: true }, routes).pattern, '/[niveau]/[matiere]')
  assert.equal(matchRoute({ segments: ['5e', 'maths'], placeholders: false }, routes), null)
  assert.equal(matchRoute({ segments: ['api', 'x'], placeholders: true }, routes), null)
})

test('linksIn: comments are ignored, a lone "/" needs a link context, dead links are reported', () => {
  const routes = discoverRoutes(fixture(APP))
  const src = `
    // <a href="/explorer">commented out</a>
    const sep = '/'
    <a href="/">home</a>
    <a href="/ma-classe?x=1">classe</a>
    <a href="/nulle-part">dead</a>
    fetch('/api/moi')
  `
  const links = linksIn(src, routes).map((l) => l.pattern)
  assert.deepEqual(links.sort(), ['/', '/ma-classe'])
  assert.deepEqual(linksIn(src, routes).dead, ['/nulle-part'])
})

test('buildGraph: layout links reach every page below, a pure redirect is free, a guard is not', () => {
  const g = buildGraph(fixture(APP))
  assert.equal(g.edges.get('/ma-classe/salon').get('/explorer').weight, 1) // from the (app) layout
  assert.equal(g.edges.get('/devoirs').get('/ma-classe').weight, 0)
  assert.equal(g.edges.get('/profil').has('/explorer'), true) // via the layout nav, at cost 1…
  assert.equal(g.edges.get('/profil').get('/explorer').weight, 1) // …never as a free guard redirect
})

test('depthsFrom: a redirect adds no click', () => {
  const files = { ...APP, 'app/(app)/page.tsx': 'export default () => <a href="/devoirs">Devoirs</a>' }
  const g = buildGraph(fixture(files))
  const { dist } = depthsFrom(g, '/')
  assert.equal(dist.get('/devoirs'), 1)
  assert.equal(dist.get('/ma-classe'), 1) // one click to /devoirs, which redirects for free
})

const DEF = {
  version: 1,
  personas: { eleve: { entree: '/', exclut: ['/prof'] } },
  attendus: { horsNavigation: ['/orpheline'], liensMorts: [] },
  taches: [
    { id: 'salon', label: 'Salon', persona: 'eleve', chaude: true, arrivee: '/ma-classe/salon', budget: 2, cible: 2 },
    { id: 'chapitre', label: 'Chapitre', persona: 'eleve', chaude: true, via: ['/[niveau]/[matiere]'], arrivee: '/[niveau]/[matiere]/[slug]', budget: 3, cible: 2 },
  ],
}

test('evaluate: depths, waypoints and a clean verdict', () => {
  const r = evaluate(fixture(APP), DEF)
  assert.deepEqual(r.violations, [])
  assert.equal(r.taches.find((t) => t.id === 'salon').profondeur, 2)
  assert.equal(r.taches.find((t) => t.id === 'chapitre').profondeur, 3)
  assert.deepEqual(r.notes.resserrables, [])
})

test('evaluate: a lengthened route breaks the budget', () => {
  const r = evaluate(fixture(APP), { ...DEF, taches: [{ ...DEF.taches[0], budget: 1 }] })
  assert.equal(r.taches[0].statut, 'depasse')
  assert.match(r.violations.join('\n'), /2 clics pour un budget de 1.*route chaude/)
})

test('evaluate: removing the only link makes an impasse', () => {
  const files = { ...APP, 'app/(app)/ma-classe/page.tsx': 'export default () => <p>plus de lien</p>' }
  const r = evaluate(fixture(files), DEF)
  assert.match(r.violations.join('\n'), /salon : impasse/)
})

test('evaluate: an unlisted orphan route and a dead link are violations', () => {
  const r = evaluate(fixture({ ...APP, 'app/(app)/x/page.tsx': 'export default () => <a href="/mort">x</a>' }), DEF)
  const text = r.violations.join('\n')
  assert.match(text, /route orpheline : « \/x »/)
  assert.match(text, /lien mort : « \/mort »/)
})

test('evaluate: persona exclusions keep teacher-only links out of the student path', () => {
  const files = {
    ...APP,
    'components/nav.tsx': `export const Nav = () => <nav><a href="/prof/classes">Prof</a><a href="/">Accueil</a></nav>`,
    'app/prof/classes/page.tsx': `export default () => <a href="/ma-classe/salon">raccourci</a>`,
  }
  const r = evaluate(fixture(files), DEF)
  assert.equal(r.taches.find((t) => t.id === 'salon').profondeur, 2) // not 2 via /prof/classes
})

test('validateTasks: catches a target above its budget', () => {
  const errs = validateTasks({ ...DEF, taches: [{ ...DEF.taches[0], cible: 5 }] })
  assert.match(errs.join('\n'), /cible \(5\).*budget \(2\)/)
})

test('compareToBase: a hot budget never goes up, a hot task never disappears', () => {
  const base = DEF
  assert.deepEqual(compareToBase(base, DEF), [])
  const raised = { ...DEF, taches: [{ ...DEF.taches[0], budget: 3 }, DEF.taches[1]] }
  assert.match(compareToBase(base, raised).join('\n'), /budget relevé de 2 à 3/)
  const dropped = { ...DEF, taches: [DEF.taches[1]] }
  assert.match(compareToBase(base, dropped).join('\n'), /salon : tâche chaude retirée/)
  const cooled = { ...DEF, taches: [{ ...DEF.taches[0], chaude: false }, DEF.taches[1]] }
  assert.match(compareToBase(base, cooled).join('\n'), /n'est plus marquée chaude/)
})
