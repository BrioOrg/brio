#!/usr/bin/env node
// "Test affaibli" detector (mesh Phase 3, #358) — deterministic half of V3 Contrôleur des tests.
// PLAN: « Un test existant ne s'affaiblit jamais sans l'accord du contrôleur des tests. »
//
//   node scripts/mesh/verification/detect-weakened-tests.mjs --base origin/develop [--out verdicts/verdict-V3-weak.json]
//
// Reads `git diff <base>...HEAD` restricted to test files and config that governs them, and flags:
//   blocking  : a test disabled (@Disabled, .skip, xit, test.fixme, it.todo…) ; a test file deleted ;
//               fewer test cases in a file (net) ; a mutation threshold / baseline lowered
//   important : fewer assertions (net) in a file ; a strong matcher replaced by a weak one ;
//               a tolerance / timeout / retries / delta raised
// Heuristic by design: it raises an ALERT for V3 to judge against the acceptance criteria
// (a legitimate test change tied to a changed criterion is accepted by V3, not by this script).
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { makeVerdict } from './lib/verdict.mjs'

const TEST_FILE = /(^|\/)(src\/test\/|__tests__\/|e2e\/)|(Test|Tests|IT)\.java$|\.(test|spec)\.(ts|tsx|mjs|js)$/
const TEST_CONFIG = /(^|\/)(vitest\.config|playwright\.config|stryker[^/]*\.config)\.[a-z]+$|^mesh\/verification\/config\.json$|^backend\/pom\.xml$/

