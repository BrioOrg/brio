import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { COMMENT_MARKER, consolidate, loadVerdicts } from '../aggregate-verdicts.mjs'

const cfg = { guardians: { V1: { name: 'Relecteur', autonomy: 0 }, V2: { name: 'Contrats', autonomy: 2 }, V3: { name: 'Tests', autonomy: 0 } }, enforceFromAutonomy: 2 }
const v = (guardian, findings) => ({ guardian, verdict: findings.some((f) => f.severity === 'blocking') ? 'veto' : findings.length ? 'advisory' : 'pass', findings })

test('one comment, marker first, findings as file:line', () => {
  const { body } = consolidate([v('V1', [{ severity: 'important', file: 'a/B.java', line: 12, message: 'm' }])], cfg)
  assert.ok(body.startsWith(COMMENT_MARKER))
  assert.match(body, /`a\/B\.java:12`/)
})

test('a veto below the enforcement autonomy is advisory, not enforced', () => {
  const { summary, body } = consolidate([v('V1', [{ severity: 'blocking', message: 'x' }])], cfg)
  assert.equal(summary.enforcedVetoes, 0)
  assert.equal(summary.blocking, 1)
  assert.match(body, /veto \(consultatif\)/)
})

test('a veto at autonomy >= 2 is enforced', () => {
  const { summary } = consolidate([v('V2', [{ severity: 'blocking', message: 'x' }])], cfg)
  assert.equal(summary.enforcedVetoes, 1)
})

test('a guardian that did not report is shown as not run, never as a pass', () => {
  const { body } = consolidate([v('V1', [])], cfg)
  assert.match(body, /V2 Contrats \| ⏳ non exécuté/)
})

test('blocking findings are listed before suggestions', () => {
  const { body } = consolidate([v('V1', [{ severity: 'suggestion', message: 'ZZZ-sugg' }, { severity: 'blocking', message: 'AAA-bloc' }])], cfg)
  assert.ok(body.indexOf('AAA-bloc') < body.indexOf('ZZZ-sugg'))
})

test('unreadable and inconsistent verdicts are surfaced', () => {
  const dir = mkdtempSync(join(tmpdir(), 'verd-'))
  writeFileSync(join(dir, 'verdict-V1.json'), '{not json')
  writeFileSync(join(dir, 'verdict-V3.json'), JSON.stringify({ guardian: 'V3', verdict: 'pass', findings: [{ severity: 'blocking', message: 'x' }] }))
  const loaded = loadVerdicts(dir)
  const v1 = loaded.find((x) => x.guardian === 'V1')
  assert.match(v1.findings[0].message, /illisible/)
  const v3 = loaded.find((x) => x.guardian === 'V3')
  assert.equal(v3.verdict, 'veto')
  assert.ok(v3.findings.some((f) => /incohérent/.test(f.message)))
})

test('two files for one guardian are merged', () => {
  const { summary } = consolidate([v('V3', [{ severity: 'blocking', message: 'a' }]), v('V3', [{ severity: 'important', message: 'b' }])], cfg)
  assert.equal(summary.reported, 1)
  assert.equal(summary.blocking, 1)
})
