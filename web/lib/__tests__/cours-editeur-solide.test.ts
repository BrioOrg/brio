import { describe, expect, it } from 'vitest'

import {
  brouillonVersApercu,
  contenuDepuisBrouillon,
  nouveauBloc,
  nouveauBrouillon,
  problemesBloc,
  solideDeSorte,
  solidePourApercu,
  type Bloc,
  type Brouillon,
} from '@/lib/cours-editeur'

function solide(patch: Record<string, unknown> = {}): Bloc {
  return { ...nouveauBloc('solid'), id: 's1', alt: 'Un pavé', ...patch }
}

function brouillonAvec(bloc: Bloc): Brouillon {
  const b = nouveauBrouillon()
  b.title = 'Solides'
  b.sections[0] = { ...b.sections[0], title: 'Le cours', blocks: [bloc] }
  return b
}

describe('bloc solide dans l’éditeur', () => {
  it('should start as a valid pavé that only needs its alternative text', () => {
    const bloc = nouveauBloc('solid')
    expect(problemesBloc(bloc, 's').map((p) => p.message)).toEqual([
      'Décris le solide dans le texte alternatif.',
    ])
    expect(problemesBloc(solide(), 's')).toEqual([])
  })

  it('should word the shared rules in French, on their field', () => {
    const p = problemesBloc(solide({ kind: 'cone', radius: 2, height: 4, section: { at: 5 } }), 's')
    expect(p).toHaveLength(1)
    expect(p[0].champ).toBe('section.at')
    expect(p[0].message).toMatch(/entre 0 et 4/)
  })

  it('should switch kinds without keeping the old kind’s fields', () => {
    const cone = { ...solide({ names: ['A'] }), ...solideDeSorte('cone') }
    const served = contenuDepuisBrouillon(brouillonAvec(cone)).sections[0].blocks[0]
    expect(served).toMatchObject({ kind: 'cone', radius: 2, height: 4 })
    expect(served).not.toHaveProperty('width')
    expect(served).not.toHaveProperty('names')
  })

  it('should preview only a solid that follows the rules', () => {
    expect(solidePourApercu(solide())).toMatchObject({ kind: 'pave', width: 4 })
    expect(solidePourApercu(solide({ width: 0 }))).toBeNull()
    const apercu = brouillonVersApercu(brouillonAvec(solide({ width: -1 })))
    expect(apercu.chapitre.sections[0].blocks).toHaveLength(0)
  })
})
