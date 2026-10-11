import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildDeck, type DeckBlock, type DeckInput, type DeckSection, type Diapo } from '../deck'

function block(id: string, type: string, variant?: string): DeckBlock {
  return variant === undefined ? { id, type } : { id, type, variant }
}

function section(id: string, ...blocks: DeckBlock[]): DeckSection {
  return { id, kind: 'lesson', blocks }
}

/** The slides between `debut` and `fin`, as `blockIds` joined by `+`. */
function middle(input: DeckInput): string[] {
  return buildDeck(input)
    .slice(1, -1)
    .map((diapo) => `${diapo.kind}:${diapo.blockIds.join('+')}`)
}

const prose = (id: string) => block(id, 'prose')
const definition = (id: string) => block(id, 'callout', 'definition')
const tip = (id: string) => block(id, 'callout', 'tip')
const figure = (id: string) => block(id, 'figure')
const table = (id: string) => block(id, 'table')
const exercise = (id: string) => block(id, 'exercise')

describe('buildDeck', () => {
  it('should open with debut and close with fin, even for an empty chapter', () => {
    expect(buildDeck({ sections: [] })).toEqual([
      { id: 'debut', kind: 'debut', blockIds: [] },
      { id: 'fin', kind: 'fin', blockIds: [] },
    ])
  })

  it('should put objectives on debut only when they open the first section', () => {
    const objectives = block('objectifs', 'objectives')
    expect(buildDeck({ sections: [section('s1', objectives, prose('p'))] })[0]).toEqual({
      id: 'debut',
      kind: 'debut',
      blockIds: ['objectifs'],
    })
    expect(middle({ sections: [section('s1', prose('p')), section('s2', objectives)] })).toEqual([
      'lecon:p',
      'lecon:objectifs',
    ])
  })

  it('should give a slide the id of its first block and the id of its section', () => {
    const deck = buildDeck({ sections: [section('s1', definition('d'), figure('f'))] })
    expect(deck[1]).toEqual({ id: 'd', kind: 'lecon', sectionId: 's1', blockIds: ['d', 'f'] })
  })

  it('should open a new slide on each lead, with the supports and asides that follow', () => {
    expect(
      middle({ sections: [section('s1', definition('d'), figure('f'), tip('t'), definition('e'))] })
    ).toEqual(['lecon:d+f+t', 'lecon:e'])
  })

  it('should join a prose to the lead it introduces', () => {
    expect(middle({ sections: [section('s1', prose('p'), definition('d'), figure('f'))] })).toEqual(
      ['lecon:p+d+f']
    )
  })

  it('should leave a prose alone before another prose or an exercise', () => {
    expect(middle({ sections: [section('s1', prose('p1'), prose('p2'), exercise('x'))] })).toEqual([
      'lecon:p1',
      'lecon:p2',
      'exercice:x',
    ])
  })

  it('should not join a lead to a prose that already has a support', () => {
    expect(middle({ sections: [section('s1', prose('p'), figure('f'), definition('d'))] })).toEqual(
      ['lecon:p+f', 'lecon:d']
    )
  })

  it('should open a slide on a support or aside with nothing open', () => {
    expect(
      middle({ sections: [section('s1', figure('f1'), exercise('x'), tip('t'), figure('f2'))] })
    ).toEqual(['lecon:f1', 'exercice:x', 'lecon:t+f2'])
  })

  it('should give each exercise its own slide', () => {
    expect(
      middle({ sections: [section('s1', definition('d'), exercise('x1'), exercise('x2'))] })
    ).toEqual(['lecon:d', 'exercice:x1', 'exercice:x2'])
  })

  it('should keep the only support of a lead on the lesson slide, before an exercise', () => {
    expect(
      middle({ sections: [section('s1', definition('d'), figure('f'), exercise('x'))] })
    ).toEqual(['lecon:d+f', 'exercice:x'])
  })

  it('should move a second support onto the exercise slide it comes right before', () => {
    expect(
      middle({ sections: [section('s1', definition('d'), figure('f'), table('t'), exercise('x'))] })
    ).toEqual(['lecon:d+f', 'exercice:t+x'])
    const deck = buildDeck({
      sections: [section('s1', definition('d'), figure('f'), table('t'), exercise('x'))],
    })
    expect(deck[2]).toEqual({ id: 't', kind: 'exercice', sectionId: 's1', blockIds: ['t', 'x'] })
  })

  it('should count a support across an aside when moving one onto an exercise', () => {
    expect(
      middle({
        sections: [
          section('s1', definition('d'), figure('f1'), tip('t'), figure('f2'), exercise('x')),
        ],
      })
    ).toEqual(['lecon:d+f1+t', 'exercice:f2+x'])
  })

  it('should not move a support onto an exercise when no lead opened the slide', () => {
    expect(
      middle({
        sections: [section('s1', exercise('x1'), table('t'), figure('f'), exercise('x2'))],
      })
    ).toEqual(['exercice:x1', 'lecon:t+f', 'exercice:x2'])
  })

  it('should never cross a section', () => {
    expect(
      middle({ sections: [section('s1', prose('p')), section('s2', definition('d'), figure('f'))] })
    ).toEqual(['lecon:p', 'lecon:d+f'])
    expect(
      middle({ sections: [section('s1', definition('d')), section('s2', figure('f'))] })
    ).toEqual(['lecon:d', 'lecon:f'])
  })

  it('should treat an unknown block type as a lead', () => {
    expect(middle({ sections: [section('s1', block('n', 'nouveau'), figure('f'))] })).toEqual([
      'lecon:n+f',
    ])
  })

  it('should accept a block type with an open index signature, like the web response', () => {
    const webBlock: { id: string; type: string; [key: string]: unknown } = {
      id: 'd',
      type: 'callout',
      variant: 'definition',
    }
    expect(middle({ sections: [{ id: 's1', kind: 'lesson', blocks: [webBlock] }] })).toEqual([
      'lecon:d',
    ])
  })
})

