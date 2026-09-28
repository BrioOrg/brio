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

describe('EditeurCours — ajout de bloc par « + »', () => {
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

  it('n’affiche plus la barre « Insérer » du haut', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')
    expect(screen.queryByText('Insérer :')).toBeNull()
  })

  it('ouvre le menu depuis un « + » et insère le bloc choisi à cet endroit', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    // Partie vide : un seul point d'ajout (le bouton « Ajouter un bloc »).
    expect(screen.getAllByLabelText('Ajouter un bloc ici')).toHaveLength(1)

    await userEvent.click(screen.getByLabelText('Ajouter un bloc ici'))

    // Le menu propose le contenu ET les exercices.
    expect(screen.getByRole('menuitem', { name: 'Formule' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'QCM' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('menuitem', { name: 'Texte' }))

    // Le menu se referme, et un bloc a été inséré → deux « + » encadrent désormais le bloc.
    expect(screen.queryByRole('menuitem', { name: 'Texte' })).toBeNull()
    expect(screen.getAllByLabelText('Ajouter un bloc ici')).toHaveLength(2)
  })

  it('ferme le menu avec la touche Échap', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    await userEvent.click(screen.getByLabelText('Ajouter un bloc ici'))
    expect(screen.getByRole('menuitem', { name: 'Formule' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menuitem', { name: 'Formule' })).toBeNull()
  })
})
