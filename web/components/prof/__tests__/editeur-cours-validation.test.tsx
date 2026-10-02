import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// L'éditeur et la fenêtre « Publier » appellent l'API : on moque ces appels (pas de back).
const api = vi.hoisted(() => ({
  getCoursBrouillon: vi.fn(),
  enregistrerCours: vi.fn(),
  listerCompetences: vi.fn(),
  listerMesClasses: vi.fn(),
  definirPortees: vi.fn(),
  publierCours: vi.fn(),
  sectionsDuChapitrePublie: vi.fn(),
}))

vi.mock('@brio/api-client', () => ({
  ...api,
  CoursApiError: class CoursApiError extends Error {
    violations: unknown[] = []
  },
}))
vi.mock('@/lib/api-base-url', () => ({ apiBaseUrl: () => 'http://test' }))

import { EditeurCours } from '../editeur-cours'

const REFERENCE_INTERNE = {
  id: 'r1',
  type: 'reference',
  scope: 'internal',
  title: 'Voir Pythagore',
  target: { level: '3e', subject: 'mathematiques', slug: 'pythagore' },
}

function chargerCours(sections: unknown[]) {
  api.getCoursBrouillon.mockResolvedValue({
    titre: 'Mon cours',
    content: { schemaVersion: 1, id: 'c1', title: 'Mon cours', sections },
    updatedAt: null,
    statut: 'brouillon',
    versionPubliee: null,
    classeIds: [],
    niveauCode: '3e',
  })
}

describe('EditeurCours — validation avant publication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    api.enregistrerCours.mockResolvedValue(undefined)
    api.listerCompetences.mockResolvedValue([])
    api.listerMesClasses.mockResolvedValue([{ id: 'cl1', libelle: '3e A', niveauCode: '3e' }])
    chargerCours([
      {
        id: 's1',
        title: 'Partie 1',
        kind: 'lesson',
        blocks: [{ id: 'b1', type: 'prose', text: 'Introduction' }],
      },
      {
        id: 's2',
        title: 'Partie 2',
        kind: 'exercises',
        blocks: [{ id: 'b2', type: 'formula', latex: '' }],
      },
    ])
  })

  it('ne signale rien pendant la rédaction', async () => {
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    expect(screen.queryByText(/à corriger/)).not.toBeInTheDocument()
  })

  it('signale les problèmes dans le plan une fois « Publier » cliqué, sans rien envoyer', async () => {
    const user = userEvent.setup()
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    await user.click(screen.getByRole('button', { name: 'Publier' }))

    expect(screen.getByText('1 à corriger')).toBeInTheDocument()
    const dialogue = screen.getByRole('dialog', { name: 'Publier le cours' })
    await user.click(await within(dialogue).findByRole('checkbox', { name: /3e A/ }))
    expect(within(dialogue).getByRole('button', { name: 'Publier' })).toBeDisabled()
    expect(api.publierCours).not.toHaveBeenCalled()
  })

  it('mène au champ fautif d’une autre partie et le signale sur son bloc', async () => {
    const user = userEvent.setup()
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    await user.click(screen.getByRole('button', { name: 'Publier' }))
    await user.click(screen.getByRole('button', { name: /Partie 2 · Formule.*Remplis la formule/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const champ = screen.getByLabelText('Formule du bloc')
    await waitFor(() => expect(champ).toHaveFocus())
    expect(champ).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('list', { name: 'À corriger avant de publier' })).toHaveTextContent(
      'Remplis la formule.'
    )
  })

  it('retire le signalement dès que le champ est corrigé', async () => {
    const user = userEvent.setup()
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    await user.click(screen.getByRole('button', { name: 'Publier' }))
    await user.click(screen.getByRole('button', { name: /Remplis la formule/ }))
    await user.type(screen.getByLabelText('Formule du bloc'), 'a^2')

    expect(screen.queryByText('Remplis la formule.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Formule du bloc')).not.toHaveAttribute('aria-invalid')
  })

  it('vérifie une référence interne contre le catalogue à l’ouverture de « Publier »', async () => {
    chargerCours([{ id: 's1', title: 'Partie 1', kind: 'lesson', blocks: [REFERENCE_INTERNE] }])
    api.sectionsDuChapitrePublie.mockResolvedValue(null)
    const user = userEvent.setup()
    render(<EditeurCours coursId="c1" />)
    await screen.findByLabelText('Titre du cours')

    await user.click(screen.getByRole('button', { name: 'Publier' }))

    expect(
      await screen.findByRole('button', { name: /Aucun chapitre publié ne correspond/ })
    ).toBeInTheDocument()
    expect(api.sectionsDuChapitrePublie).toHaveBeenCalledWith(
      'http://test',
      '3e',
      'mathematiques',
      'pythagore'
    )
  })
})
