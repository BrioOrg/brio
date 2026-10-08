import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { BlocEditeur } from '../bloc-editeur'
import { nouveauBloc, type Bloc, type Choix, type ExerciceType } from '@/lib/cours-editeur'

// Harnais contrôlé : chaque `onModifier(patch)` est fusionné dans le bloc, comme dans l'éditeur.
// On expose le bloc courant via une réf pour l'inspecter après édition.
function Harnais({ exerciseType }: { exerciseType: ExerciceType }) {
  const [bloc, setBloc] = useState<Bloc>(() => nouveauBloc('exercise', exerciseType))
  return (
    <>
      <BlocEditeur bloc={bloc} onModifier={(patch) => setBloc((b) => ({ ...b, ...patch }))} />
      <output data-testid="etat">{JSON.stringify(bloc)}</output>
    </>
  )
}

function etat(): Bloc {
  return JSON.parse(screen.getByTestId('etat').textContent as string)
}

describe('BlocEditeur — exercice QCM', () => {
  it('coche une proposition comme bonne réponse et bascule « plusieurs »', async () => {
    render(<Harnais exerciseType="multiple-choice" />)

    await userEvent.type(screen.getByPlaceholderText('Réponse 1'), 'Le grand côté')
    await userEvent.click(screen.getByLabelText('Bonne réponse 1'))
    await userEvent.click(screen.getByLabelText('Plusieurs bonnes réponses'))

    const choix = etat().choices as Choix[]
    expect(choix[0]).toMatchObject({ text: 'Le grand côté', correct: true })
    expect(choix[1].correct).toBe(false)
    expect(etat().multiple).toBe(true)
  })

  it('ajoute une proposition et empêche de descendre sous deux', async () => {
    render(<Harnais exerciseType="multiple-choice" />)

    // Deux propositions au départ ; on ne peut pas descendre sous deux (boutons désactivés).
    const supprimer = screen.getAllByRole('button', { name: 'Supprimer la réponse' })
    expect(supprimer).toHaveLength(2)
    supprimer.forEach((b) => expect(b).toBeDisabled())

    await userEvent.click(screen.getByRole('button', { name: '＋ Ajouter une réponse' }))
    expect((etat().choices as Choix[]).length).toBe(3)
  })
})

describe('BlocEditeur — réponse courte', () => {
  it('saisit une réponse acceptée et active la sensibilité à la casse', async () => {
    render(<Harnais exerciseType="short-answer" />)

    await userEvent.type(screen.getByPlaceholderText('Ex. hypoténuse'), 'hypoténuse')
    await userEvent.click(screen.getByLabelText('Sensible à la casse'))

    expect(etat().acceptedAnswers).toEqual(['hypoténuse'])
    expect(etat().caseSensitive).toBe(true)
  })
})

describe('BlocEditeur — numérique', () => {
  it('enregistre la réponse comme nombre et l’unité comme texte', async () => {
    render(<Harnais exerciseType="numeric" />)

    await userEvent.type(screen.getByLabelText('Réponse attendue'), '5')
    await userEvent.type(screen.getByLabelText('Unité'), 'cm')

    expect(etat().answer).toBe(5)
    expect(etat().unit).toBe('cm')
  })

  it('n’émet pas de réponse quand le champ est vidé (distinct de zéro)', async () => {
    render(<Harnais exerciseType="numeric" />)

    const champ = screen.getByLabelText('Réponse attendue')
    await userEvent.type(champ, '7')
    expect(etat().answer).toBe(7)
    await userEvent.clear(champ)
    expect(etat()).not.toHaveProperty('answer')
  })
})

// Harnais générique pour les blocs non-exercice : on part d'un bloc neuf du type demandé.
function HarnaisBloc({ type }: { type: Parameters<typeof nouveauBloc>[0] }) {
  const [bloc, setBloc] = useState<Bloc>(() => nouveauBloc(type))
  return (
    <>
      <BlocEditeur bloc={bloc} onModifier={(patch) => setBloc((b) => ({ ...b, ...patch }))} />
      <output data-testid="etat">{JSON.stringify(bloc)}</output>
    </>
  )
}

describe('BlocEditeur — tableau', () => {
  it('édite une cellule, ajoute une ligne et une colonne', async () => {
    render(<HarnaisBloc type="table" />)

    await userEvent.type(screen.getByLabelText('Ligne 1, colonne 1'), 'Longueur')
    await userEvent.click(screen.getByRole('button', { name: '＋ Ligne' }))
    await userEvent.click(screen.getByRole('button', { name: '＋ Colonne' }))

    const b = etat()
    expect((b.rows as string[][]).length).toBe(2)
    expect((b.rows as string[][])[0].length).toBe(3)
    expect((b.headers as string[]).length).toBe(3)
    expect((b.rows as string[][])[0][0]).toBe('Longueur')
  })

  it('retire la ligne d’en-têtes', async () => {
    render(<HarnaisBloc type="table" />)
    await userEvent.click(screen.getByLabelText('Ligne d’en-têtes'))
    expect(etat()).not.toHaveProperty('headers')
  })
})

describe('BlocEditeur — référence', () => {
  it('saisit une référence externe (titre + url https)', async () => {
    render(<HarnaisBloc type="reference" />)

    await userEvent.type(screen.getByPlaceholderText('https://…'), 'https://example.org')
    const b = etat()
    expect(b.scope).toBe('external')
    expect(b.url).toBe('https://example.org')
  })

  it('bascule en interne et saisit une cible', async () => {
    render(<HarnaisBloc type="reference" />)

    await userEvent.click(screen.getByRole('button', { name: 'Chapitre de la plateforme' }))
    await userEvent.type(screen.getByPlaceholderText('Ex. 6e'), '6e')
    await userEvent.type(screen.getByPlaceholderText('Ex. mathematiques'), 'mathematiques')
    await userEvent.type(screen.getByPlaceholderText('Ex. theoreme-de-pythagore'), 'pythagore')

    const b = etat()
    expect(b.scope).toBe('internal')
    expect(b.target).toMatchObject({ level: '6e', subject: 'mathematiques', slug: 'pythagore' })
    expect(b).not.toHaveProperty('url')
  })
})

