import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findingsFor, parsePit, parseStryker, score } from '../mutation-to-verdict.mjs'

const pitXml = `<?xml version="1.0" encoding="UTF-8"?>
<mutations>
<mutation detected='true' status='KILLED' numberOfTestsRun='3'><sourceFile>Niveau.java</sourceFile><mutatedClass>fr.brio.progression.domain.Niveau</mutatedClass><mutatedMethod>pour</mutatedMethod><methodDescription>(I)I</methodDescription><lineNumber>12</lineNumber><mutator>org.pitest.mutationtest.engine.gregor.mutators.MathMutator</mutator><indexes><index>4</index></indexes><blocks><block>1</block></blocks><killingTest>x</killingTest><description>Replaced integer division with multiplication</description></mutation>
<mutation detected='false' status='SURVIVED' numberOfTestsRun='3'><sourceFile>Niveau.java</sourceFile><mutatedClass>fr.brio.progression.domain.Niveau</mutatedClass><mutatedMethod>pour</mutatedMethod><methodDescription>(I)I</methodDescription><lineNumber>42</lineNumber><mutator>org.pitest.mutationtest.engine.gregor.mutators.ConditionalsBoundaryMutator</mutator><indexes><index>9</index></indexes><blocks><block>2</block></blocks><killingTest/><description>changed conditional boundary &lt; to &lt;=</description></mutation>
<mutation detected='false' status='NO_COVERAGE' numberOfTestsRun='0'><sourceFile>Serie.java</sourceFile><mutatedClass>fr.brio.progression.domain.Serie$Interne</mutatedClass><mutatedMethod>x</mutatedMethod><methodDescription>()V</methodDescription><lineNumber>7</lineNumber><mutator>org.pitest.mutationtest.engine.gregor.mutators.VoidMethodCallMutator</mutator><indexes><index>1</index></indexes><blocks><block>0</block></blocks><killingTest/><description>removed call</description></mutation>
</mutations>`

test('PIT: file path, line, status and decoded description', () => {
  const m = parsePit(pitXml)
  assert.equal(m.length, 3)
  assert.equal(m[1].file, 'backend/src/main/java/fr/brio/progression/domain/Niveau.java')
  assert.equal(m[1].line, 42)
  assert.equal(m[1].status, 'survived')
  assert.match(m[1].description, /< to <=/)
  assert.equal(m[2].file, 'backend/src/main/java/fr/brio/progression/domain/Serie.java')
  assert.equal(score(m).toFixed(1), '33.3')
})

test('Stryker: mutation-testing-elements report', () => {
  const m = parseStryker({ files: { 'lib/progression.ts': { mutants: [{ mutatorName: 'ConditionalExpression', status: 'Survived', location: { start: { line: 9, column: 3 } }, replacement: 'true' }, { mutatorName: 'EqualityOperator', status: 'Killed', location: { start: { line: 3 } } }] } } })
  assert.equal(m[0].file, 'web/lib/progression.ts')
  assert.equal(m[0].line, 9)
  assert.equal(score(m), 50)
})

test('survivors are findings at file:line; a score under the baseline is the blocking « test affaibli » alert', () => {
  const m = parsePit(pitXml)
  const { findings } = findingsFor('backend', m, { threshold: 50, baseline: 80, tolerance: 2 })
  assert.equal(findings.filter((f) => f.line).length, 2)
  assert.ok(findings.some((f) => f.severity === 'blocking' && /test affaibli/.test(f.message)))
})

test('under the threshold without a baseline is important only', () => {
  const { findings } = findingsFor('backend', parsePit(pitXml), { threshold: 50, baseline: null })
  assert.equal(findings.filter((f) => f.severity === 'blocking').length, 0)
  assert.ok(findings.some((f) => /sous le seuil/.test(f.message)))
})

test('no mutant: no score, no finding', () => {
  const r = findingsFor('web', [], { threshold: 50, baseline: 80 })
  assert.equal(r.score, null)
  assert.equal(r.findings.length, 0)
})
