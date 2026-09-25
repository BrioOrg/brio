import { beforeEach, describe, expect, it } from 'vitest'

import {
  apercuBloc,
  brouillonDepuisContenu,
  chargerBrouillon,
  contenuDepuisBrouillon,
  deplacer,
  ecrireTampon,
  effacerTampon,
  enregistrerBrouillon,
  lireTampon,
  listerBrouillons,
  nouveauBloc,
  nouveauBrouillon,
  nouvelleSection,
  supprimerBrouillon,
  type BlocType,
} from '@/lib/cours-editeur'

describe('nouveauBrouillon', () => {
  it('démarre avec un titre vide et une première section prête', () => {
    const b = nouveauBrouillon()
    expect(b.title).toBe('')
    expect(b.sections).toHaveLength(1)
    expect(b.sections[0].kind).toBe('lesson')
    expect(b.sections[0].blocks).toEqual([])
    expect(b.schemaVersion).toBe(1)
  })

  it('donne des identifiants distincts à chaque appel', () => {
    expect(nouveauBrouillon().id).not.toBe(nouveauBrouillon().id)
    expect(nouvelleSection().id).not.toBe(nouvelleSection().id)
  })
})

describe('nouveauBloc', () => {
  const types: BlocType[] = [
    'heading',
    'objectives',
    'prose',
    'formula',
    'callout',
    'steps',
    'exercise',
  ]

  it.each(types)('crée un bloc %s avec un id et le bon type', (type) => {
    const bloc = nouveauBloc(type)
    expect(bloc.id).toBeTruthy()
    expect(bloc.type).toBe(type)
  })

  it('crée un bloc « étapes » avec une première étape vide', () => {
    const steps = nouveauBloc('steps')
    expect(steps.steps).toEqual([{ text: '' }])
  })

  it('crée un bloc « objectifs » en texte libre avec un premier objectif vide', () => {
    const obj = nouveauBloc('objectives')
    expect(obj.items).toEqual([''])
  })

  it('crée un exercice « sur feuille » avec ses champs', () => {
    const ex = nouveauBloc('exercise')
    expect(ex.exerciseType).toBe('paper')
    expect(ex).toHaveProperty('prompt')
    expect(ex).toHaveProperty('solution')
  })

  it('crée un encadré « définition » par défaut', () => {
    expect(nouveauBloc('callout').variant).toBe('definition')
  })
})

