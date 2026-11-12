#!/usr/bin/env node
/**
 * Route map + click budget (#358, agent U1 Cartographe des parcours).
 *
 *   node scripts/mesh/route-budget.mjs                      verdict (exit 1 on violation)
 *   node scripts/mesh/route-budget.mjs --base origin/develop  also: no hot budget raised vs base
 *   node scripts/mesh/route-budget.mjs --write-doc          regenerate docs/mesh/CARTE-ROUTES.md
 *   node scripts/mesh/route-budget.mjs --explain <taskId>   show the path behind a depth
 *   node scripts/mesh/route-budget.mjs --json out.json      machine-readable result
 *
 * Method and limits: docs/mesh/ROUTES-BUDGET.md.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareToBase, evaluate, renderMap, renderSummary } from './lib/click-budget.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function parseArgs(argv) {
  const opts = { web: 'web', tasks: 'mesh/routes/tasks.json', doc: 'docs/mesh/CARTE-ROUTES.md' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--write-doc') opts.writeDoc = true
    else if (['--base', '--json', '--explain', '--web', '--tasks', '--doc'].includes(a)) {
      const v = argv[++i]
      if (!v) throw new Error(`${a} attend une valeur`)
      opts[a.slice(2)] = v
    } else throw new Error(`option inconnue : ${a}`)
  }
  return opts
}

function readBaseTasks(ref, tasksPath) {
  try {
    const raw = execFileSync('git', ['show', `${ref}:${tasksPath}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return JSON.parse(raw)
  } catch {
    return null // the file does not exist on the base yet: first introduction
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const def = JSON.parse(readFileSync(resolve(root, opts.tasks), 'utf8'))
  const result = evaluate(resolve(root, opts.web), def)

  if (opts.base) {
    const baseDef = readBaseTasks(opts.base, opts.tasks)
    if (baseDef) result.violations.push(...compareToBase(baseDef, def))
    else console.log(`(pas de ${opts.tasks} sur ${opts.base} : comparaison de base ignorée)`)
  }

  if (opts.explain) {
    const t = result.taches.find((x) => x.id === opts.explain)
    if (!t) throw new Error(`tâche inconnue : ${opts.explain}`)
    console.log(`${t.label} — ${t.profondeur ?? '∅'} clic(s), budget ${t.budget}`)
    for (const h of t.chemin) console.log(`  ${h.from} → ${h.to}   (lien dans ${h.via})`)
    return 0
  }

  if (opts.writeDoc) {
    const file = resolve(root, opts.doc)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, renderMap(result, def) + '\n')
    console.log(`écrit : ${opts.doc}`)
  }
  if (opts.json) writeFileSync(resolve(root, opts.json), JSON.stringify(result, null, 2) + '\n')

  const summary = renderSummary(result, def)
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
  return result.violations.length ? 1 : 0
}

try {
  process.exitCode = main()
} catch (e) {
  console.error(`route-budget : ${e.message}`)
  process.exitCode = 2
}
