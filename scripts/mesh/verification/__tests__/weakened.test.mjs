import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyze, parseDiff } from '../detect-weakened-tests.mjs'

const diff = (path, hunks, extra = '') =>
  `diff --git a/${path} b/${path}\n${extra}--- a/${path}\n+++ b/${path}\n${hunks}`
const run = (d) => analyze(parseDiff(d))

test('a disabled test is blocking, with its line', () => {
  const f = run(diff('web/lib/__tests__/x.test.ts', "@@ -10,0 +11,1 @@\n+  it.skip('keeps XP honest', () => {})\n"))
  assert.equal(f[0].severity, 'blocking')
  assert.equal(f[0].line, 11)
})

test('@Disabled in Java is blocking', () => {
  const f = run(diff('backend/src/test/java/fr/brio/AFooTest.java', '@@ -5,0 +6,1 @@\n+    @Disabled("flaky")\n'))
  assert.ok(f.some((x) => x.severity === 'blocking' && /désactivé/.test(x.message)))
})

test('a deleted test file is blocking', () => {
  const f = run(diff('web/e2e/x.spec.ts', "@@ -1,2 +0,0 @@\n-test('a', async () => {})\n-test('b', async () => {})\n", 'deleted file mode 100644\n'))
  assert.equal(f[0].severity, 'blocking')
  assert.match(f[0].message, /supprimé/)
})

test('fewer test cases (net) is blocking; refactor keeping the count is not', () => {
  const removed = run(diff('web/lib/__tests__/a.test.ts', "@@ -3,2 +3,0 @@\n-  it('one', () => {})\n-  it('two', () => {})\n"))
  assert.ok(removed.some((x) => x.severity === 'blocking'))
  const kept = run(diff('web/lib/__tests__/a.test.ts', "@@ -3,1 +3,1 @@\n-  it('one', () => {})\n+  it('one, renamed', () => {})\n"))
  assert.equal(kept.filter((x) => x.severity === 'blocking').length, 0)
})

test('an exact assertion replaced by a weak one is flagged', () => {
  const f = run(diff('web/lib/__tests__/a.test.ts', '@@ -8,1 +8,1 @@\n-  expect(xp).toBe(120)\n+  expect(xp).toBeTruthy()\n'))
  assert.ok(f.some((x) => /plus faible/.test(x.message)))
})

test('raised timeout / retries are flagged, lowered mutation threshold is blocking', () => {
  const pw = run(diff('web/playwright.config.ts', '@@ -9,1 +9,1 @@\n-  retries: 1,\n+  retries: 3,\n'))
  assert.ok(pw.some((x) => /relevé/.test(x.message)))
  const cfg = run(diff('mesh/verification/config.json', '@@ -1,1 +1,1 @@\n-    "backend": { "threshold": 60 }\n+    "backend": { "threshold": 40 }\n'))
  assert.ok(cfg.some((x) => x.severity === 'blocking' && /abaissé/.test(x.message)))
})

test('production code and added tests are left alone', () => {
  assert.equal(run(diff('backend/src/main/java/fr/brio/Foo.java', '@@ -1,1 +1,1 @@\n-  @Disabled\n+  int x;\n')).length, 0)
  assert.equal(run(diff('web/lib/__tests__/new.test.ts', "@@ -0,0 +1,2 @@\n+it('new', () => { expect(1).toBe(1) })\n+it('new2', () => { expect(2).toBe(2) })\n")).length, 0)
})
