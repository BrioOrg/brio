#!/usr/bin/env node
/**
 * Numbering of ADRs and Flyway migrations (#358, PL-4 retro, lesson 5).
 *
 *   node scripts/mesh/check-numerotation.mjs                         no number used twice
 *   node scripts/mesh/check-numerotation.mjs --base origin/develop   + numbers added here not taken
 *                                                                      on the base, migrations above it
 *   node scripts/mesh/check-numerotation.mjs --base origin/develop --open-prs
 *                                                                    + not taken by another open PR (gh)
 *
 * Exit 1 on any collision. Reserve the number in the issue (plan technique) before writing
 * the file: see .claude/rules/mesh-hygiene.md.
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { KINDS, againstBase, againstOpenPrs, duplicates, numberOf } from './lib/numerotation.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIRS = ['docs/adr', 'backend/src/main/resources/db/migration']
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const lines = (s) => s.split('\n').filter(Boolean)

const args = process.argv.slice(2)
const baseIdx = args.indexOf('--base')
const base = baseIdx >= 0 ? args[baseIdx + 1] : null
if (baseIdx >= 0 && !base) throw new Error('--base attend une référence git')
const withPrs = args.includes('--open-prs')

const head = lines(git('ls-files', '--cached', '--others', '--exclude-standard', '--', ...DIRS))
const basePaths = base ? lines(git('ls-tree', '-r', '--name-only', base, '--', ...DIRS)) : []
let prs = []
let selfPr = null
if (withPrs) {
  prs = JSON.parse(
    execFileSync(
      'gh',
      ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,files'],
      {
        cwd: root,
        encoding: 'utf8',
      }
    )
  ).map((pr) => ({ number: pr.number, files: pr.files.map((f) => f.path) }))
  try {
    selfPr = JSON.parse(
      execFileSync('gh', ['pr', 'view', '--json', 'number'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    ).number
  } catch {
    selfPr = null // no PR for this branch yet
  }
}

const errors = []
for (const kind of KINDS) {
  for (const d of duplicates(kind, head))
    errors.push(`${kind} ${d.number} en double : ${d.paths.join(', ')}`)
  if (base) {
    for (const e of againstBase(kind, basePaths, head)) errors.push(`${e.path} : ${e.reason}`)
    if (withPrs) {
      const added = head.filter((p) => numberOf(kind, p) !== null && !basePaths.includes(p))
      for (const e of againstOpenPrs(kind, added, prs, selfPr))
        errors.push(`${e.path} : ${e.reason}`)
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`)
  console.error('check-numerotation : échec — renuméroter et réserver le numéro dans l’issue')
  process.exit(1)
}
const counts = KINDS.map((k) => `${head.filter((p) => numberOf(k, p) !== null).length} ${k}`).join(
  ', '
)
console.log(
  `check-numerotation : OK (${counts}${base ? `, base ${base}` : ''}${withPrs ? `, ${prs.length} PR ouvertes` : ''})`
)