// --- The catalogue (ADR 0032: the rules must hold on every chapter as written) ---

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const chapitresDir = join(repoRoot, 'content/chapitres')

type ChapterFile = { path: string; chapitre: DeckInput & { id: string } }

const catalogue: ChapterFile[] = readdirSync(chapitresDir, { recursive: true, encoding: 'utf8' })
  .filter((name) => name.endsWith('.json') && !name.endsWith('_index.json'))
  .sort()
  .map((name) => {
    const file = join(chapitresDir, name)
    return { path: relative(repoRoot, file), chapitre: JSON.parse(readFileSync(file, 'utf8')) }
  })

describe('buildDeck on the catalogue', () => {
  it('should find the 45 chapters', () => {
    expect(catalogue).toHaveLength(45)
  })

  describe.each(catalogue)('$path', ({ chapitre }) => {
    const deck = buildDeck(chapitre)

    it('should hold every block exactly once, in order', () => {
      const blockIds = chapitre.sections.flatMap((s) => s.blocks.map((b) => b.id))
      expect(deck.flatMap((diapo) => diapo.blockIds)).toEqual(blockIds)
    })

    it('should give unique ids, each the id of its first block', () => {
      expect(new Set(deck.map((diapo) => diapo.id)).size).toBe(deck.length)
      for (const diapo of deck.slice(1, -1)) expect(diapo.id).toBe(diapo.blockIds[0])
    })

    it('should open with debut and close with fin', () => {
      expect(deck[0].kind).toBe('debut')
      expect(deck.at(-1)?.kind).toBe('fin')
      expect(deck.filter((d) => d.kind === 'debut' || d.kind === 'fin')).toHaveLength(2)
    })

    it('should keep each slide within its section, and each exercise on its own slide', () => {
      const sectionOf = new Map(
        chapitre.sections.flatMap((s) => s.blocks.map((b) => [b.id, s.id] as const))
      )
      const typeOf = new Map(
        chapitre.sections.flatMap((s) => s.blocks.map((b) => [b.id, b.type] as const))
      )
      for (const diapo of deck) {
        if (diapo.kind !== 'lecon' && diapo.kind !== 'exercice') continue
        for (const id of diapo.blockIds) expect(sectionOf.get(id)).toBe(diapo.sectionId)
        const exercises = diapo.blockIds.filter((id) => typeOf.get(id) === 'exercise')
        expect(exercises).toHaveLength(diapo.kind === 'exercice' ? 1 : 0)
        if (diapo.kind === 'exercice')
          expect(typeOf.get(diapo.blockIds.at(-1) ?? '')).toBe('exercise')
      }
    })
  })

  it('should split the catalogue as ADR 0032 measured it', () => {
    const decks = catalogue.map(({ chapitre }) => buildDeck(chapitre))
    const sizes = decks.map((deck) => deck.length).sort((a, b) => a - b)
    const blocksPerSlide = new Map<number, number>()
    for (const diapo of decks.flat()) {
      blocksPerSlide.set(
        diapo.blockIds.length,
        (blocksPerSlide.get(diapo.blockIds.length) ?? 0) + 1
      )
    }
    // If the catalogue changes, these figures move: check the new split with `pnpm deck:report`.
    expect({
      slides: sizes.reduce((a, b) => a + b, 0),
      fewest: sizes[0],
      median: sizes[Math.floor(sizes.length / 2)],
      most: sizes.at(-1),
      blocksPerSlide: Object.fromEntries([...blocksPerSlide].sort(([a], [b]) => a - b)),
      movedOntoExercise: decks.flat().filter((d) => d.kind === 'exercice' && d.blockIds.length > 1)
        .length,
    }).toEqual({
      slides: 996,
      fewest: 10,
      median: 22,
      most: 35,
      blocksPerSlide: { 0: 50, 1: 809, 2: 101, 3: 33, 4: 2, 5: 1 },
      movedOntoExercise: 5,
    })
  })

  it.each([
    'content/chapitres/3e/mathematiques/theoreme-de-pythagore.json',
    'content/chapitres/5e/mathematiques/statistiques.json',
    'content/chapitres/6e/mathematiques/angles-bissectrice.json',
  ])('should split %s as recorded', (path) => {
    const file = catalogue.find((c) => c.path === path)
    expect(file).toBeDefined()
    expect(outline(buildDeck(file!.chapitre))).toMatchSnapshot()
  })
})

/** One line per slide, like the example in ADR 0032. */
function outline(deck: Diapo[]): string {
  const width = Math.max(...deck.map((d) => d.id.length))
  return (
    '\n' +
    deck
      .map((d) => `${d.id.padEnd(width)}  ${d.kind.padEnd(8)}  ${d.blockIds.join(' + ')}`.trimEnd())
      .join('\n') +
    '\n'
  )
}
