import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// L'éditeur charge le cours + le référentiel depuis l'API : on moque ces appels (pas de back).
const { getCoursBrouillon, enregistrerCours, listerCompetences } = vi.hoisted(() => ({
  getCoursBrouillon: vi.fn(),
  enregistrerCours: vi.fn(),
  listerCompetences: vi.fn(),
}))

vi.mock('@brio/api-client', () => ({
  getCoursBrouillon,
  enregistrerCours,
  listerCompetences,
  CoursApiError: class CoursApiError extends Error {},
}))
vi.mock('@/lib/api-base-url', () => ({ apiBaseUrl: () => 'http://test' }))

import { EditeurCours } from '../editeur-cours'

describe('EditeurCours — plan des parties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getCoursBrouillon.mockResolvedValue({
      titre: 'Mon cours',
      content: {
        schemaVersion: 1,
        id: 'c1',
        title: 'Mon cours',
        sections: [
          {
            id: 's1',
            title: 'Découverte',
            kind: 'lesson',
            blocks: [
              { id: 'b1', type: 'prose', text: 'Premier' },
              { id: 'b2', type: 'prose', text: 'Second' },
            ],
          },
          {
            id: 's2',
            title: 'Entraînement',
            kind: 'exercises',
            blocks: [{ id: 'b3', type: 'prose', text: 'Consigne' }],
          },
        ],
      },
      updatedAt: null,
      statut: 'brouillon',
      versionPubliee: null,
      classeIds: [],
      niveauCode: '6e',
    })
    enregistrerCours.mockResolvedValue(undefined)
    listerCompetences.mockResolvedValue([])
  })

  it('affiche le nombre de blocs sans le type écrit en toutes lettres', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    const lecon = screen.getByRole('button', { name: /Découverte.*bloc/ })
    expect(lecon).toHaveTextContent('2 blocs')
    expect(lecon).not.toHaveTextContent('Leçon')

    const exercices = screen.getByRole('button', { name: /Entraînement.*bloc/ })
    expect(exercices).toHaveTextContent(/1 bloc$/)
    expect(exercices).not.toHaveTextContent('Exercices')
  })

  it('distingue le type de partie par une icône nommée', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    const lecon = screen.getByRole('button', { name: /Découverte.*bloc/ })
    expect(within(lecon).getByRole('img', { name: 'Leçon' }).querySelector('use')).toHaveAttribute(
      'href',
      '/icons/sprite.svg#ph-book-open-regular'
    )

    const exercices = screen.getByRole('button', { name: /Entraînement.*bloc/ })
    expect(
      within(exercices).getByRole('img', { name: 'Exercices' }).querySelector('use')
    ).toHaveAttribute('href', '/icons/sprite.svg#ph-pencil-simple-regular')
  })
})
