#!/usr/bin/env node
// Turns mutation reports into a V3 verdict (mesh Phase 3, #358).
//
//   node scripts/mesh/verification/mutation-to-verdict.mjs \
//     --pit backend/target/pit-reports/mutations.xml \
//     --stryker web/reports/mutation/mutation.json \
//     --config mesh/verification/config.json --out verdicts/verdict-V3-mutation.json
//
// Either input is optional. For each stack:
//   - every SURVIVED / NO_COVERAGE mutant is an `important` finding at its file:line
//     (« condition inversée à la ligne 42 non détectée ») ;
//   - score < threshold                          -> `important`  (tests too weak on the touched code)
//   - score < baseline - tolerance               -> `blocking`   ("test affaibli" alert: the suite
//     detects less than it used to — PLAN: un test ne s'affaiblit jamais).
// score = killed / (killed + survived + no coverage); timeouts count as killed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { makeVerdict } from './lib/verdict.mjs'

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** PIT mutations.xml → [{ file, line, status, mutator, description }] ; `file` = backend source path. */
export function parsePit(xml, sourceRoot = 'backend/src/main/java') {
  const mutants = []
  for (const m of xml.matchAll(/<mutation\b[^>]*status='([A-Z_]+)'[^>]*>([\s\S]*?)<\/mutation>/g)) {
    const tag = (n) => decode(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`).exec(m[2])?.[1] ?? '')
    const pkg = tag('mutatedClass').replace(/\$.*$/, '')
    const file = `${sourceRoot}/${pkg.split('.').slice(0, -1).join('/')}/${tag('sourceFile')}`
    mutants.push({
      file,
      line: Number(tag('lineNumber')) || undefined,
      status: m[1] === 'KILLED' || m[1] === 'TIMED_OUT' ? 'killed' : m[1] === 'SURVIVED' ? 'survived' : m[1] === 'NO_COVERAGE' ? 'nocoverage' : 'other',
      mutator: tag('mutator').split('.').pop(),
      description: tag('description'),
    })
  }
  return mutants
}

/** Stryker mutation.json (mutation-testing-elements schema) → same shape. */
export function parseStryker(json, prefix = 'web/') {
  const mutants = []
  for (const [path, f] of Object.entries(json.files ?? {})) {
    for (const m of f.mutants ?? []) {
      const status = m.status === 'Killed' || m.status === 'Timeout' ? 'killed' : m.status === 'Survived' ? 'survived' : m.status === 'NoCoverage' ? 'nocoverage' : 'other'
      mutants.push({ file: path.startsWith('web/') || path.startsWith('packages/') ? path : prefix + path, line: m.location?.start?.line, status, mutator: m.mutatorName, description: m.description ?? m.replacement })
    }
  }
  return mutants
}

export function score(mutants) {
  const killed = mutants.filter((m) => m.status === 'killed').length
  const bad = mutants.filter((m) => m.status === 'survived' || m.status === 'nocoverage').length
  return killed + bad === 0 ? null : (100 * killed) / (killed + bad)
}

export function findingsFor(stack, mutants, cfg = {}, maxListed = 30) {
  const findings = []
  const s = score(mutants)
  const survivors = mutants.filter((m) => m.status === 'survived' || m.status === 'nocoverage')
  for (const m of survivors.slice(0, maxListed))
    findings.push({
      severity: 'important',
      file: m.file,
      line: m.line,
      rule: `mutation · ${stack}`,
      message: `Mutant ${m.status === 'nocoverage' ? 'non couvert' : 'survivant'} (${m.mutator}${m.description ? ' : ' + m.description : ''}) : aucun test ne détecte ce changement.`,
      fix: 'Ajouter ou renforcer une assertion qui échoue si ce comportement change (B5).',
    })
  if (survivors.length > maxListed) findings.push({ severity: 'suggestion', message: `… ${survivors.length - maxListed} autre(s) mutant(s) survivant(s) ${stack} non listés.` })
  if (s !== null) {
    const { threshold = 50, baseline = null, tolerance = 2 } = cfg
    if (baseline !== null && s < baseline - tolerance)
      findings.push({ severity: 'blocking', rule: 'PLAN · test affaibli', message: `Alerte « test affaibli » (${stack}) : score de mutation ${s.toFixed(1)} % < référence ${baseline} % (tolérance ${tolerance} points). La suite détecte moins de défauts qu'avant.` })
    else if (s < threshold) findings.push({ severity: 'important', rule: `mutation · ${stack}`, message: `Score de mutation ${s.toFixed(1)} % sous le seuil de ${threshold} % sur le code touché.` })
  }
  return { findings, score: s }
}

function main() {
  const args = process.argv.slice(2)
  const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
  const cfgPath = opt('--config', 'mesh/verification/config.json')
  const mut = (existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {}).mutation ?? {}
  const all = []
  const parts = []
  const pit = opt('--pit')
  const stryker = opt('--stryker')
  if (pit && existsSync(pit)) {
    const r = findingsFor('backend', parsePit(readFileSync(pit, 'utf8')), mut.backend)
    all.push(...r.findings)
    parts.push(`backend ${r.score === null ? 'aucun mutant' : r.score.toFixed(1) + ' %'}`)
  } else if (pit) parts.push('backend : rapport PIT absent')
  if (stryker && existsSync(stryker)) {
    const r = findingsFor('web', parseStryker(JSON.parse(readFileSync(stryker, 'utf8'))), mut.web)
    all.push(...r.findings)
    parts.push(`web ${r.score === null ? 'aucun mutant' : r.score.toFixed(1) + ' %'}`)
  } else if (stryker) parts.push('web : rapport Stryker absent')
  const verdict = makeVerdict('V3', 'Contrôleur des tests', all, `Mutation — ${parts.join(' · ') || 'aucun rapport'}.`)
  const out = opt('--out')
  if (out) {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(verdict, null, 2) + '\n')
  }
  console.log(`V3 · ${verdict.verdict} · ${verdict.summary}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
