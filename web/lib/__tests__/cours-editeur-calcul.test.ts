import { describe, expect, it } from 'vitest'

import {
  contenuDepuisBrouillon,
  nouveauBloc,
  nouveauBrouillon,
  problemesBloc,
  type Bloc,
} from '@/lib/cours-editeur'

function calcul(patch: Record<string, unknown> = {}): Bloc {
  return { ...nouveauBloc('calcul'), id: 'k1', ...patch }
}

function servi(bloc: Bloc): Bloc {
  const b = nouveauBrouillon()
  b.title = 'Équations'
  b.sections[0] = { ...b.sections[0], title: 'Le cours', blocks: [bloc] }
  return contenuDepuisBrouillon(b).sections[0].blocks[0]
}

function messages(bloc: Bloc): string[] {
  return problemesBloc(bloc, 's1').map((p) => p.message)
}

describe('the calcul block in the editor', () => {
  it('should start as an equation of two empty lines, each to be written', () => {
    expect(calcul()).toMatchObject({ type: 'calcul', mode: 'equation', lines: [{}, {}] })
    expect(messages(calcul())).toEqual(['Ligne 1 : écris la ligne.', 'Ligne 2 : écris la ligne.'])
  })

  it('should word the shared rules in French, on the right field', () => {
    const bloc = calcul({
      lines: [{ latex: '3x + 5 = 11' }, { latex: '3x = 6', op: '-5', focus: '7' }],
    })
    expect(problemesBloc(bloc, 's1')).toMatchObject([
      {
        champ: 'lines[1].focus',
        gravite: 'bloquant',
        message: 'Ligne 2 : la partie mise en évidence ne se trouve pas dans la ligne.',
      },
    ])
    expect(messages(calcul({ lines: [{ latex: 'x = 1' }, { latex: '2' }] }))).toEqual([
      'Ligne 2 : une équation a un signe =, <, ≤…',
    ])
  })

  it('should not send empty optional fields, nor an operation outside equation mode', () => {
    const bloc = calcul({
      mode: 'egalites',
      conclusion: ' ',
      lines: [
        { latex: 'A = 1 + 1', note: '' },
        { latex: '2', op: '+1', focus: '', note: 'on calcule' },
      ],
    })
    expect(servi(bloc)).toEqual({
      id: 'k1',
      type: 'calcul',
      mode: 'egalites',
      lines: [{ latex: 'A = 1 + 1' }, { latex: '2', note: 'on calcule' }],
    })
    expect(messages(bloc)).toEqual([])
  })
})
