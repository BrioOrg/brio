import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CoursDeTaClasse } from '../cours-de-ta-classe'
import type { Catalogue } from '@/lib/api'

// PL-6a (#398), décision humaine : le bloc de l'onglet « À faire » montre les 3 cours publiés le
// plus récemment, puis « Voir tous les cours du prof » s'il y en a davantage.

const catalogue = [
  {
    niveauCode: '5e',
    niveauLibelle: '5e',
    matieres: [
      { matiereCode: 'mathematiques', matiereLibelle: 'Mathématiques', chapitres: [] },
      { matiereCode: 'francais', matiereLibelle: 'Français', chapitres: [] },
      { matiereCode: 'histoire', matiereLibelle: 'Histoire', chapitres: [] },
    ],
  },
] satisfies Catalogue

const cours = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000c00${n}`,
  titre: `Cours numéro ${n}`,
  niveauCode: '5e',
  matiereCode: 'mathematiques',
  enseignant: 'M. Dubois',
  publieAt: `2026-10-0${10 - n}T08:00:00Z`,
  classeIds: ['c1'],
})
const liste = (k: number) => Array.from({ length: k }, (_, i) => cours(i + 1))

describe('CoursDeTaClasse avec plafond', () => {
  it('plafond 3, 4 cours : 3 cartes dans l’ordre reçu, la 4e absente, lien « Voir tous les cours du prof »', () => {
    render(<CoursDeTaClasse cours={liste(4)} catalogue={catalogue} plafond={3} />)

    const region = screen.getByRole('region', { name: 'Les cours de ta classe' })
    const items = within(region).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items.map((li) => within(li).getByRole('link').getAttribute('href'))).toEqual([
      '/cours/00000000-0000-4000-8000-00000000c001',
      '/cours/00000000-0000-4000-8000-00000000c002',
      '/cours/00000000-0000-4000-8000-00000000c003',
    ])
    expect(screen.queryByText('Cours numéro 4')).toBeNull()
    expect(screen.getByRole('link', { name: /Voir tous les cours du prof/ })).toHaveAttribute(
      'href',
      '/ma-classe/cours'
    )
  })

  it('plafond 3, exactement 3 cours : 3 cartes et pas de « Voir tous » (il n’y a rien de plus)', () => {
    render(<CoursDeTaClasse cours={liste(3)} catalogue={catalogue} plafond={3} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('link', { name: /Voir tous les cours du prof/ })).toBeNull()
  })

  it('sans plafond (onglet « Cours du prof »), 5 cours : 5 cartes et pas de « Voir tous »', () => {
    render(<CoursDeTaClasse cours={liste(5)} catalogue={catalogue} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByRole('link', { name: /Voir tous les cours du prof/ })).toBeNull()
  })
})

it('regroupe les cours visibles par matière et garde accessibles ceux sans libellé', () => {
  render(
    <CoursDeTaClasse
      cours={[
        cours(1),
        { ...cours(2), matiereCode: 'francais' },
        { ...cours(3), matiereCode: 'inconnue' },
        cours(4),
      ]}
      catalogue={catalogue}
    />
  )

  expect(
    screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
  ).toEqual(['Français', 'Mathématiques', 'Autres cours'])
  const [francais, maths, autres] = screen.getAllByRole('list')
  expect(within(francais).getByRole('link', { name: /Cours numéro 2/ })).toHaveAttribute(
    'href',
    `/cours/${cours(2).id}`
  )
  expect(
    within(maths)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
  ).toEqual([`/cours/${cours(1).id}`, `/cours/${cours(4).id}`])
  expect(within(autres).getByRole('link', { name: /Cours numéro 3/ })).toHaveAttribute(
    'href',
    `/cours/${cours(3).id}`
  )
})
