import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addedLines, aiguiller, routeOf } from '../lib/aiguillage.mjs'

const TASKS = {
  taches: [
    {
      id: 'eleve-ouvrir-chapitre',
      chaude: true,
      via: ['/[niveau]/[matiere]'],
      arrivee: '/[niveau]/[matiere]/[slug]',
    },
    { id: 'prof-cours', chaude: false, arrivee: '/prof/cours' },
  ],
}
const run = (paths, added = {}) =>
  aiguiller(
    paths.map((p) => (typeof p === 'string' ? { path: p, status: 'M' } : p)),
    new Map(Object.entries(added)),
    TASKS
  )
const ids = (r) => r.agents.filter((a) => a.retenu).map((a) => a.id)
const ctl = (r, id) => r.controles.find((c) => c.id === id).retenu

test('a web component change wakes the UI guardians, not contracts, pedagogy nor the backend build', () => {
  const r = run(['web/components/cours-card.tsx'])
  assert.deepEqual(ids(r), ['V1', 'V3', 'V6', 'U1', 'U7', 'S2'])
  assert.equal(ctl(r, 'backend'), false)
  assert.equal(ctl(r, 'web'), true)
  assert.match(r.agents.find((a) => a.id === 'V2').raisons[0], /aucun DTO/)
})

test('identite in the backend wakes V5, the saboteur and the backend build', () => {
  const r = run(['backend/src/main/java/fr/brio/identite/domain/Compte.java'])
  for (const id of ['V1', 'V5', 'S3']) assert.ok(ids(r).includes(id), id)
  assert.equal(ctl(r, 'backend'), true)
  assert.equal(ctl(r, 'web'), false)
})

test('an added line about XP wakes V5 outside the sensitive paths', () => {
  const r = run(['web/components/badge.tsx'], {
    'web/components/badge.tsx': ['  <span>{xp} XP</span>'],
  })
  const v5 = r.agents.find((a) => a.id === 'V5')
  assert.equal(v5.retenu, true)
  assert.match(v5.raisons.join(), /XP/)
})

test('signals in test files do not wake V5', () => {
  const r = run(['web/__tests__/badge.test.tsx'], {
    'web/__tests__/badge.test.tsx': ["it('shows 10 XP')"],
  })
  assert.equal(r.agents.find((a) => a.id === 'V5').retenu, false)
})

test('a page of a hot route wakes U6 and names the touched task for S2', () => {
  const r = run(['web/app/(eleve)/[niveau]/[matiere]/page.tsx'])
  assert.ok(ids(r).includes('U6'))
  assert.deepEqual(r.taches, ['eleve-ouvrir-chapitre'])
})

test('the root layout serves every hot route', () => {
  assert.ok(ids(run(['web/app/layout.tsx'])).includes('U6'))
  assert.ok(!ids(run(['web/app/prof/cours/page.tsx'])).includes('U6'))
})

test('docs only: a light V1 read and the mesh safeguards, nothing heavy', () => {
  const r = run(['docs/mesh/JOURNAL.md', 'docs/adr/0051-x.md'])
  assert.deepEqual(ids(r), ['V1'])
  assert.deepEqual(
    r.controles.filter((c) => c.retenu).map((c) => c.id),
    ['garde-fous']
  )
})

test('an unclassified file is read by V1 out of caution', () => {
  const r = run(['deploy/Caddyfile'])
  assert.deepEqual(ids(r), ['V1'])
  assert.deepEqual(r.nonClasses, ['deploy/Caddyfile'])
})

test('chapters wake pedagogy, the content check and e2e (the fake backend serves them)', () => {
  const r = run(['content/chapitres/5e/maths/proportionnalite.md'])
  assert.deepEqual(ids(r), ['V1', 'V4'])
  assert.equal(ctl(r, 'contenu'), true)
  assert.equal(ctl(r, 'e2e'), true)
})

test('the fake backend wakes contracts and the full e2e suite', () => {
  const r = run(['web/e2e/fake-backend.mjs'])
  assert.ok(ids(r).includes('V2'))
  assert.match(r.controles.find((c) => c.id === 'e2e').raison, /suite complète/)
})

test('a deleted test is named to V3', () => {
  const r = run([{ path: 'web/__tests__/x.test.ts', status: 'D' }])
  assert.match(r.agents.find((a) => a.id === 'V3').raisons[0], /test supprimé/)
})