describe('BlocEditeur — figure', () => {
  it('exige un alt et construit une spec point par point', async () => {
    render(<HarnaisBloc type="figure" />)

    await userEvent.type(
      screen.getByLabelText('Texte alternatif de la figure'),
      'Triangle rectangle en A'
    )
    await userEvent.click(screen.getByRole('button', { name: '＋ Point' }))

    const b = etat()
    expect(b.alt).toBe('Triangle rectangle en A')
    const points = (b.spec as { points: { name: string }[] }).points
    expect(points).toHaveLength(1)
    expect(points[0].name).toBe('A')
  })

  it('relie deux points par un segment', async () => {
    render(<HarnaisBloc type="figure" />)

    await userEvent.click(screen.getByRole('button', { name: '＋ Point' }))
    await userEvent.click(screen.getByRole('button', { name: '＋ Point' }))
    await userEvent.click(screen.getByRole('button', { name: '＋ Segment' }))

    await userEvent.selectOptions(screen.getByLabelText('Segment 1 — départ'), 'A')
    await userEvent.selectOptions(screen.getByLabelText('Segment 1 — arrivée'), 'B')

    const segs = (etat().spec as { segments: { from: string; to: string }[] }).segments
    expect(segs[0]).toEqual({ from: 'A', to: 'B' })
  })
})

describe('BlocEditeur — figure en repère', () => {
  it('trace un repère avec quadrillage et règle un axe', async () => {
    render(<HarnaisBloc type="figure" />)

    await userEvent.click(screen.getByLabelText('Tracer un repère'))
    const fin = screen.getByLabelText('Axe des ordonnées — fin')
    await userEvent.clear(fin)
    await userEvent.type(fin, '20')
    await userEvent.type(screen.getByLabelText('Axe des ordonnées — titre'), 'Prix (€)')

    const axes = (etat().spec as { axes: Record<string, unknown> }).axes
    expect(axes).toMatchObject({
      x: { from: 0, to: 10, step: 1 },
      y: { from: 0, to: 20, step: 1, title: 'Prix (€)' },
      grid: true,
    })
    // Les axes fixent la zone : le réglage manuel disparaît.
    expect(screen.queryByText(/Fixer la zone affichée/)).not.toBeInTheDocument()
  })

  it('masque le point noir et le nom d’un point de construction', async () => {
    render(<HarnaisBloc type="figure" />)

    await userEvent.click(screen.getByRole('button', { name: '＋ Point' }))
    await userEvent.click(screen.getByLabelText('Afficher le point A'))
    await userEvent.click(screen.getByLabelText('Afficher le nom du point A'))

    const [a] = (etat().spec as { points: Record<string, unknown>[] }).points
    expect(a).toMatchObject({ name: 'A', dot: false, showName: false })
  })

  it('relie trois points par une ligne brisée', async () => {
    render(<HarnaisBloc type="figure" />)

    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: '＋ Point' }))
    }
    await userEvent.click(screen.getByRole('button', { name: '＋ Ligne brisée' }))
    await userEvent.click(screen.getByRole('button', { name: '＋ point' }))
    for (const [k, nom] of ['A', 'B', 'C'].entries()) {
      await userEvent.selectOptions(screen.getByLabelText(`Ligne brisée 1 — point ${k + 1}`), nom)
    }

    const pl = (etat().spec as { polylines: { points: string[] }[] }).polylines
    expect(pl).toEqual([{ points: ['A', 'B', 'C'] }])
  })
})

describe('BlocEditeur — texte à trous', () => {
  it('ajoute une réponse attendue par trou et la met dans la banque', async () => {
    render(<Harnais exerciseType="fill-blank" />)

    await userEvent.type(screen.getByLabelText('Phrase à compléter'), 'Le côté ')
    await userEvent.click(screen.getByRole('button', { name: '＋ trou' }))
    await userEvent.type(screen.getByLabelText('Réponse attendue 1'), 'hypoténuse')

    expect(etat()).toMatchObject({
      template: 'Le côté {}',
      expected: ['hypoténuse'],
      bank: ['hypoténuse'],
    })
  })

  it('suit les {} tapés à la main', async () => {
    render(<Harnais exerciseType="fill-blank" />)

    // `{{` tape une accolade littérale avec user-event.
    await userEvent.type(screen.getByLabelText('Phrase à compléter'), '{{} + {{} = 4')

    expect(screen.getByLabelText('Réponse attendue 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Réponse attendue 2')).toBeInTheDocument()
    expect(etat().expected).toEqual(['', ''])
  })

  it('ajoute des étiquettes pièges à la banque, à côté des réponses', async () => {
    render(<Harnais exerciseType="fill-blank" />)

    await userEvent.click(screen.getByRole('button', { name: '＋ trou' }))
    await userEvent.type(screen.getByLabelText('Réponse attendue 1'), 'droit')
    await userEvent.click(screen.getByRole('button', { name: '＋ Ajouter une étiquette piège' }))
    await userEvent.type(screen.getByLabelText('Étiquette piège 1'), 'aigu')

    expect(etat().bank).toEqual(['droit', 'aigu'])
    expect(etat().expected).toEqual(['droit'])

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer l’étiquette piège' }))
    expect(etat().bank).toEqual(['droit'])
  })
})
