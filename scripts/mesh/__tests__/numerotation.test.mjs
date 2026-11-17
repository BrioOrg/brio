import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { test } from 'node:test'
import {
  againstBase,
  againstOpenPrs,
  compareNumbers,
  duplicates,
  numberOf,
} from '../lib/numerotation.mjs'

// PL-4 retro, lesson 5: ADR 0036 existed on two parallel branches (#365, #357) and the V43/V44
// migrations had to be merged in a given order. These tests keep develop free of duplicates
// and pin the collision rules the CLI (scripts/mesh/check-numerotation.mjs) applies.

const ADR = 'docs/adr'
const MIG = 'backend/src/main/resources/db/migration'
const listed = (dir) =>
  readdirSync(new URL(`../../../${dir}/`, import.meta.url)).map((f) => `${dir}/${f}`)

test('the repository has no ADR number used twice', () => {
  assert.deepEqual(duplicates('adr', listed(ADR)), [])
})

test('the repository has no Flyway version used twice', () => {
  const migrations = listed(MIG)
  assert.ok(
    migrations.some((p) => numberOf('migration', p) !== null),
    'aucune migration trouvée'
  )
  assert.deepEqual(duplicates('migration', migrations), [])
})

test('numbers are read from ADR and migration file names only', () => {
  assert.equal(numberOf('adr', `${ADR}/0036-recuperation-acces-eleve.md`), '0036')
  assert.equal(numberOf('adr', `${ADR}/template.md`), null)
  assert.equal(numberOf('migration', `${MIG}/V43__identite_reinitialisation_acces.sql`), '43')
  assert.equal(numberOf('migration', `${MIG}/V1_1__fix.sql`), '1.1')
  assert.equal(numberOf('migration', `${MIG}/R__vue.sql`), null)
})

test('versions compare numerically, not as text', () => {
  assert.ok(compareNumbers('9', '43') < 0)
  assert.ok(compareNumbers('43.1', '43') > 0)
  assert.equal(compareNumbers('0036', '36'), 0)
})

test('the PL-4 collision: an ADR number already on the base is refused', () => {
  const base = [`${ADR}/0035-communaute-v1.md`, `${ADR}/0036-recuperation-acces-eleve.md`]
  const head = [...base, `${ADR}/0036-console-moderation-communaute.md`]
  const errors = againstBase('adr', base, head)
  assert.equal(errors.length, 1)
  assert.equal(errors[0].path, `${ADR}/0036-console-moderation-communaute.md`)
  assert.match(errors[0].reason, /0036-recuperation-acces-eleve/)
})

test('a migration below the highest version of the base is refused (Flyway out of order)', () => {
  const base = [`${MIG}/V42__a.sql`, `${MIG}/V44__social.sql`]
  const head = [...base, `${MIG}/V43__identite.sql`]
  const [error] = againstBase('migration', base, head)
  assert.equal(error.path, `${MIG}/V43__identite.sql`)
  assert.match(error.reason, /V44/)
  assert.deepEqual(againstBase('migration', base, [...base, `${MIG}/V45__ok.sql`]), [])
})

test('a number also added by another open pull request is reported', () => {
  const added = [`${ADR}/0036-console-moderation-communaute.md`]
  const prs = [
    { number: 357, files: added },
    { number: 365, files: [`${ADR}/0036-recuperation-acces-eleve.md`, 'web/x.ts'] },
  ]
  const errors = againstOpenPrs('adr', added, prs, 357)
  assert.equal(errors.length, 1)
  assert.match(errors[0].reason, /#365/)
})