describe('deplacer', () => {
  it('déplace un élément vers le haut', () => {
    expect(deplacer(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
  })

  it('ne mute pas la liste d’origine', () => {
    const liste = ['a', 'b', 'c']
    deplacer(liste, 0, 2)
    expect(liste).toEqual(['a', 'b', 'c'])
  })

  it('renvoie la liste inchangée si un index sort des bornes', () => {
    const liste = ['a', 'b', 'c']
    expect(deplacer(liste, 0, -1)).toBe(liste)
    expect(deplacer(liste, 2, 3)).toBe(liste)
    expect(deplacer(liste, 1, 1)).toBe(liste)
  })
})

describe('apercuBloc', () => {
  it('résume le contenu réel en retirant le balisage', () => {
    expect(apercuBloc({ id: '1', type: 'prose', text: 'Dans un **triangle** rectangle' })).toBe(
      'Dans un triangle rectangle'
    )
  })

  it('retombe sur le nom du type quand le bloc est vide', () => {
    expect(apercuBloc({ id: '1', type: 'formula', latex: '' })).toBe('Formule')
  })

  it('résume un bloc « étapes » par son titre ou sa première étape', () => {
    expect(apercuBloc({ id: '1', type: 'steps', title: 'Calculer BC', steps: [] })).toBe(
      'Calculer BC'
    )
    expect(
      apercuBloc({
        id: '2',
        type: 'steps',
        title: '',
        steps: [{ text: 'On applique le théorème' }],
      })
    ).toBe('On applique le théorème')
  })

  it('résume un bloc « objectifs » par son premier objectif', () => {
    expect(
      apercuBloc({ id: '1', type: 'objectives', title: '', items: ['Calculer une longueur'] })
    ).toBe('Calculer une longueur')
  })

  it('tronque les contenus longs', () => {
    const long = 'x'.repeat(80)
    const resume = apercuBloc({ id: '1', type: 'prose', text: long })
    expect(resume.endsWith('…')).toBe(true)
    expect(resume.length).toBeLessThanOrEqual(43)
  })
})

describe('collection « Mes cours » (localStorage)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('démarre vide', () => {
    expect(listerBrouillons()).toEqual([])
  })

  it('enregistre puis relit un cours par son id', () => {
    const b = nouveauBrouillon()
    b.title = 'Pythagore'
    enregistrerBrouillon(b)
    const relu = chargerBrouillon(b.id)
    expect(relu?.title).toBe('Pythagore')
    expect(relu?.misAJour).toBeTypeOf('number')
    expect(listerBrouillons()).toHaveLength(1)
  })

  it('met à jour un cours existant sans le dupliquer', () => {
    const b = nouveauBrouillon()
    enregistrerBrouillon(b)
    enregistrerBrouillon({ ...b, title: 'Nouveau titre' })
    const liste = listerBrouillons()
    expect(liste).toHaveLength(1)
    expect(liste[0].title).toBe('Nouveau titre')
  })

  it('supprime un cours', () => {
    const b = nouveauBrouillon()
    enregistrerBrouillon(b)
    supprimerBrouillon(b.id)
    expect(chargerBrouillon(b.id)).toBeNull()
    expect(listerBrouillons()).toEqual([])
  })

  it('migre un ancien brouillon unique vers la collection', () => {
    const ancien = nouveauBrouillon()
    ancien.title = 'Ancien cours'
    window.localStorage.setItem('brio.prof.brouillon', JSON.stringify(ancien))
    const liste = listerBrouillons()
    expect(liste).toHaveLength(1)
    expect(liste[0].title).toBe('Ancien cours')
    expect(window.localStorage.getItem('brio.prof.brouillon')).toBeNull()
  })
})

describe('pont serveur (contenu ↔ brouillon)', () => {
  it('extrait le document de contenu sans les champs de tenue locale', () => {
    const b = nouveauBrouillon()
    b.title = 'Pythagore'
    b.misAJour = 123
    const content = contenuDepuisBrouillon(b)
    expect(content).toEqual({
      schemaVersion: 1,
      id: b.id,
      title: 'Pythagore',
      sections: b.sections,
    })
    expect(content).not.toHaveProperty('misAJour')
  })

  it('n’inclut subject/level que s’ils sont renseignés', () => {
    const b = { ...nouveauBrouillon(), subject: 'mathematiques', level: '3e' }
    expect(contenuDepuisBrouillon(b)).toMatchObject({ subject: 'mathematiques', level: '3e' })
  })

  it('reconstruit un brouillon depuis le contenu serveur, titre serveur faisant foi', () => {
    const content = {
      schemaVersion: 1,
      id: 'ancien-id',
      title: 'Ancien titre',
      sections: [{ id: 's1', title: 'Leçon', kind: 'lesson', blocks: [] }],
    }
    const b = brouillonDepuisContenu('cours-uuid', 'Titre serveur', content)
    expect(b.id).toBe('cours-uuid')
    expect(b.title).toBe('Titre serveur')
    expect(b.sections).toHaveLength(1)
  })

  it('démarre sur une première partie quand le contenu est vide', () => {
    const b = brouillonDepuisContenu('cours-uuid', 'Neuf', null)
    expect(b.sections).toHaveLength(1)
    expect(b.sections[0].kind).toBe('lesson')
  })
})

describe('tampon local par cours', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('écrit, relit (horodaté) puis efface un tampon', () => {
    const b = { ...nouveauBrouillon(), id: 'cours-uuid', title: 'En cours' }
    ecrireTampon(b)
    const relu = lireTampon('cours-uuid')
    expect(relu?.title).toBe('En cours')
    expect(relu?.misAJour).toBeTypeOf('number')
    effacerTampon('cours-uuid')
    expect(lireTampon('cours-uuid')).toBeNull()
  })

  it('renvoie null pour un cours sans tampon', () => {
    expect(lireTampon('inconnu')).toBeNull()
  })
})
