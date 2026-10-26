import { describe, expect, it } from 'vitest'

import {
  apercuBloc,
  BLOCS,
  brouillonVersApercu,
  contenuDepuisBrouillon,
  langageCode,
  nouveauBloc,
  nouveauBrouillon,
  problemesBloc,
  type Bloc,
  type Brouillon,
} from '@/lib/cours-editeur'

function programme(patch: Record<string, unknown> = {}): Bloc {
  return { ...nouveauBloc('code'), id: 'p1', ...patch }
}

function avec(bloc: Bloc): Brouillon {
  const b = nouveauBrouillon()
  b.title = 'Algorithmique'
  b.sections[0].title = 'Programmes de calcul'
  b.sections[0].blocks = [bloc]
  return b
}

const VALIDE = 'quand le drapeau vert est cliqué\nmettre x à 5\ndire ((x * 3) + 4)'

describe('bloc code — création', () => {
  it('should offer the code block in the insert menu', () => {
    expect(BLOCS.some((b) => b.type === 'code' && b.label === 'Programme')).toBe(true)
  })

  it('should start as an empty Scratch programme', () => {
    const b = nouveauBloc('code')
    expect(b).toMatchObject({ type: 'code', language: 'scratch', code: '' })
    expect(langageCode(b)).toBe('scratch')
  })

  it('should read any other language as text', () => {
    expect(langageCode(programme({ language: undefined }))).toBe('texte')
    expect(langageCode(programme({ language: 'python' }))).toBe('texte')
  })
})

describe('bloc code — validation avant publication', () => {
  it('should require a programme', () => {
    expect(problemesBloc(programme({ code: '  ' }), 's1')).toEqual([
      expect.objectContaining({ code: 'EMPTY', champ: 'code', message: 'Remplis le programme.' }),
    ])
  })

  it('should accept a Scratch programme that parses', () => {
    expect(problemesBloc(programme({ code: VALIDE }), 's1')).toEqual([])
  })

  it('should block a Scratch programme that does not parse', () => {
    expect(problemesBloc(programme({ code: 'dire (2 × 3)' }), 's1')).toEqual([
      expect.objectContaining({
        code: 'SCRATCH_INVALID',
        gravite: 'bloquant',
        champ: 'code',
        message:
          'Le programme Scratch contient des erreurs : corrige-les ou passe le bloc en « Texte ».',
      }),
    ])
  })

  it('should not parse a text programme', () => {
    expect(problemesBloc(programme({ language: undefined, code: 'dire (2 × 3)' }), 's1')).toEqual(
      []
    )
  })
})

describe('bloc code — envoi et aperçu', () => {
  it('should send a Scratch programme with its language, and a text one without', () => {
    const scratch = contenuDepuisBrouillon(avec(programme({ code: VALIDE })))
    expect(scratch.sections[0].blocks[0]).toEqual({
      id: 'p1',
      type: 'code',
      language: 'scratch',
      code: VALIDE,
    })
    const texte = JSON.parse(
      JSON.stringify(contenuDepuisBrouillon(avec(programme({ language: undefined, code: 'x' }))))
    )
    expect(texte.sections[0].blocks[0]).toEqual({ id: 'p1', type: 'code', code: 'x' })
  })

  it('should leave an empty programme out of the preview, and keep an invalid one', () => {
    expect(brouillonVersApercu(avec(programme())).chapitre.sections[0].blocks).toEqual([])
    const invalide = programme({ code: 'sauter' })
    expect(brouillonVersApercu(avec(invalide)).chapitre.sections[0].blocks).toEqual([invalide])
  })

  it('should sum a programme up by its first line', () => {
    expect(apercuBloc(programme({ code: VALIDE }))).toBe('quand le drapeau vert est cliqué')
    expect(apercuBloc(programme())).toBe('Programme')
  })
})
