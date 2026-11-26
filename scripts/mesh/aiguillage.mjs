#!/usr/bin/env node
/**
 * Aiguilleur des portes 4 à 6 (#449) : quels gardiens et quels contrôles locaux ce diff
 * concerne-t-il ? Voir scripts/mesh/lib/aiguillage.mjs pour les règles.
 *
 *   node scripts/mesh/aiguillage.mjs --base origin/develop   diff de la branche (+ non commité)
 *   node scripts/mesh/aiguillage.mjs --since <sha>            tours 2-3 : seulement la correction
 *                                                            depuis le commit déjà revu
 *   node scripts/mesh/aiguillage.mjs --pr 438                 diff d'une PR (gh), pour rejouer
 *   … --json                                                 sortie machine
 *
 * Sortie Markdown, à coller en tête du commentaire consolidé de la porte 5.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addedLines, aiguiller, removedLines, render } from './lib/aiguillage.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const run = (cmd, ...args) =>
  execFileSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  if (i < 0) return null
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${name} attend une valeur`)
  return args[i + 1]
}
const pr = opt('--pr')
const since = opt('--since')
const base = opt('--base') ?? (pr ? null : 'origin/develop')

let files
let patch
if (pr) {
  const repo = opt('--repo') ?? 'BrioOrg/brio'
  const meta = JSON.parse(run('gh', 'pr', 'view', pr, '--repo', repo, '--json', 'files'))
  files = meta.files.map((f) => ({
    path: f.path,
    status: f.changeType === 'DELETED' ? 'D' : f.changeType === 'ADDED' ? 'A' : 'M',
  }))
  patch = run('gh', 'pr', 'diff', pr, '--repo', repo)
} else {
  const nameStatus = (from) =>
    run('git', 'diff', '--name-status', '--no-renames', from)
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [status, path] = l.split('\t')
        return { path, status }
      })
  const mb = run('git', 'merge-base', base ?? 'origin/develop', 'HEAD').trim()
  files = nameStatus(mb)
  if (since) {
    // Tours 2-3 : la correction seulement. Un `git merge origin/develop` entre deux tours
    // amène des fichiers de develop dans `diff <since>` : on ne garde que ceux que la branche
    // change encore par rapport à develop (relecture #449, rejeu du merge a2229cc).
    const ofBranch = new Set(files.map((f) => f.path))
    files = nameStatus(since).filter((f) => ofBranch.has(f.path))
  }
  const from = since ?? mb
  const untracked = run('git', 'ls-files', '--others', '--exclude-standard')
    .split('\n')
    .filter(Boolean)
  for (const path of untracked) files.push({ path, status: 'A' })
  patch = files.length
    ? run('git', 'diff', '-U0', '--no-renames', from, '--', ...files.map((f) => f.path))
    : ''
  for (const path of untracked) {
    try {
      patch += `\n+++ b/${path}\n` + readFileSync(resolve(root, path), 'utf8').replace(/^/gm, '+')
    } catch {
      // binaire ou illisible : le chemin suffit
    }
  }
}

const tasks = JSON.parse(readFileSync(resolve(root, 'mesh/routes/tasks.json'), 'utf8'))
const result = aiguiller(files, addedLines(patch), tasks, removedLines(patch))
console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : render(result))
