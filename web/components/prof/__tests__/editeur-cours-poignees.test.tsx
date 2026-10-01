import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('EditeurCours — poignées des blocs et des parties', () => {
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
            title: 'Partie 1',
            kind: 'lesson',
            blocks: [
              { id: 'b1', type: 'prose', text: 'Premier' },
              { id: 'b2', type: 'prose', text: 'Second' },
            ],
          },
          { id: 's2', title: 'Partie 2', kind: 'lesson', blocks: [] },
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

  it.each(['Descendre', 'Dupliquer', 'Supprimer'])(
    'nomme l’opération « %s » d’un bloc au focus clavier',
    async (nom) => {
      render(<EditeurCours coursId="c1" />)
      await screen.findByLabelText('Titre du cours')

      // Premier bloc : « Monter » y est désactivé, on prend donc ses voisins.
      const [premier] = screen.getAllByRole('button', { name: nom })
      premier.focus()
      expect(await screen.findByRole('tooltip')).toHaveTextContent(nom)
    }
  )

  it('nomme « Monter » sur un bloc qui peut monter', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    const monter = screen.getAllByRole('button', { name: 'Monter' })
    expect(monter[0]).toBeDisabled()
    monter[1].focus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Monter')
  })

  it.each(['Descendre la partie', 'Supprimer la partie'])(
    'nomme l’opération « %s » dans le plan',
    async (nom) => {
      render(<EditeurCours coursId="c1" />)
      await screen.findByLabelText('Titre du cours')

      // Première partie : ses deux poignées sont actives.
      screen.getAllByRole('button', { name: nom })[0].focus()
      expect(await screen.findByRole('tooltip')).toHaveTextContent(nom)
    }
  )

  it('remplace les caractères ↑ ↓ ⧉ par des icônes du sprite', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    const [supprimer] = screen.getAllByRole('button', { name: 'Supprimer' })
    expect(supprimer).not.toHaveAttribute('title')
    expect(supprimer.textContent).toBe('')
    expect(supprimer.querySelector('use')).toHaveAttribute(
      'href',
      '/icons/sprite.svg#ph-trash-regular'
    )
  })

  it('n’ouvre aucune infobulle sans survol ni focus', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')
    expect(screen.queryByRole('tooltip')).toBeNull()
    await userEvent.click(screen.getByLabelText('Titre du cours'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
