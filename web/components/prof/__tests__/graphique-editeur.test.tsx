import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { BlocEditeur } from '../bloc-editeur'
import { ProblemesDuBlocProvider } from '../problemes-du-bloc'
import { nouveauBloc, problemesBloc, type Bloc } from '@/lib/cours-editeur'

// Harnais contrôlé, comme dans l'éditeur : chaque patch est fusionné dans le bloc, et les
// problèmes de publication du bloc courant sont fournis aux champs quand `valider` est vrai.
function Harnais({ depart, valider = false }: { depart?: Partial<Bloc>; valider?: boolean }) {
  const [bloc, setBloc] = useState<Bloc>(() => ({ ...nouveauBloc('chart'), ...depart }))
  return (
    <ProblemesDuBlocProvider value={{ problemes: valider ? problemesBloc(bloc, 's1') : [] }}>
      <BlocEditeur bloc={bloc} onModifier={(patch) => setBloc((b) => ({ ...b, ...patch }))} />
      <output data-testid="etat">{JSON.stringify(bloc)}</output>
    </ProblemesDuBlocProvider>
  )
}

function etat(): Bloc {
  return JSON.parse(screen.getByTestId('etat').textContent as string)
}

function donnees() {
  return (etat().series as { data: { label: string; value?: number }[] }[])[0].data
}

async function remplir(lignes: Array<[string, string]>) {
  for (const [i, [label, valeur]] of lignes.entries()) {
    await userEvent.type(screen.getByLabelText(`Catégorie ${i + 1}`), label)
    await userEvent.type(screen.getByLabelText(`Valeur ${i + 1}`), valeur)
  }
}