const DISABLE = /@Disabled\b|@Ignore\b|\.skip\s*\(|\b(xit|xdescribe|xtest)\s*\(|\b(test|it)\.(fixme|todo)\b|\bassumeTrue\(\s*false/
const TEST_CASE = /@Test\b|@ParameterizedTest\b|@RepeatedTest\b|(^|[^\w.])(it|test)(\.each)?\s*\(|\b(it|test)\.(only|concurrent)\s*\(/
const ASSERTION = /\bexpect\s*\(|\bassert\w*\s*\(|\bassertThat\s*\(|\bstatus\(\)\.\w+|\bverify\s*\(|\.should\w*\(|\bexpect\.\w+\(|\bawait expect\b|jsonPath\s*\(/
const STRONG = /\.(toBe|toEqual|toStrictEqual|toHaveTextContent|toHaveText|toHaveURL|toHaveAttribute|toHaveValue|toHaveLength|toHaveBeenCalledWith|toMatchObject)\s*\(|\.(isEqualTo|hasSize|containsExactly|isEmpty|isFalse|isTrue)\s*\(|\bassertEquals\s*\(|status\(\)\.is(?!Ok\(\))\w+/
const WEAK = /\.(toBeTruthy|toBeFalsy|toBeDefined|toBeDefined|toBeGreaterThan|toBeGreaterThanOrEqual|toContain|toBeInstanceOf)\s*\(|\.(isNotNull|isNotEmpty|isNotBlank|isPresent|isInstanceOf)\s*\(|\bassertNotNull\s*\(|\bassertTrue\s*\(\s*true|expect\.any\(|expect\.anything\(/
// key = number, on the removed and the added side of a hunk: a larger number is a looser test
const TUNABLE = /\b(retries|timeout|waitForTimeout|tolerance|delta|within|offset|threshold|mutationThreshold|baseline|toBeCloseTo)\b[^0-9\n-]{0,12}(-?\d+(?:\.\d+)?)/

/** Parses a unified diff (--unified=0) into per-file hunks with line numbers. */
export function parseDiff(diff) {
  const files = []
  let cur = null
  let hunk = null
  let newLine = 0
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      cur = { path: raw.split(' b/').pop(), deleted: false, hunks: [] }
      files.push(cur)
      hunk = null
    } else if (cur && raw.startsWith('deleted file mode')) cur.deleted = true
    else if (cur && raw.startsWith('@@')) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(raw)
      newLine = Number(m[1])
      hunk = { start: newLine, removed: [], added: [] }
      cur.hunks.push(hunk)
    } else if (hunk && raw.startsWith('+') && !raw.startsWith('+++')) hunk.added.push({ text: raw.slice(1), line: newLine++ })
    else if (hunk && raw.startsWith('-') && !raw.startsWith('---')) hunk.removed.push({ text: raw.slice(1), line: newLine })
  }
  return files
}

const count = (lines, re) => lines.filter((l) => re.test(l.text)).length

/** Pure analysis of a parsed diff → findings. */
export function analyze(files) {
  const findings = []
  for (const f of files) {
    const isTest = TEST_FILE.test(f.path)
    const isConfig = TEST_CONFIG.test(f.path)
    if (!isTest && !isConfig) continue
    const removed = f.hunks.flatMap((h) => h.removed)
    const added = f.hunks.flatMap((h) => h.added)

    if (isTest && f.deleted) {
      findings.push({ severity: 'blocking', file: f.path, rule: 'PLAN · test affaibli', message: `Fichier de test supprimé (${count(removed, TEST_CASE)} cas). À moins que le critère testé ait disparu, la preuve est perdue.` })
      continue
    }

    if (isTest) {
      for (const a of added)
        if (DISABLE.test(a.text) && !/^\s*(\/\/|\*)/.test(a.text))
          findings.push({ severity: 'blocking', file: f.path, line: a.line, rule: 'PLAN · test affaibli', message: `Test désactivé : \`${a.text.trim().slice(0, 80)}\`.`, fix: 'Corriger le test ou le code ; ne jamais désactiver pour faire passer la CI.' })

      const casesNet = count(removed, TEST_CASE) - count(added, TEST_CASE)
      if (casesNet > 0)
        findings.push({ severity: 'blocking', file: f.path, line: removed.find((l) => TEST_CASE.test(l.text))?.line, rule: 'PLAN · test affaibli', message: `${casesNet} cas de test en moins dans ce fichier (net).`, fix: "Justifier par un critère retiré (fiche besoin) ou restaurer ; V3 tranche." })

      const asrNet = count(removed, ASSERTION) - count(added, ASSERTION)
      if (asrNet > 0)
        findings.push({ severity: 'important', file: f.path, line: removed.find((l) => ASSERTION.test(l.text))?.line, rule: 'PLAN · test affaibli', message: `${asrNet} assertion(s) en moins dans ce fichier (net).` })

      for (const h of f.hunks) {
        if (count(h.removed, STRONG) > 0 && count(h.added, WEAK) > 0 && count(h.added, STRONG) < count(h.removed, STRONG))
          findings.push({ severity: 'important', file: f.path, line: h.added.find((l) => WEAK.test(l.text))?.line ?? h.start, rule: 'PLAN · test affaibli', message: 'Assertion précise remplacée par une assertion plus faible (valeur exacte → existence/truthy).' })
      }
    }

    for (const h of f.hunks) {
      for (const r of h.removed) {
        const rm = TUNABLE.exec(r.text)
        if (!rm) continue
        const am = h.added.map((a) => ({ a, m: TUNABLE.exec(a.text) })).find((x) => x.m && x.m[1] === rm[1])
        if (!am) continue
        const [oldV, newV] = [Number(rm[2]), Number(am.m[2])]
        // For thresholds/baselines a LOWER number is the weaker one; for the others, a HIGHER one.
        const lowerIsWeaker = ['threshold', 'mutationThreshold', 'baseline'].includes(rm[1])
        if (lowerIsWeaker ? newV < oldV : newV > oldV)
          findings.push({
            severity: lowerIsWeaker ? 'blocking' : 'important',
            file: f.path,
            line: am.a.line,
            rule: 'PLAN · test affaibli',
            message: `\`${rm[1]}\` ${lowerIsWeaker ? 'abaissé' : 'relevé'} de ${oldV} à ${newV}${lowerIsWeaker ? ' : un seuil ne se baisse que sur décision humaine' : ' : le test devient plus tolérant'}.`,
          })
      }
    }
  }
  return findings
}

export function gitDiff(base) {
  return execFileSync('git', ['diff', '--unified=0', '--no-color', '--no-renames', `${base}...HEAD`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function main() {
  const args = process.argv.slice(2)
  const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
  const findings = analyze(parseDiff(gitDiff(opt('--base', 'origin/develop'))))
  const verdict = makeVerdict('V3', 'Contrôleur des tests', findings, findings.length ? `Alerte « test affaibli » : ${findings.length} signal(aux).` : 'Aucun test affaibli détecté.')
  const out = opt('--out')
  if (out) {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(verdict, null, 2) + '\n')
  }
  console.log(`V3 · ${verdict.verdict} · ${verdict.summary}`)
  for (const f of findings) console.log(`  ${f.severity.padEnd(10)} ${f.file}${f.line ? ':' + f.line : ''}  ${f.message}`)
  if (opt('--fail-on') === 'blocking' && verdict.verdict === 'veto') process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
