#!/usr/bin/env node
/**
 * Prints, as Markdown, how buildDeck splits every catalogue chapter (ADR 0032 §2), to spot the
 * splits that go wrong: slides per chapter, the longest slides, the supports moved onto an
 * exercise slide (rule 6) and the chapters that open without objectives.
 *
 * Scanned: content/chapitres. Imports buildDeck as TypeScript, so it runs with Node's type
 * stripping: `pnpm deck:report`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let buildDeck
try {
  ;({ buildDeck } = await import('../packages/content/src/deck.ts'))
} catch (e) {
  console.error(
    '✗ deck-report loads buildDeck as TypeScript: run `pnpm deck:report`\n' +
      '  (node --experimental-strip-types scripts/deck-report.mjs).\n  ' +
      e.message,
  )
  process.exit(1)
}

const LONGEST = 10

const repoRoot = new URL('..', import.meta.url).pathname
const chapitresDir = join(repoRoot, 'content/chapitres')

const chapters = readdirSync(chapitresDir, { recursive: true, encoding: 'utf8' })
  .filter((name) => name.endsWith('.json') && !name.endsWith('_index.json'))
  .sort()
  .map((name) => {
    const file = join(chapitresDir, name)
    const chapitre = JSON.parse(readFileSync(file, 'utf8'))
    const blocks = new Map(chapitre.sections.flatMap((s) => s.blocks.map((b) => [b.id, b])))
    return { name: name.replace(/\.json$/, ''), chapitre, blocks, deck: buildDeck(chapitre) }
  })

/** `callout/definition + figure`: what a slide holds, by block type. */
function describe(diapo, blocks) {
  return diapo.blockIds
    .map((id) => {
      const block = blocks.get(id)
      return block.variant ? `${block.type}/${block.variant}` : block.type
    })
    .join(' + ')
}

const sizes = chapters.map((c) => c.deck.length).sort((a, b) => a - b)
const total = sizes.reduce((a, b) => a + b, 0)
const blocksPerSlide = new Map()
for (const { deck } of chapters) {
  for (const diapo of deck) {
    blocksPerSlide.set(diapo.blockIds.length, (blocksPerSlide.get(diapo.blockIds.length) ?? 0) + 1)
  }
}

const lines = []
lines.push(`## Découpage en diapos — ${chapters.length} chapitres`, '')
lines.push(
  `**${total} diapos**, de ${sizes[0]} à ${sizes.at(-1)} par chapitre (médiane ${sizes[Math.floor(sizes.length / 2)]}).`,
  '',
)
lines.push(
  'Blocs par diapo : ' +
    [...blocksPerSlide]
      .sort(([a], [b]) => a - b)
      .map(([n, count]) => `${n} → ${count}`)
      .join(', ') +
    ' (0 : les diapos `fin`, et `debut` sans objectifs).',
  '',
)

lines.push(`### Les ${LONGEST} diapos les plus longues`, '')
lines.push('| Chapitre | Diapo | Blocs |', '|---|---|---|')
chapters
  .flatMap((c) => c.deck.map((diapo) => ({ c, diapo })))
  .filter(({ diapo }) => diapo.kind === 'lecon' || diapo.kind === 'exercice')
  .sort((a, b) => b.diapo.blockIds.length - a.diapo.blockIds.length)
  .slice(0, LONGEST)
  .forEach(({ c, diapo }) => lines.push(`| ${c.name} | \`${diapo.id}\` | ${describe(diapo, c.blocks)} |`))
lines.push('')

lines.push('### Supports déplacés sur la diapo d’un exercice (règle 6)', '')
lines.push('| Chapitre | Diapo | Blocs |', '|---|---|---|')
for (const c of chapters) {
  for (const diapo of c.deck) {
    if (diapo.kind === 'exercice' && diapo.blockIds.length > 1) {
      lines.push(`| ${c.name} | \`${diapo.id}\` | ${describe(diapo, c.blocks)} |`)
    }
  }
}
lines.push('')

const withoutObjectives = chapters.filter((c) => c.deck[0].blockIds.length === 0)
lines.push(`### Chapitres sans objectifs en ouverture (${withoutObjectives.length})`, '')
for (const c of withoutObjectives) lines.push(`- ${c.name}`)
lines.push('')

lines.push('### Diapos par chapitre', '')
lines.push('| Chapitre | Diapos | Leçon | Exercice | Blocs max |', '|---|---:|---:|---:|---:|')
for (const c of chapters) {
  const count = (kind) => c.deck.filter((d) => d.kind === kind).length
  const most = Math.max(...c.deck.map((d) => d.blockIds.length))
  lines.push(`| ${c.name} | ${c.deck.length} | ${count('lecon')} | ${count('exercice')} | ${most} |`)
}

console.log(lines.join('\n'))
