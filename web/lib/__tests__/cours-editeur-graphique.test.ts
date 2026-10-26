import { describe, expect, it } from 'vitest'

import {
  apercuBloc,
  brouillonVersApercu,
  contenuDepuisBrouillon,
  graphiquePourApercu,
  nouveauBloc,
  nouveauBrouillon,
  problemesBloc,
  type Bloc,
  type Brouillon,
} from '@/lib/cours-editeur'

function graphique(patch: Record<string, unknown> = {}): Bloc {
  return { ...nouveauBloc('chart'), id: 'c1', ...patch }
}

function serie(data: Array<{ label: string; value?: number }>, label = 'Effectif') {
  return { series: [{ label, data }] }
}

const sports = serie([
  { label: 'Football', value: 8 },
  { label: 'Basket', value: 5 },
])

function messages(bloc: Bloc): string[] {
  return problemesBloc(bloc, 's1').map((p) => p.message)
}

function brouillonAvec(bloc: Bloc): Brouillon {
  const b = nouveauBrouillon()
  b.title = 'Statistiques'
  b.sections[0] = { ...b.sections[0], title: 'Le cours', blocks: [bloc] }
  return b
}

function servi(bloc: Bloc): Bloc {
  return contenuDepuisBrouillon(brouillonAvec(bloc)).sections[0].blocks[0]
}

describe('bloc diagramme — création', () => {
  it('should start as a bar chart with two empty categories and one series', () => {
    const b = nouveauBloc('chart')
    expect(b).toMatchObject({
      type: 'chart',
      kind: 'bar',
      alt: '',
      series: [{ label: 'Effectif', data: [{ label: '' }, { label: '' }] }],
    })
  })

  it('should summarise a chart by its title, then its alt text', () => {
    expect(apercuBloc(graphique({ title: 'Sport préféré' }))).toBe('Sport préféré')
    expect(apercuBloc(graphique({ alt: 'Football 8, Basket 5' }))).toBe('Football 8, Basket 5')
    expect(apercuBloc(graphique())).toBe('Diagramme')
  })
})

describe('bloc diagramme — validation avant publication', () => {
  it('should ask for the alt text, the category names and their values', () => {
    expect(messages(graphique())).toEqual([
      'Décris le diagramme dans le texte alternatif.',
      'Nomme la catégorie 1.',
      'Donne une valeur à la catégorie 1.',
      'Nomme la catégorie 2.',
      'Donne une valeur à la catégorie 2.',
    ])
  })

  it('should point each problem at its field', () => {
    const champs = problemesBloc(graphique(), 's1').map((p) => p.champ)
    expect(champs).toEqual([
      'alt',
      'series[0].data[0].label',
      'series[0].data[0].value',
      'series[0].data[1].label',
      'series[0].data[1].value',
    ])
  })

  it('should accept a complete chart of each kind', () => {
    for (const kind of ['bar', 'pie', 'line']) {
      expect(messages(graphique({ kind, alt: 'Football 8, Basket 5', ...sports }))).toEqual([])
    }
  })

  it('should apply the check-content rules in French', () => {
    const alt = 'Diagramme'
    expect(
      messages(
        graphique({
          alt,
          ...serie([
            { label: 'Football', value: 8 },
            { label: 'Football ', value: -1 },
          ]),
        })
      )
    ).toEqual([
      'La catégorie « Football » apparaît deux fois : donne-leur des noms différents.',
      'Une barre ne peut pas être négative (catégorie 2) : choisis une courbe pour des valeurs sous 0.',
    ])
    expect(
      messages(
        graphique({
          kind: 'pie',
          alt,
          ...serie([
            { label: 'A', value: 0 },
            { label: 'B', value: 2 },
          ]),
        })
      )
    ).toEqual([
      'Dans un diagramme circulaire, chaque valeur doit être plus grande que 0 (catégorie 1).',
    ])
    const sept = Array.from({ length: 7 }, (_, i) => ({ label: `C${i + 1}`, value: 1 }))
    expect(messages(graphique({ kind: 'pie', alt, ...serie(sept) }))).toEqual([
      'Un diagramme circulaire a au plus 6 catégories : retire-en 1.',
    ])
    expect(messages(graphique({ alt, ...serie(sept) }))).toEqual([])
  })

  it('should check the graduations a teacher sets', () => {
    expect(messages(graphique({ alt: 'D', ...sports, yMax: 6.5 }))).toEqual([
      'Le haut de l’axe (6,5) est sous la plus grande valeur (8).',
    ])
    expect(messages(graphique({ alt: 'D', ...sports, yStep: 0.1 }))).toEqual([
      'Ce pas donne 80 graduations, au plus 20 : choisis un pas plus grand.',
    ])
  })

  it('should require a name for the values', () => {
    expect(messages(graphique({ alt: 'D', ...serie(sports.series[0].data, ' ') }))).toEqual([
      'Indique ce que mesurent les valeurs (ex. Effectif).',
    ])
  })
})

