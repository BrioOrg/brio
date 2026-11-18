import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { diffJson, extractClientPaths, extractDocumentedContracts, extractFakeBackendRoutes, extractZodKeys, regexToPath, runCheck } from '../check-contract-drift.mjs'

const spec = {
  paths: {
    '/api/salons': { get: {} },
    '/api/salons/{salonId}/messages': { get: {}, post: {} },
  },
  components: { schemas: { SalonVue: { properties: { id: {}, nom: {} } } } },
}

function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'contract-'))
  const all = { 'docs/api/openapi.json': JSON.stringify(spec), ...files }
  for (const [p, c] of Object.entries(all)) {
    mkdirSync(dirname(join(root, p)), { recursive: true })
    writeFileSync(join(root, p), c)
  }
  return root
}

test('regexToPath: captures become {}, optional groups are dropped', () => {
  assert.equal(regexToPath('^\\/api\\/communaute\\/questions\\/([^/]+)(?:\\/(vote|reponses))?$'), '/api/communaute/questions/{}')
})

test('fake backend routes are extracted, literal and regex', () => {
  const routes = extractFakeBackendRoutes("if (pathname === '/api/salons') x()\nconst m = pathname.match(/^\\/api\\/salons\\/([^/]+)\\/messages$/)\n")
  assert.deepEqual(routes.map((r) => r.path), ['/api/salons', '/api/salons/{}/messages'])
})

test('client paths: template variables, query suffix, comments ignored', () => {
  const found = extractClientPaths('// /api/ignored\nfetch(`${base}/api/salons/${encodeURIComponent(id)}/messages`)\nfetch(`${base}/api/salons${qs}`)')
  assert.deepEqual(found.map((f) => [f.path, !!f.dynamicSuffix]), [['/api/salons/{}/messages', false], ['/api/salons', true]])
})

test('documented contracts: query stripped, {a|b} expanded', () => {
  const d = extractDocumentedContracts(' *   GET /api/salons?x=1\n *   PUT /api/c/{questions|reponses}/{id}/vote\n')
  assert.deepEqual(d.map((x) => `${x.method} ${x.path}`), ['get /api/salons', 'put /api/c/questions/{id}/vote', 'put /api/c/reponses/{id}/vote'])
})

test('zod keys: top-level keys of each object only', () => {
  const k = extractZodKeys("const S = z.object({\n  id: z.string(),\n  nested: z.object({ deep: z.string() }),\n})").map((x) => x.key)
  assert.ok(k.includes('id') && k.includes('nested') && k.includes('deep'))
})

test('a healthy repo passes', () => {
  const root = repo({
    'packages/api-client/src/salons.ts': "export const S = z.object({ id: z.string(), nom: z.string() })\nconst u = `${b}/api/salons/${id}/messages`\n/**\n *   POST /api/salons/{salonId}/messages\n */",
    'web/e2e/fake-backend.mjs': "if (pathname === '/api/salons') {}\n",
  })
  assert.equal(runCheck({ root }).verdict, 'pass')
})

test('drift: unknown client route, unknown method, renamed Zod field, rogue fake route', () => {
  const root = repo({
    'packages/api-client/src/salons.ts': "export const S = z.object({ id: z.string(), titre: z.string() })\nconst u = `${b}/api/salles/${id}`\n/**\n *   DELETE /api/salons\n */",
    'web/e2e/fake-backend.mjs': "if (pathname === '/api/inventee') {}\n",
  })
  const v = runCheck({ root })
  assert.equal(v.verdict, 'veto')
  const msgs = v.findings.map((f) => f.message).join('\n')
  assert.match(msgs, /\/api\/salles/)
  assert.match(msgs, /DELETE \/api\/salons/)
  assert.match(msgs, /`titre`/)
  assert.match(msgs, /faux backend sert `\/api\/inventee`/)
  assert.ok(v.findings.every((f) => f.file))
})

test('allowlist entries need a reason', () => {
  const root = repo({
    'packages/api-client/src/a.ts': "const u = `${b}/api/hors-spec`",
    'mesh/verification/contract-allowlist.json': JSON.stringify({ clientPaths: [{ value: '/api/hors-spec' }] }),
  })
  const v = runCheck({ root })
  assert.ok(v.findings.some((f) => /sans valeur ou sans raison/.test(f.message)))
  assert.ok(v.findings.some((f) => /hors-spec/.test(f.message)))
})

test('real backend output differing from the committed spec is blocking', () => {
  assert.deepEqual(diffJson({ a: { b: 1 } }, { a: { b: 2 } }), ['/a/b'])
  const root = repo({ 'actual.json': JSON.stringify({ ...spec, paths: { ...spec.paths, '/api/nouvelle': { get: {} } } }) })
  const v = runCheck({ root, actualPath: join(root, 'actual.json') })
  assert.equal(v.verdict, 'veto')
  assert.match(v.findings[0].message, /diffère du backend réel/)
})
