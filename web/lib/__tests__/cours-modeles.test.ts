import { describe, expect, it } from 'vitest'

import { MODELE_DEFAUT, MODELES, contenuModele, type ModeleId } from '@/lib/cours-modeles'
import type { Bloc, Section } from '@/lib/cours-editeur'

function blocs(section: Section): Bloc[] {
  return section.blocks
}

describe('cours-modeles — le catalogue', () => {
  it('propose quatre modèles aux identifiants uniques', () => {
    const ids = MODELES.map((m) => m.id)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    for (const m of MODELES) {
      expect(m.libelle.trim().length).toBeGreaterThan(0)
      expect(m.description.trim().length).toBeGreaterThan(0)
    }
  })

  it('a un modèle par défaut valide, le premier de la liste', () => {
    expect(MODELES.map((m) => m.id)).toContain(MODELE_DEFAUT)
    expect(MODELES[0].id).toBe(MODELE_DEFAUT)
  })
})

describe('cours-modeles — le squelette généré', () => {
  it('« cours complet » pose objectifs → titre → texte → étapes → exercice QCM', () => {
    const content = contenuModele('cours-complet')
    expect(content).toBeDefined()
    const section = content!.sections[0]
    expect(content!.sections).toHaveLength(1)
    expect(section.kind).toBe('lesson')
    expect(blocs(section).map((b) => b.type)).toEqual([
      'objectives',
      'heading',
      'prose',
      'steps',
      'exercise',
    ])
    const heading = blocs(section)[1]
    expect(heading.text).toBe('Le cours')
    const exercice = blocs(section)[4]
    expect(exercice.exerciseType).toBe('multiple-choice')
  })

  it('« fiche méthode » pose objectifs → étapes → exercice', () => {
    const section = contenuModele('fiche-methode')!.sections[0]
    expect(blocs(section).map((b) => b.type)).toEqual(['objectives', 'steps', 'exercise'])
  })

  it('« série d’exercices » pose une consigne et cinq exercices, en partie « exercices »', () => {
    const section = contenuModele('serie-exercices')!.sections[0]
    expect(section.kind).toBe('exercises')
    expect(blocs(section)[0].type).toBe('prose')
    expect(blocs(section).filter((b) => b.type === 'exercise')).toHaveLength(5)
  })

  it('« page blanche » ne pose aucun contenu (comportement d’origine)', () => {
    expect(contenuModele('page-blanche')).toBeUndefined()
  })

  it('n’invente aucun contenu : énoncés d’exercice et paragraphes vides', () => {
    const modeles: ModeleId[] = ['cours-complet', 'fiche-methode', 'serie-exercices']
    for (const id of modeles) {
      for (const section of contenuModele(id)!.sections) {
        for (const b of section.blocks) {
          if (b.type === 'exercise') expect(b.prompt ?? '').toBe('')
          if (b.type === 'prose') expect(b.text ?? '').toBe('')
        }
      }
    }
  })
})