test('routeOf drops route groups and the file name', () => {
  assert.equal(routeOf('web/app/(eleve)/[niveau]/page.tsx'), '/[niveau]')
  assert.equal(routeOf('web/app/layout.tsx'), '/')
  assert.equal(routeOf('web/components/x.tsx'), null)
})

test('addedLines reads a unified diff', () => {
  const m = addedLines(
    'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1,2 @@\n-old\n+new\n+other\n+++ b/y\n+z\n'
  )
  assert.deepEqual(m.get('x'), ['new', 'other'])
  assert.deepEqual(m.get('y'), ['z'])
})

test('a Tailwind class is not analytics (tracking-tight, replay of #439)', () => {
  const r = run(['web/app/(app)/explorer/page.tsx'], {
    'web/app/(app)/explorer/page.tsx': ['<span className="tracking-tight">'],
  })
  assert.equal(r.agents.find((a) => a.id === 'V5').retenu, false)
})

test('a test-only change under web/components wakes V1 and V3, not the UI guardians', () => {
  const r = run(['web/components/__tests__/cours-card.test.tsx'])
  assert.deepEqual(ids(r), ['V1', 'V3'])
})

test('any web/lib change wakes V2, even a removed schema field (review #449)', () => {
  const r = run([{ path: 'web/lib/api.ts', status: 'M' }])
  assert.equal(r.agents.find((a) => a.id === 'V2').retenu, true)
})

test('tasks.json wakes U6 only when a hot task line changes', () => {
  const t = 'mesh/routes/tasks.json'
  assert.ok(!ids(run([t], { [t]: ['"horsNavigation": ["/x"]'] })).includes('U6'))
  assert.ok(ids(run([t], { [t]: ['{ "id": "x", "chaude": true }'] })).includes('U6'))
})

test('the mesh tooling never wakes V5 on its own regexes', () => {
  const f = 'scripts/mesh/lib/aiguillage.mjs'
  const r = run([f], { [f]: ["[/\\bxp\\b/i, 'affiche de l’XP'],"] })
  assert.equal(r.agents.find((a) => a.id === 'V5').retenu, false)
})

test('changing the AI model in application.properties wakes V5 (review #449)', () => {
  const f = 'backend/src/main/resources/application.properties'
  const r = run([f], { [f]: ['brio.ia.model=claude-x'] })
  assert.equal(r.agents.find((a) => a.id === 'V5').retenu, true)
  assert.equal(ctl(r, 'backend'), true)
})

test('the eval harness under src/test/.../ia wakes V5', () => {
  const r = run(['backend/src/test/java/fr/brio/ia/eval/TuteurEvalRunnerTest.java'])
  assert.ok(ids(r).includes('V5'))
})

test('the class chat room wakes V5 and the saboteur (replay of 0743174)', () => {
  const r = run(['web/components/messagerie/salon-de-classe.tsx'])
  for (const id of ['V5', 'S3']) assert.ok(ids(r).includes(id), id)
})

test('the middleware wakes V5, S3, V3 and S2', () => {
  const r = run(['web/middleware.ts'])
  for (const id of ['V5', 'S3', 'V3', 'S2']) assert.ok(ids(r).includes(id), id)
})

test('test support and build config wake V3', () => {
  assert.ok(
    ids(run(['backend/src/test/java/fr/brio/TestcontainersConfiguration.java'])).includes('V3')
  )
  assert.ok(ids(run(['backend/pom.xml'])).includes('V3'))
  assert.ok(ids(run(['web/next.config.ts'])).includes('V3'))
})

test('a lockfile change runs web, packages and the full e2e suite', () => {
  const r = run(['pnpm-lock.yaml'])
  for (const id of ['web', 'packages', 'e2e']) assert.equal(ctl(r, id), true, id)
  assert.ok(ids(r).includes('V1'))
})

test('a progress badge wakes V5 even without a keyword', () => {
  const r = run(['web/components/streak-badge.tsx'], {
    'web/components/streak-badge.tsx': ['<span>{n} j</span>'],
  })
  assert.ok(ids(r).includes('V5'))
})

test('a loading.tsx above a hot route wakes U6', () => {
  assert.ok(ids(run(['web/app/(app)/[niveau]/loading.tsx'])).includes('U6'))
})
