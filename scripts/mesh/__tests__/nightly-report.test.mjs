import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildReport, renderReport, runScore, validateRun } from '../lib/nightly-report.mjs'

const run = (over = {}) => ({
  version: 1,
  kind: 'persona',
  run_id: 'r1',
  date: '2026-11-13',
  commit: 'abc1234',
  env: 'staging',
  agent: 'S2',
  persona: '01-eleve-reel',
  tache: 'eleve-devoirs-a-faire',
  budget: 1,
  resultat: 'reussi',
  clics: 1,
  etapes: [{ n: 1, action: 'clic', cible: 'Ma classe', route: '/' }],
  frictions: [],
  ...over,
})

test('validateRun: a clean run passes, production and e-mails are refused', () => {
  assert.deepEqual(validateRun(run()), [])
  assert.match(validateRun(run({ env: 'production' })).join(), /jamais la production/)
  assert.match(
    validateRun(
      run({ etapes: [{ n: 1, action: 'saisie', route: '/', observation: 'lea@example.org' }] })
    ).join(),
    /e-mail/
  )
  assert.match(validateRun(run({ kind: 'sabotage', resultat: 'tenu' })).join(), /attaque/)
  assert.match(
    validateRun(run({ frictions: [{ type: 'bof', route: '/x', detail: '' }] })).join(),
    /type de friction inconnu/
  )
})

test('runScore: failure, clicks over budget and friction add up', () => {
  assert.equal(runScore(run()), 0)
  assert.equal(runScore(run({ clics: 3 })), 4) // two clicks over, 2 each
  assert.equal(runScore(run({ resultat: 'abandon', clics: undefined })), 8)
  assert.equal(runScore(run({ frictions: [{ type: 'ambigu', route: '/', detail: 'x' }] })), 2)
})

test('buildReport: green night, nothing to report', () => {
  const r = buildReport([run(), run({ run_id: 'r2' })])
  assert.equal(r.verdict, 'vert')
  assert.equal(r.score_global, 0)
  assert.equal(r.delta, null)
})

test('buildReport: an impasse is red and becomes a ticket with its repro steps', () => {
  const r = buildReport([
    run({
      resultat: 'abandon',
      clics: undefined,
      frictions: [{ type: 'impasse', route: '/ma-classe', detail: 'rien' }],
    }),
  ])
  assert.equal(r.verdict, 'rouge')
  assert.equal(r.frictions.length, 1)
  assert.match(renderReport(r), /Tickets à ouvrir[\s\S]*impasse · `\/ma-classe`[\s\S]*1\. clic/)
})

test('buildReport: day-over-day — a rise beyond the margin is a regression, new frictions are flagged', () => {
  const yesterday = buildReport([run(), run({ run_id: 'r2' })])
  const today = buildReport(
    [
      run({ clics: 3, frictions: [{ type: 'detour', route: '/', detail: 'tour' }] }),
      run({ run_id: 'r2' }),
    ],
    yesterday
  )
  assert.equal(today.delta, 2.5)
  assert.equal(today.regression, true)
  assert.equal(today.verdict, 'rouge')
  assert.equal(today.frictions[0].nouvelle, true)
  const same = buildReport(
    [
      run({ clics: 3, frictions: [{ type: 'detour', route: '/', detail: 'tour' }] }),
      run({ run_id: 'r2' }),
    ],
    today
  )
  assert.equal(same.regression, false)
  assert.equal(same.frictions[0].nouvelle, false)
  assert.equal(same.verdict, 'orange')
})

test('buildReport: a saboteur that breaks the app is red even without history', () => {
  const r = buildReport([
    run({
      kind: 'sabotage',
      agent: 'S3',
      attaque: 'double-clic',
      resultat: 'casse',
      clics: undefined,
    }),
  ])
  assert.equal(r.verdict, 'rouge')
  assert.equal(r.taches[0].sabotages_casses, 1)
})

test('buildReport: lists tasks nobody played', () => {
  const r = buildReport([run()], null, ['eleve-devoirs-a-faire', 'eleve-profil'])
  assert.deepEqual(r.non_jouees, ['eleve-profil'])
})

test('the committed example validates and renders', () => {
  const dir = new URL('../../../mesh/nuit/exemple/runs/', import.meta.url)
  const runs = readdirSync(dir).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')))
  assert.ok(runs.length >= 4)
  for (const r of runs) {
    assert.deepEqual(validateRun(r), [])
    assert.equal(r.synthetique, true)
  }
  assert.match(renderReport(buildReport(runs)), /^# Rapport de nuit/)
})
