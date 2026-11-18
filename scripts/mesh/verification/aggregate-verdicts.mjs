#!/usr/bin/env node
// Consolidates the guardians' verdicts into ONE pull-request comment (mesh Phase 3, #358).
//
//   node scripts/mesh/verification/aggregate-verdicts.mjs \
//     --dir verdicts --config mesh/verification/config.json --out review-comment.md [--enforce]
//
// Reads every verdict-*.json under --dir (recursively; the artifacts of the guardians' jobs),
// writes the Markdown comment to --out (it starts with COMMENT_MARKER so the workflow can
// update the same comment on each push) and prints a one-line JSON summary.
// Exit code 1 only with --enforce, when a guardian whose autonomy >= enforceFromAutonomy
// (default 2) holds a veto. At autonomy 0-1 a veto is reported but never blocks (PLAN §Gouvernance).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deriveVerdict, location, validateVerdict } from './lib/verdict.mjs'

export const COMMENT_MARKER = '<!-- mesh-verification -->'
const MAX_FINDINGS_PER_GUARDIAN = 25
const MAX_COMMENT_CHARS = 60000
const ICON = { blocking: '🛑', important: '⚠️', suggestion: '💡' }
const ORDER = { blocking: 0, important: 1, suggestion: 2 }

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

/** Loads verdicts; an unreadable file becomes an `important` finding for that guardian, never a silent pass. */
export function loadVerdicts(dir) {
  const verdicts = []
  for (const file of walk(dir).filter((f) => /verdict-[^/]*\.json$/.test(f))) {
    const id = /verdict-([A-Z]\d)/.exec(file)?.[1] ?? 'V?'
    try {
      const v = JSON.parse(readFileSync(file, 'utf8'))
      const errors = validateVerdict(v)
      if (errors.length) {
        verdicts.push({
          guardian: v?.guardian ?? id,
          verdict: 'advisory',
          findings: [
            { severity: 'important', message: `Rapport non conforme au contrat (${errors.join(' ; ')}) — renvoyé à l'agent, non interprété.` },
          ],
        })
        continue
      }
      const derived = deriveVerdict(v.findings)
      if (derived !== v.verdict) {
        v.findings.push({
          severity: 'important',
          message: `Verdict déclaré « ${v.verdict} » incohérent avec les constats (« ${derived} ») : le verdict des constats fait foi.`,
        })
        v.verdict = derived
      }
      verdicts.push(v)
    } catch (e) {
      verdicts.push({
        guardian: id,
        verdict: 'advisory',
        findings: [{ severity: 'important', message: `Rapport illisible (${file}) : ${e.message}` }],
      })
    }
  }
  return verdicts
}

function link(f, ctx) {
  const text = '`' + location(f) + '`'
  if (!f.file || !ctx.repo || !ctx.sha) return text
  const anchor = f.line ? `#L${f.line}` : ''
  return `[${text}](https://github.com/${ctx.repo}/blob/${ctx.sha}/${f.file}${anchor})`
}

