import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// #406 / #407: the student's annales screen. « Par compétence » reads the competencies the annales
// work (a student-accessible endpoint) and never turns a failure into an empty list; starting an
// exam is confirmed first, and a failed start never opens the subject as if it had started.
vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    ...actual,
    listerAnnales: vi.fn(),
    listerCompetencesAnnales: vi.fn(),
    listerCompetences: vi.fn(),
    entrainementParCompetence: vi.fn(),
    demarrerExamen: vi.fn(),
  }
})

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const signalerExamenDemarre = vi.fn()
vi.mock('@/components/examen-banner', () => ({
  signalerExamenDemarre: () => signalerExamenDemarre(),
}))

import * as client from '@brio/api-client'
import { CoursApiError, type AnnaleVue } from '@brio/api-client'

import { AnnalesEleve } from '../annales-eleve'

const api = {
  listerAnnales: vi.mocked(client.listerAnnales),
  listerCompetencesAnnales: vi.mocked(client.listerCompetencesAnnales),
  listerCompetences: vi.mocked(client.listerCompetences),
  entrainementParCompetence: vi.mocked(client.entrainementParCompetence),
  demarrerExamen: vi.mocked(client.demarrerExamen),
}

const ANNALE: AnnaleVue = {
  id: 'brevet-2025-demo',
  titre: 'Brevet 2025 — sujet de démonstration',
  examen: 'brevet',
  session: 'juin',
  annee: 2025,
  centre: null,
  niveau: '3e',
  matiere: 'mathematiques',
  dureeMinutes: 120,
}

const PYTHAGORE = {
  code: 'c4.geo.pythagore.calculer',
  intitule: 'Calculer une longueur avec le théorème de Pythagore',
  domaine: 'geometrie',
  niveaux: ['4e', '3e'],
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listerAnnales.mockResolvedValue([ANNALE])
  api.listerCompetencesAnnales.mockResolvedValue([PYTHAGORE])
})

async function ouvrirParCompetence() {
  const user = userEvent.setup()
  render(<AnnalesEleve />)
  await user.click(await screen.findByRole('button', { name: 'Par compétence' }))
  return user
}

describe('Par compétence (#406)', () => {
  it('offers the competencies the annales work, never the teacher referential', async () => {
    const user = await ouvrirParCompetence()

    const choix = screen.getByLabelText('Choisis une compétence')
    expect(within(choix).getByRole('option', { name: PYTHAGORE.intitule })).toBeInTheDocument()
    expect(api.listerCompetences).not.toHaveBeenCalled()

    api.entrainementParCompetence.mockResolvedValue([
      {
        exerciceId: 'ex-1',
        prompt: 'Calcule la longueur BC.',
        exerciseType: 'numeric',
        annaleId: ANNALE.id,
        annaleTitre: ANNALE.titre,
      },
    ])
    await user.selectOptions(choix, PYTHAGORE.code)
    expect(await screen.findByText('Calcule la longueur BC.')).toBeInTheDocument()
  })

  it('says so when the competencies cannot be loaded, instead of an empty picker', async () => {
    api.listerCompetencesAnnales.mockRejectedValue(new CoursApiError(500, 'x'))
    await ouvrirParCompetence()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger les compétences pour le moment.'
    )
    expect(screen.queryByLabelText('Choisis une compétence')).toBeNull()
  })

  it('says when no annale works any competency yet', async () => {
    api.listerCompetencesAnnales.mockResolvedValue([])
    await ouvrirParCompetence()

    expect(
      await screen.findByText(
        'Aucune compétence n’est encore travaillée par les annales disponibles.'
      )
    ).toBeInTheDocument()
  })

  it('shows a loading failure of the exercises as an error, not as « aucun exercice »', async () => {
    const user = await ouvrirParCompetence()
    api.entrainementParCompetence.mockRejectedValue(new CoursApiError(500, 'x'))

    await user.selectOptions(screen.getByLabelText('Choisis une compétence'), PYTHAGORE.code)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger les exercices de cette compétence.'
    )
    expect(screen.queryByText(/Aucun exercice d’annale/)).toBeNull()
  })
})

describe('Mode examen (#407)', () => {
  it('asks for confirmation, saying the tutor is cut, before starting', async () => {
    const user = userEvent.setup()
    render(<AnnalesEleve />)

    await user.click(await screen.findByRole('button', { name: 'Démarrer en mode examen' }))

    expect(api.demarrerExamen).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'Le chrono dure 120 min. Le tuteur est coupé jusqu’à ce que tu rendes ta copie.'
      )
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByRole('button', { name: 'Démarrer en mode examen' })).toBeInTheDocument()
    expect(api.demarrerExamen).not.toHaveBeenCalled()
  })

  it('starts the exam, tells the banner, then opens the subject', async () => {
    api.demarrerExamen.mockResolvedValue({ sessionId: 's-1', endsAt: '2026-11-22T12:00:00Z' })
    const user = userEvent.setup()
    render(<AnnalesEleve />)

    await user.click(await screen.findByRole('button', { name: 'Démarrer en mode examen' }))
    await user.click(screen.getByRole('button', { name: 'Je commence l’examen' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/3e/mathematiques/brevet-2025-demo'))
    expect(api.demarrerExamen).toHaveBeenCalledWith(expect.any(String), ANNALE.id)
    expect(signalerExamenDemarre).toHaveBeenCalledTimes(1)
  })

  it('stays on the list with an error when the exam cannot start', async () => {
    api.demarrerExamen.mockRejectedValue(new CoursApiError(500, 'x'))
    const user = userEvent.setup()
    render(<AnnalesEleve />)

    await user.click(await screen.findByRole('button', { name: 'Démarrer en mode examen' }))
    await user.click(screen.getByRole('button', { name: 'Je commence l’examen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le mode examen n’a pas pu démarrer. Réessaie, ou entraîne-toi sans chrono.'
    )
    expect(push).not.toHaveBeenCalled()
    expect(signalerExamenDemarre).not.toHaveBeenCalled()
  })
})
