import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mêmes mocks que editeur-cours-ajout : l'éditeur charge cours + référentiel depuis l'API.
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

describe('EditeurCours — préréglage Vrai/Faux et bouton IA dormant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getCoursBrouillon.mockResolvedValue({
      titre: 'Mon cours',
      content: {
        schemaVersion: 1,
        id: 'c1',
        title: 'Mon cours',
        sections: [{ id: 's1', title: '', kind: 'lesson', blocks: [] }],
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

  it('insère un QCM pré-rempli « Vrai » / « Faux » depuis le menu « + »', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    await userEvent.click(screen.getByLabelText('Ajouter un bloc ici'))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Vrai / Faux' }))

    // Un exercice QCM est inséré avec deux propositions déjà nommées, aucune cochée bonne.
    expect(screen.getByDisplayValue('Vrai')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Faux')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Réponse 1')).toBeInTheDocument()
  })

  it('affiche le bouton « Aide-moi à rédiger » désactivé (à venir)', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    const bouton = screen.getByRole('button', { name: /Aide-moi à rédiger/ })
    expect(bouton).toBeDisabled()
  })
})