describe('GraphiqueEditeur — saisie', () => {
  it('should fill the texts, categories and values of a bar chart', async () => {
    render(<Harnais />)

    await userEvent.type(screen.getByLabelText(/Texte alternatif/), 'Football 8, Basket 5')
    await userEvent.type(screen.getByLabelText('Titre (facultatif)'), 'Sport préféré')
    await userEvent.type(screen.getByLabelText('Axe horizontal (facultatif)'), 'Sport')
    await userEvent.type(screen.getByLabelText('Axe vertical (facultatif)'), 'Effectif')
    await remplir([
      ['Football', '8'],
      ['Basket', '5'],
    ])
    await userEvent.click(screen.getByLabelText(/Écrire les valeurs sur le diagramme/))

    expect(etat()).toMatchObject({
      kind: 'bar',
      alt: 'Football 8, Basket 5',
      title: 'Sport préféré',
      xLabel: 'Sport',
      yLabel: 'Effectif',
      showValues: true,
    })
    expect(donnees()).toEqual([
      { label: 'Football', value: 8 },
      { label: 'Basket', value: 5 },
    ])
  })

  it('should leave a cleared value missing, not zero', async () => {
    render(<Harnais />)
    const valeur = screen.getByLabelText('Valeur 1')
    await userEvent.type(valeur, '3')
    await userEvent.clear(valeur)
    expect(donnees()[0]).not.toHaveProperty('value')
  })

  it('should rename what the values measure', async () => {
    render(<Harnais />)
    const nom = screen.getByLabelText('Ce que mesurent les valeurs')
    expect(nom).toHaveValue('Effectif')
    await userEvent.clear(nom)
    await userEvent.type(nom, 'Température (°C)')
    expect((etat().series as { label: string }[])[0].label).toBe('Température (°C)')
  })

  it('should switch kind, hiding the axis fields of a pie', async () => {
    render(<Harnais />)
    const sortes = screen.getByRole('group', { name: 'Sorte de diagramme' })
    expect(within(sortes).getByRole('button', { name: 'Barres' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await userEvent.click(within(sortes).getByRole('button', { name: 'Circulaire' }))
    expect(etat().kind).toBe('pie')
    expect(screen.queryByLabelText('Axe horizontal (facultatif)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Écrire les valeurs/)).not.toBeInTheDocument()
    expect(screen.getByText('2 à 6 catégories')).toBeInTheDocument()

    await userEvent.click(within(sortes).getByRole('button', { name: 'Courbe' }))
    expect(etat().kind).toBe('line')
    expect(screen.getByLabelText('Axe horizontal (facultatif)')).toBeInTheDocument()
  })
})

describe('GraphiqueEditeur — nombre de catégories', () => {
  it('should keep at least two categories', () => {
    render(<Harnais />)
    for (const n of [1, 2]) {
      expect(screen.getByRole('button', { name: `Supprimer la catégorie ${n}` })).toBeDisabled()
    }
  })

  it('should add up to twelve categories, six for a pie', async () => {
    render(<Harnais />)
    const ajouter = screen.getByRole('button', { name: '＋ Ajouter une catégorie' })
    for (let i = 0; i < 4; i++) await userEvent.click(ajouter)
    expect(donnees()).toHaveLength(6)
    expect(ajouter).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Circulaire' }))
    expect(ajouter).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Barres' }))
    for (let i = 0; i < 6; i++) await userEvent.click(ajouter)
    expect(donnees()).toHaveLength(12)
    expect(ajouter).toBeDisabled()
    expect(screen.getByText('2 à 12 catégories')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la catégorie 12' }))
    expect(donnees()).toHaveLength(11)
  })
})

describe('GraphiqueEditeur — aperçu', () => {
  it('should invite to fill two categories before drawing', () => {
    render(<Harnais />)
    expect(
      screen.getByText('Nomme et chiffre au moins deux catégories pour voir le diagramme.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('should draw the chart with the student renderer once two categories are complete', async () => {
    render(<Harnais />)
    await userEvent.type(screen.getByLabelText(/Texte alternatif/), 'Football 8, Basket 5')
    await remplir([
      ['Football', '8'],
      ['Basket', '5'],
    ])
    expect(screen.getByRole('img', { name: 'Football 8, Basket 5' })).toBeInTheDocument()
    // Le tableau de données caché du rendu élève reprend les valeurs saisies.
    expect(screen.getByRole('rowheader', { name: 'Football' })).toBeInTheDocument()
  })

  it('should draw a pie with one sector per category', async () => {
    const { container } = render(<Harnais depart={{ kind: 'pie' }} />)
    await remplir([
      ['Oui', '12'],
      ['Non', '6'],
    ])
    expect(container.querySelectorAll('svg path')).toHaveLength(2)
  })
})

describe('GraphiqueEditeur — problèmes avant publication', () => {
  it('should mark the alt text, blank names and missing values', () => {
    render(<Harnais valider />)
    expect(screen.getByLabelText(/Texte alternatif/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Catégorie 1')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Valeur 2')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Titre (facultatif)')).not.toHaveAttribute('aria-invalid')
  })

  it('should mark a duplicated name and a non-positive pie value, then clear them', async () => {
    render(
      <Harnais
        valider
        depart={{
          kind: 'pie',
          alt: 'Oui 12, Non 0',
          series: [
            {
              label: 'Effectif',
              data: [
                { label: 'Oui', value: 12 },
                { label: 'Oui', value: 0 },
              ],
            },
          ],
        }}
      />
    )
    expect(screen.getByLabelText('Catégorie 1')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('Catégorie 2')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Valeur 2')).toHaveAttribute('aria-invalid', 'true')

    await userEvent.type(screen.getByLabelText('Catégorie 2'), 'n')
    await userEvent.clear(screen.getByLabelText('Valeur 2'))
    await userEvent.type(screen.getByLabelText('Valeur 2'), '6')
    expect(screen.getByLabelText('Catégorie 2')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('Valeur 2')).not.toHaveAttribute('aria-invalid')
  })

  it('should mark the category list of a pie with too many categories', () => {
    const data = Array.from({ length: 7 }, (_, i) => ({ label: `C${i + 1}`, value: 1 }))
    const { container } = render(
      <Harnais valider depart={{ kind: 'pie', alt: 'D', series: [{ label: 'n', data }] }} />
    )
    expect(container.querySelector('[data-champ="series[0].data"]')).toHaveAttribute(
      'data-invalide',
      'true'
    )
  })
})