describe('bloc diagramme — document enregistré', () => {
  it('should drop empty optional texts and the default showValues', () => {
    expect(servi(graphique({ alt: 'Football 8, Basket 5', ...sports, showValues: false }))).toEqual(
      {
        id: 'c1',
        type: 'chart',
        kind: 'bar',
        alt: 'Football 8, Basket 5',
        ...sports,
      }
    )
  })

  it('should keep the axis texts, graduations and showValues of a bar chart', () => {
    expect(
      servi(
        graphique({
          alt: 'D',
          ...sports,
          title: 'Sport préféré',
          xLabel: 'Sport',
          yLabel: 'Effectif',
          yMax: 10,
          yStep: 2,
          showValues: true,
        })
      )
    ).toMatchObject({ xLabel: 'Sport', yLabel: 'Effectif', yMax: 10, yStep: 2, showValues: true })
  })

  it('should send a pie without its axis fields, which the schema forbids', () => {
    const b = servi(
      graphique({
        kind: 'pie',
        alt: 'D',
        ...sports,
        xLabel: 'Sport',
        yLabel: 'Effectif',
        yMax: 10,
        yStep: 2,
        showValues: true,
      })
    )
    expect(b).toEqual({ id: 'c1', type: 'chart', kind: 'pie', alt: 'D', ...sports })
  })
})

describe('bloc diagramme — aperçu', () => {
  it('should draw only the named, numbered and distinct categories', () => {
    const spec = graphiquePourApercu(
      graphique(
        serie([
          { label: 'Football', value: 8 },
          { label: '', value: 3 },
          { label: 'Basket' },
          { label: 'Football', value: 1 },
          { label: 'Danse', value: 2 },
        ])
      )
    )
    expect(spec?.series[0].data).toEqual([
      { label: 'Football', value: 8 },
      { label: 'Danse', value: 2 },
    ])
  })

  it('should have nothing to draw below two categories', () => {
    expect(graphiquePourApercu(graphique())).toBeNull()
  })

  it('should ignore invalid graduations rather than draw them', () => {
    expect(graphiquePourApercu(graphique({ ...sports, yMax: 4 }))).not.toHaveProperty('yMax')
    expect(graphiquePourApercu(graphique({ ...sports, yMax: 10 }))?.yMax).toBe(10)
  })

  it('should leave an empty chart out of the student preview, and draw a complete one', () => {
    expect(brouillonVersApercu(brouillonAvec(graphique())).chapitre.sections[0].blocks).toEqual([])
    const [bloc] = brouillonVersApercu(
      brouillonAvec(graphique({ kind: 'pie', alt: 'D', xLabel: 'Sport', ...sports }))
    ).chapitre.sections[0].blocks
    expect(bloc).toMatchObject({ type: 'chart', kind: 'pie', alt: 'D', ...sports })
    expect(bloc).not.toHaveProperty('xLabel')
  })
})
