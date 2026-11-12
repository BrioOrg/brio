#!/usr/bin/env node
/**
 * Assemble the nightly simulation report (#358, agent S4 Analyste de friction).
 *
 *   node scripts/mesh/nightly-report.mjs --runs <dir> [--previous rapport.json]
 *        [--out <dir>] [--tasks mesh/routes/tasks.json]
 *
 * Reads every `*.json` run in <dir>, validates it, writes `rapport.json` and `rapport.md`
 * into --out (default: <dir>) and prints the Markdown. Exit 1 on a red verdict, 2 on bad input.
 * Format and scoring: docs/mesh/RAPPORT-DE-NUIT.md.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { buildReport, renderReport, validateRun } from './lib/nightly-report.mjs'

function parseArgs(argv) {
  const o = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!['--runs', '--previous', '--out', '--tasks'].includes(a))
      throw new Error(`option inconnue : ${a}`)
    o[a.slice(2)] = argv[++i]
    if (!o[a.slice(2)]) throw new Error(`${a} attend une valeur`)
  }
  if (!o.runs) throw new Error('--runs <dossier> est obligatoire')
  return o
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  const dir = resolve(o.runs)
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'rapport.json')
    .sort()
  if (!files.length) throw new Error(`aucun run dans ${dir}`)
  const runs = []
  const problems = []
  for (const f of files) {
    const run = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    problems.push(...validateRun(run, f))
    runs.push(run)
  }
  if (problems.length) {
    console.error(problems.map((p) => `- ${p}`).join('\n'))
    throw new Error(`${problems.length} problème(s) dans les runs`)
  }
  const dates = new Set(runs.map((r) => r.date))
  const commits = new Set(runs.map((r) => r.commit))
  if (dates.size > 1 || commits.size > 1)
    throw new Error('les runs mélangent plusieurs dates ou plusieurs commits')

  const previous =
    o.previous && existsSync(o.previous) ? JSON.parse(readFileSync(o.previous, 'utf8')) : null
  const expected = o.tasks ? JSON.parse(readFileSync(o.tasks, 'utf8')).taches.map((t) => t.id) : []
  const report = buildReport(runs, previous, expected)
  const md = renderReport(report)

  const out = resolve(o.out ?? o.runs)
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'rapport.json'), JSON.stringify(report, null, 2) + '\n')
  writeFileSync(join(out, 'rapport.md'), md)
  console.log(md)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n')
  return report.verdict === 'rouge' ? 1 : 0
}

try {
  process.exitCode = main()
} catch (e) {
  console.error(`nightly-report : ${e.message}`)
  process.exitCode = 2
}
