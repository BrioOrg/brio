import { beforeEach, describe, expect, it } from 'vitest'

import {
  apercuBloc,
  brouillonDepuisContenu,
  brouillonVersApercu,
  chargerBrouillon,
  compterTrous,
  contenuDepuisBrouillon,
  deplacer,
  distracteursDe,
  exerciceComplet,
  ecrireTampon,
  effacerTampon,
  enregistrerBrouillon,
  lireTampon,
  listerBrouillons,
  nouveauBloc,
  nouveauBrouillon,
  nouvelleSection,
  supprimerBrouillon,
  synchroniserTrous,
  tableauACelluleVide,
  type Bloc,
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
    'table',
    'reference',
    'figure',
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

  it('crée un exercice « sur feuille » par défaut avec ses champs', () => {
    const ex = nouveauBloc('exercise')
    expect(ex.exerciseType).toBe('paper')
    expect(ex).toHaveProperty('prompt')
    expect(ex).toHaveProperty('solution')
    // `statement` est facultatif ; une chaîne vide ne serait pas du richText valide.
    expect(ex).not.toHaveProperty('statement')
  })

  it('crée un texte à trous sans trou, banque ni réponse', () => {
    const ex = nouveauBloc('exercise', 'fill-blank')
    expect(ex).toMatchObject({
      exerciseType: 'fill-blank',
      template: '',
      bank: [],
      expected: [],
      caseSensitive: false,
    })
  })

  it('crée un QCM avec deux propositions vides et un drapeau « plusieurs »', () => {
    const ex = nouveauBloc('exercise', 'multiple-choice')
    expect(ex.exerciseType).toBe('multiple-choice')
    expect(ex.multiple).toBe(false)
    expect(ex.choices).toHaveLength(2)
    expect(ex.choices).toEqual([
      { id: expect.any(String), text: '', correct: false },
      { id: expect.any(String), text: '', correct: false },
    ])
    const [c1, c2] = ex.choices as { id: string }[]
    expect(c1.id).not.toBe(c2.id)
  })

  it('crée une réponse courte avec une réponse acceptée vide', () => {
    const ex = nouveauBloc('exercise', 'short-answer')
    expect(ex.exerciseType).toBe('short-answer')
    expect(ex.acceptedAnswers).toEqual([''])
    expect(ex.caseSensitive).toBe(false)
  })

  it('crée un exercice numérique sans réponse ni unité pré-remplies', () => {
    const ex = nouveauBloc('exercise', 'numeric')
    expect(ex.exerciseType).toBe('numeric')
    expect(ex.tolerance).toBe(0)
    // Une réponse absente (et non 0) distingue « pas encore rempli » ; pas d'unité vide (hors schéma).
    expect(ex).not.toHaveProperty('answer')
    expect(ex).not.toHaveProperty('unit')
  })

  it('crée un encadré « définition » par défaut', () => {
    expect(nouveauBloc('callout').variant).toBe('definition')
  })

  it('crée un tableau 2×1 avec en-têtes et une ligne de corps', () => {
    const t = nouveauBloc('table')
    expect(t.headers).toEqual(['', ''])
    expect(t.rows).toEqual([['', '']])
  })

  it('crée une référence externe par défaut', () => {
    const r = nouveauBloc('reference')
    expect(r.scope).toBe('external')
    expect(r).toHaveProperty('url')
    expect(r).not.toHaveProperty('target')
  })

  it('crée une figure avec un alt vide et une spec valide vide', () => {
    const f = nouveauBloc('figure')
    expect(f.alt).toBe('')
    expect(f.spec).toEqual({ points: [], segments: [] })
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

  it('résume une référence par son titre, une figure par son alt', () => {
    expect(
      apercuBloc({ id: '1', type: 'reference', scope: 'external', title: 'Sésamath', url: '' })
    ).toBe('Sésamath')
    expect(apercuBloc({ id: '2', type: 'figure', alt: 'Triangle en A', spec: {} })).toBe(
      'Triangle en A'
    )
  })

  it('résume un tableau par sa légende ou sa première cellule', () => {
    expect(apercuBloc({ id: '1', type: 'table', caption: 'Conversions', rows: [['km']] })).toBe(
      'Conversions'
    )
    expect(apercuBloc({ id: '2', type: 'table', rows: [['Longueur', 'm']] })).toBe('Longueur')
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

describe('texte à trous', () => {
  const trous = (champs: Partial<Bloc>): Bloc => ({
    ...nouveauBloc('exercise', 'fill-blank'),
    ...champs,
  })

  it('compte les marqueurs {}', () => {
    expect(compterTrous('')).toBe(0)
    expect(compterTrous('Le {} du {}.')).toBe(2)
  })

  it('crée une réponse attendue par trou, en gardant celles déjà saisies', () => {
    const b = trous({ template: 'Le {}.', expected: ['côté'], bank: ['côté'] })
    expect(synchroniserTrous(b, { template: 'Le {} du {}.' }).expected).toEqual(['côté', ''])
    expect(synchroniserTrous(b, { template: 'Le côté.' }).expected).toEqual([])
  })

  it('compose la banque : réponses non vides puis distracteurs', () => {
    const b = trous({ template: '{} et {}', expected: ['a', ''], bank: ['a', 'x'] })
    expect(distracteursDe(b)).toEqual(['x'])
    expect(synchroniserTrous(b, { expected: ['a', 'b'] }).bank).toEqual(['a', 'b', 'x'])
  })

  it('garde un distracteur identique à une réponse (une copie par usage)', () => {
    const b = trous({ template: '{}', expected: ['2'], bank: ['2', '2'] })
    expect(distracteursDe(b)).toEqual(['2'])
  })

  it('remplace la réponse modifiée sans toucher aux distracteurs', () => {
    const b = trous({ template: '{}', expected: ['cot'], bank: ['cot', 'angle'] })
    expect(synchroniserTrous(b, { expected: ['côté'] }).bank).toEqual(['côté', 'angle'])
  })

  it('sert une banque sans étiquette vide, triée pour ne pas révéler l’ordre des trous', () => {
    const b = nouveauBrouillon()
    b.sections[0].blocks = [
      trous({ template: '{} {}', expected: ['zèbre', 'âne'], bank: ['zèbre', 'âne', '', 'lion'] }),
    ]
    expect(contenuDepuisBrouillon(b).sections[0].blocks[0].bank).toEqual(['âne', 'lion', 'zèbre'])
  })
})

describe('champs facultatifs vides (#158)', () => {
  // Le schéma exige `minLength: 1` sur les champs facultatifs présents ; les formulaires les
  // initialisent à ''. Le document enregistré ne doit pas les porter vides.
  function servi(...blocs: Bloc[]): Bloc[] {
    const b = nouveauBrouillon()
    b.sections[0].blocks = blocs
    return contenuDepuisBrouillon(b).sections[0].blocks
  }

  it('retire le titre vide et les lignes vides d’un bloc objectifs neuf', () => {
    const obj = { ...nouveauBloc('objectives'), items: ['Calculer une hypoténuse', ''] }
    const [b] = servi(obj)
    expect(b).not.toHaveProperty('title')
    expect(b.items).toEqual(['Calculer une hypoténuse'])
  })

  it('retire le titre vide d’un encadré et d’un bloc étapes, et une formule d’étape vide', () => {
    const etapes = { ...nouveauBloc('steps'), steps: [{ text: 'Poser', formula: '' }] }
    const [encadre, e] = servi({ ...nouveauBloc('callout'), text: 'x' }, etapes)
    expect(encadre).not.toHaveProperty('title')
    expect(e).not.toHaveProperty('title')
    expect(e.steps).toEqual([{ text: 'Poser' }])
  })

  it('garde un titre renseigné et le titre requis d’une référence', () => {
    const [encadre, ref] = servi(
      { ...nouveauBloc('callout'), title: 'Définition', text: 'x' },
      nouveauBloc('reference')
    )
    expect(encadre.title).toBe('Définition')
    expect(ref).toHaveProperty('title', '')
  })

  it('retire une ligne d’en-têtes entièrement vide, pas une ligne partiellement remplie', () => {
    const [sansEntetes, partiel] = servi(
      { ...nouveauBloc('table'), rows: [['a', 'b']] },
      { ...nouveauBloc('table'), headers: ['x', ''], rows: [['a', 'b']] }
    )
    expect(sansEntetes).not.toHaveProperty('headers')
    expect(partiel.headers).toEqual(['x', ''])
  })

  it('signale une cellule vide, mais pas une ligne d’en-têtes entièrement vide', () => {
    expect(tableauACelluleVide({ ...nouveauBloc('table'), rows: [['a', 'b']] })).toBe(false)
    expect(tableauACelluleVide({ ...nouveauBloc('table'), rows: [['a', '']] })).toBe(true)
    expect(
      tableauACelluleVide({ ...nouveauBloc('table'), headers: ['x', ''], rows: [['a', 'b']] })
    ).toBe(true)
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

describe('aperçu élève', () => {
  const qcm = (patch: Partial<Bloc> = {}): Bloc => ({
    id: 'q1',
    type: 'exercise',
    exerciseType: 'multiple-choice',
    prompt: 'Quel côté est l’hypoténuse ?',
    multiple: false,
    choices: [
      { id: 'a', text: '[RS]', correct: false },
      { id: 'b', text: '[RT]', correct: true },
    ],
    ...patch,
  })

  describe('exerciceComplet', () => {
    it('accepte un QCM avec un intitulé et deux propositions remplies', () => {
      expect(exerciceComplet(qcm())).toBe(true)
    })

    it('refuse un exercice sans intitulé', () => {
      expect(exerciceComplet(qcm({ prompt: '  ' }))).toBe(false)
    })

    it('refuse un QCM dont une proposition est vide ou qui n’en a qu’une', () => {
      expect(
        exerciceComplet(
          qcm({
            choices: [
              { id: 'a', text: '[RS]' },
              { id: 'b', text: '' },
            ],
          })
        )
      ).toBe(false)
      expect(exerciceComplet(qcm({ choices: [{ id: 'a', text: '[RS]' }] }))).toBe(false)
    })

    it('accepte un Vrai / Faux neuf dès qu’il a un intitulé', () => {
      const vf = nouveauBloc('exercise', 'multiple-choice', 'true-false')
      expect(exerciceComplet(vf)).toBe(false)
      expect(exerciceComplet({ ...vf, prompt: 'La Terre est ronde.' })).toBe(true)
    })

    it('accepte une réponse courte ou un numérique avec le seul intitulé', () => {
      const court = { ...nouveauBloc('exercise', 'short-answer'), prompt: 'Capitale ?' }
      const num = { ...nouveauBloc('exercise', 'numeric'), prompt: '2 + 2 ?' }
      expect(exerciceComplet(court)).toBe(true)
      expect(exerciceComplet(num)).toBe(true)
    })

    it('exige au moins un trou et une banque remplie pour un texte à trous', () => {
      const base = { ...nouveauBloc('exercise', 'fill-blank'), prompt: 'Complète.' }
      expect(exerciceComplet({ ...base, template: 'Sans trou', bank: ['x'] })).toBe(false)
      expect(exerciceComplet({ ...base, template: 'Un {}.', bank: [] })).toBe(false)
      expect(exerciceComplet({ ...base, template: 'Un {}.', bank: ['chat', ''] })).toBe(false)
      expect(exerciceComplet({ ...base, template: 'Un {}.', bank: ['chat'] })).toBe(true)
    })

    it('exige une solution pour un exercice sur feuille', () => {
      const base = { ...nouveauBloc('exercise', 'paper'), prompt: 'Démontre.' }
      expect(exerciceComplet(base)).toBe(false)
      expect(exerciceComplet({ ...base, solution: 'Par Pythagore…' })).toBe(true)
    })
  })

  describe('brouillonVersApercu', () => {
    const brouillon = () => ({
      ...nouveauBrouillon(),
      title: 'Pythagore',
      sections: [
        {
          id: 's1',
          title: 'Exercices',
          kind: 'exercises' as const,
          blocks: [
            { id: 'p', type: 'prose' as const, text: 'Intro' },
            qcm(),
            qcm({ id: 'q2', prompt: '' }),
            {
              id: 'n',
              type: 'exercise' as const,
              exerciseType: 'numeric',
              prompt: 'BC ?',
              answer: 10,
              tolerance: 0,
              unit: 'cm',
            },
          ],
        },
      ],
    })

    it('retire les exercices incomplets et les compte', () => {
      const { chapitre, exercicesMasques } = brouillonVersApercu(brouillon())
      expect(chapitre.sections[0].blocks.map((b) => b.id)).toEqual(['p', 'q1', 'n'])
      expect(exercicesMasques).toBe(1)
    })

    it('efface les champs de correction', () => {
      const { chapitre } = brouillonVersApercu(brouillon())
      const [, mc, num] = chapitre.sections[0].blocks
      expect(mc.choices).toEqual([
        { id: 'a', text: '[RS]' },
        { id: 'b', text: '[RT]' },
      ])
      expect(num).not.toHaveProperty('answer')
      expect(num).not.toHaveProperty('tolerance')
      expect(num.unit).toBe('cm')
    })

    it('ne modifie pas le brouillon', () => {
      const b = brouillon()
      brouillonVersApercu(b)
      expect(b.sections[0].blocks).toHaveLength(4)
      expect((b.sections[0].blocks[1].choices as { correct: boolean }[])[1].correct).toBe(true)
    })
  })
})
