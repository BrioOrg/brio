import { describe, expect, it } from 'vitest'

import { MESSAGES_CALCULATRICE } from '@brio/content'

import {
  BLOCS,
  contenuDepuisBrouillon,
  nouveauBloc,
  nouveauBrouillon,
  problemesBloc,
  type Bloc,
} from '@/lib/cours-editeur'

function calculatrice(patch: Record<string, unknown> = {}): Bloc {
  return { ...nouveauBloc('calculatrice'), id: 'c1', ...patch }
}

function servi(bloc: Bloc): Bloc {
  const b = nouveauBrouillon()
  b.title = 'Proportionnalité'
  b.sections[0] = { ...b.sections[0], title: 'Le cours', blocks: [bloc] }
  return contenuDepuisBrouillon(b).sections[0].blocks[0]
}

function problemes(bloc: Bloc) {
  return problemesBloc(bloc, 's1').map((p) => ({ champ: p.champ, message: p.message }))
}

describe('the calculatrice block in the editor', () => {
  it('should be offered in the insert menu', () => {
    expect(BLOCS.find((b) => b.type === 'calculatrice')?.label).toBe('Calculatrice')
  })

  it('should start with one expression to write, without instruction nor window', () => {
    expect(calculatrice()).toMatchObject({ type: 'calculatrice', consigne: '', expressions: [''] })
    expect(problemes(calculatrice())).toEqual([
      {
        champ: 'expressions[0]',
        message: 'Cette expression est vide : écris-la ou supprime-la.',
      },
    ])
  })

  it('should give the engine’s message on the faulty expression, and the U5 texts', () => {
    expect(
      problemes(
        calculatrice({
          consigne: 'a'.repeat(281),
          expressions: ['y = ax', 'y = 2x < 1'],
          fenetre: { x: [5, -5], y: [-5, 5] },
        })
      )
    ).toEqual([
      { champ: 'consigne', message: 'La consigne dépasse 280 caractères.' },
      { champ: 'expressions[0]', message: MESSAGES_CALCULATRICE.lettreInconnue('a') },
      { champ: 'expressions[1]', message: MESSAGES_CALCULATRICE.inequation },
      {
        champ: 'fenetre.x',
        message:
          'La fenêtre est vide ou inversée : le minimum doit être plus petit que le maximum.',
      },
    ])
    expect(
      problemes(calculatrice({ expressions: Array.from({ length: 9 }, (_, i) => `y = ${i}x`) }))
    ).toEqual([{ champ: 'expressions', message: '8 expressions au maximum dans un bloc.' }])
  })

  it('should save the block as written, without an empty instruction', () => {
    const bloc = calculatrice({
      consigne: 'Déplace le curseur $a$.',
      expressions: ['y = ax', 'a = 1'],
      fenetre: { x: [-1, 6], y: [-1, 10] },
    })
    expect(problemes(bloc)).toEqual([])
    expect(servi(bloc)).toEqual({
      id: 'c1',
      type: 'calculatrice',
      consigne: 'Déplace le curseur $a$.',
      expressions: ['y = ax', 'a = 1'],
      fenetre: { x: [-1, 6], y: [-1, 10] },
    })
    expect(
      servi(calculatrice({ consigne: '  ', expressions: ['y = x'], fenetre: undefined }))
    ).toEqual({ id: 'c1', type: 'calculatrice', expressions: ['y = x'] })
  })
})
