import { describe, expect, it } from 'vitest'

import { problemesBloc, type Bloc } from '@/lib/cours-editeur'

function formule(latex: string): Bloc {
  return { id: 'f1', type: 'formula', latex }
}

describe('teintes (ADR 0037)', () => {
  it('should accept a formula coloured with up to three tones', () => {
    expect(problemesBloc(formule('\\tone{1}{a}^2+\\tone{2}{b}^2=\\tone{3}{c}^2'), 's1')).toEqual([])
  })

  it('should block a tone that does not exist, on the formula', () => {
    expect(problemesBloc(formule('\\tone{5}{a}'), 's1')).toEqual([
      expect.objectContaining({
        code: 'TONE_UNKNOWN_TONE',
        gravite: 'bloquant',
        champ: 'latex',
        message: 'La teinte « 5 » n’existe pas : choisis 1, 2, 3 ou 4.',
      }),
    ])
  })

  it('should warn, without blocking, past three tones in a figure', () => {
    const figure: Bloc = {
      id: 'g1',
      type: 'figure',
      alt: 'Quatre segments',
      spec: {
        points: [
          { name: 'A', x: 0, y: 0 },
          { name: 'B', x: 1, y: 0 },
        ],
        segments: [1, 2, 3, 4].map((tone) => ({ from: 'A', to: 'B', tone })),
      },
    }
    expect(problemesBloc(figure, 's1')).toEqual([
      expect.objectContaining({ code: 'TONE_TOO_MANY_TONES', gravite: 'avertissement' }),
    ])
  })
})