/** Builds the Markdown comment and the summary. Pure: no I/O. */
export function consolidate(verdicts, config, ctx = {}) {
  const guardians = config?.guardians ?? {}
  const enforceFrom = config?.enforceFromAutonomy ?? 2
  const byId = new Map()
  for (const v of verdicts) {
    const prev = byId.get(v.guardian)
    // Several files for one guardian (e.g. mutation + contract): merge the findings.
    byId.set(v.guardian, prev ? { ...prev, findings: [...prev.findings, ...v.findings] } : v)
  }
  for (const v of byId.values()) v.verdict = deriveVerdict(v.findings)

  const ids = [...new Set([...Object.keys(guardians), ...byId.keys()])].sort()
  const rows = []
  let blocking = 0
  let enforcedVetoes = 0
  const sections = []

  for (const id of ids) {
    const v = byId.get(id)
    const g = guardians[id] ?? {}
    const autonomy = g.autonomy ?? 0
    const name = v?.name ?? g.name ?? ''
    if (!v) {
      rows.push(`| ${id} ${name} | ⏳ non exécuté | — | ${autonomy} |`)
      continue
    }
    const count = (s) => v.findings.filter((f) => f.severity === s).length
    const b = count('blocking')
    blocking += b
    const enforced = v.verdict === 'veto' && autonomy >= enforceFrom
    if (enforced) enforcedVetoes += 1
    const label =
      v.verdict === 'veto'
        ? enforced
          ? '⛔ **veto**'
          : '⛔ veto (consultatif)'
        : v.verdict === 'advisory'
          ? '⚠️ constats'
          : '✅ ok'
    rows.push(`| ${id} ${name} | ${label} | ${b} / ${count('important')} / ${count('suggestion')} | ${autonomy} |`)

    if (v.findings.length === 0) continue
    const sorted = [...v.findings].sort((a, c) => ORDER[a.severity] - ORDER[c.severity])
    const shown = sorted.slice(0, MAX_FINDINGS_PER_GUARDIAN)
    const lines = shown.map((f) => {
      const rule = f.rule ? ` _(${f.rule})_` : ''
      const fix = f.fix ? `\n  - Correction : ${f.fix}` : ''
      return `- ${ICON[f.severity]} **${f.severity}** ${link(f, ctx)} — ${f.message}${rule}${fix}`
    })
    if (sorted.length > shown.length) lines.push(`- … ${sorted.length - shown.length} constat(s) de moindre gravité non affichés (voir l'artefact du job).`)
    sections.push(`<details${b > 0 ? ' open' : ''}>\n<summary><b>${id} ${name}</b> — ${v.summary ?? v.verdict}</summary>\n\n${lines.join('\n')}\n\n</details>`)
  }

  const headline =
    enforcedVetoes > 0
      ? `⛔ **${enforcedVetoes} veto bloquant** — la PR ne peut pas passer la porte 5.`
      : blocking > 0
        ? `⚠️ **${blocking} constat(s) bloquant(s) consultatif(s)** — les gardiens concernés sont encore au niveau d'autonomie < ${enforceFrom} : le merge n'est pas empêché, la correction est attendue.`
        : byId.size < ids.length
          ? `✅ Aucun constat bloquant — mais ${ids.length - byId.size} gardien(s) n'ont pas rendu de rapport : l'absence de verdict n'est pas un feu vert.`
          : '✅ Aucun constat bloquant.'

  let body = [
    COMMENT_MARKER,
    '## Revue consolidée du mesh · porte 5 — Vérification',
    '',
    headline,
    '',
    '| Gardien | Verdict | Bloquant / important / suggestion | Autonomie |',
    '|---|---|---|---|',
    ...rows,
    '',
    ...sections,
    '',
    `<sub>Format : \`docs/mesh/VERIFICATION.md\` · gravité bloquant > important > suggestion · ${ctx.sha ? 'commit ' + ctx.sha.slice(0, 7) : ''}</sub>`,
  ].join('\n')
  if (body.length > MAX_COMMENT_CHARS) body = body.slice(0, MAX_COMMENT_CHARS) + '\n\n_… commentaire tronqué (voir les artefacts)._'
  return { body, summary: { blocking, enforcedVetoes, guardians: ids.length, reported: byId.size } }
}

function main() {
  const args = process.argv.slice(2)
  const opt = (name, dflt) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : dflt
  }
  const dir = opt('--dir', 'verdicts')
  const out = opt('--out', 'review-comment.md')
  const configPath = opt('--config', 'mesh/verification/config.json')
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  const ctx = { repo: process.env.GITHUB_REPOSITORY, sha: process.env.HEAD_SHA ?? process.env.GITHUB_SHA }
  const { body, summary } = consolidate(loadVerdicts(dir), config, ctx)
  writeFileSync(out, body + '\n')
  console.log(JSON.stringify(summary))
  if (args.includes('--enforce') && summary.enforcedVetoes > 0) process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
