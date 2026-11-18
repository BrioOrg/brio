import { describe, expect, it } from 'vitest'

import {
  arbrePourApercu,
  cheminsArbre,
  contenuDepuisBrouillon,
  nouveauBloc,
  nouveauBrouillon,
  problemesBloc,
  type Bloc,
  type Brouillon,
} from '@/lib/cours-editeur'

function arbre(patch: Record<string, unknown> = {}): Bloc {
  return { ...nouveauBloc('tree'), id: 'a1', alt: 'Deux tirages', ...patch }
}

const urne = {
  root: {
    children: [
      {
        label: 'R',
        probability: '3/5',
        children: [
          { label: 'R', probability: '2/4' },
          { label: 'B', probability: '2/4' },
        ],
      },
      {
        label: 'B',
        probability: '2/5',
        children: [
          { label: 'R', probability: '3/4' },
          { label: 'B', probability: '' },
        ],
      },
    ],
  },
}

function brouillonAvec(bloc: Bloc): Brouillon {
  const b = nouveauBrouillon()
  b.title = 'Probabilités'
  b.sections[0] = { ...b.sections[0], title: 'Le cours', blocks: [bloc] }
  return b
}

describe('bloc arbre — éditeur', () => {
  it('should start with two unnamed branches, issues written, and ask for names and alt', () => {
    const bloc = { ...nouveauBloc('tree'), id: 'a1' }
    const problemes = problemesBloc(bloc, 's1')
    expect(problemes.map((p) => p.code)).toEqual([
      'MISSING_ALT',
      'TREE_BLANK_LABEL',
      'TREE_BLANK_LABEL',
    ])
    expect(problemes[1].message).toBe('Nomme la branche 1.')
  })

  it('should warn, without blocking, when some sibling branches have no probability', () => {
    const problemes = problemesBloc(arbre(urne), 's1')
    expect(problemes).toHaveLength(1)
    expect(problemes[0]).toMatchObject({
      code: 'TREE_PARTIAL_PROBABILITIES',
      gravite: 'avertissement',
      champ: 'root.children[1].children',
    })
    expect(problemes[0].message).toContain('issues de la branche 2')
  })

  it('should block siblings whose probabilities do not sum to 1', () => {
    const faux = structuredClone(urne)
    faux.root.children[1].children[1].probability = '2/4'
    const [p] = problemesBloc(arbre(faux), 's1')
    expect(p).toMatchObject({ code: 'TREE_SUM_NOT_ONE', gravite: 'bloquant' })
    expect(p.message).toBe(
      'Les probabilités des branches issues de la branche 2 font 5/4 au lieu de 1.'
    )
  })

  it('should serve the tree without empty probabilities or default flags', () => {
    const servi = contenuDepuisBrouillon(
      brouillonAvec(arbre({ ...urne, outcomes: false, products: false, highlightPath: [] }))
    ).sections[0].blocks[0]
    expect(servi.outcomes).toBeUndefined()
    expect(servi.products).toBeUndefined()
    expect(servi.highlightPath).toBeUndefined()
    const feuille = (servi.root as typeof urne).root
    expect(feuille).toBeUndefined()
    expect((servi.root as typeof urne.root).children[1].children[1]).toEqual({ label: 'B' })
  })

  it('should preview only named branches, and products only when every branch has a number', () => {
    const spec = arbrePourApercu(arbre({ ...urne, products: true, highlightPath: ['R', 'B'] }))
    expect(spec?.products).toBeUndefined()
    expect(spec?.highlightPath).toEqual(['R', 'B'])
    expect(arbrePourApercu(arbre())).toBeNull()
  })

  it('should list the leaf paths for the highlight selector', () => {
    expect(cheminsArbre(arbre(urne))).toEqual([
      ['R', 'R'],
      ['R', 'B'],
      ['B', 'R'],
      ['B', 'B'],
    ])
  })
})
