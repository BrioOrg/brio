import { readdirSync, readFileSync } from 'fs'
import { join, relative, resolve } from 'path'
import katex from 'katex'
import { describe, expect, it } from 'vitest'
import { buildCalculModel, type CalculSpec } from '@brio/content'

import { KATEX_LIMITS, katexMacros } from '@/lib/katex'

// KaTeX over every `calcul` block of the catalogue (ADR 0042). check-content has no dependency,
// so it cannot run KaTeX; this test does, on each line as written and on each part as drawn
// (emphasis included), so a line that would show a red error never reaches a student.

const racine = resolve(__dirname, '../../../content/chapitres')

function chapitres(): string[] {
  return readdirSync(racine, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.json') && !f.endsWith('_index.json'))
    .map((f) => join(racine, f))
}

type Bloc = { id: string; type: string } & Record<string, unknown>

function calculs(): [string, Bloc][] {
  return chapitres().flatMap((file) => {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { sections?: { blocks?: Bloc[] }[] }
    return (doc.sections ?? []).flatMap((s) =>
      (s.blocks ?? [])
        .filter((b) => b.type === 'calcul')
        .map((b): [string, Bloc] => [`${relative(racine, file)} ${b.id}`, b])
    )
  })
}

function parse(latex: string): void {
  katex.renderToString(latex, {
    ...KATEX_LIMITS,
    macros: katexMacros(),
    throwOnError: true,
  })
}

describe('calcul blocks of the catalogue', () => {
  const blocs = calculs()

  it('should exist', () => {
    expect(blocs.length).toBeGreaterThan(0)
  })

  it.each(blocs)('%s: every line and every part parses with KaTeX', (_, bloc) => {
    const spec = bloc as unknown as CalculSpec
    for (const line of spec.lines) {
      expect(() => parse(line.latex)).not.toThrow()
      if (line.op) expect(() => parse(line.op!)).not.toThrow()
    }
    for (const row of buildCalculModel(spec).rows) {
      for (const part of [row.lhs, `{}${row.rel}{}`, row.rhs]) {
        expect(() => parse(part)).not.toThrow()
      }
    }
  })
})
