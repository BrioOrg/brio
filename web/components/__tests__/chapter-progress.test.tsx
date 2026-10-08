import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/progression', () => ({ getParcours: vi.fn() }))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))

import { getParcours } from '@/lib/progression'
import { getMoi } from '@/lib/session'
import { ChapterProgress } from '../chapter-progress'

const ELEVE = { id: 'e1', role: 'eleve', statut: 'actif', nom: null, email: null }

function renderBar() {
  return render(<ChapterProgress niveau="6e" matiere="mathematiques" slug="fractions" />)
}

describe('ChapterProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the real completion percentage of the current chapter for a student', async () => {
    vi.mocked(getMoi).mockResolvedValue(ELEVE)
    vi.mocked(getParcours).mockResolvedValue([
      { chapitreId: 'fractions', ordre: 1, etat: 'EN_COURS', pourcentage: 40 },
      { chapitreId: 'pourcentages', ordre: 2, etat: 'VERROUILLE', pourcentage: 0 },
    ])

    renderBar()

    const bar = await screen.findByRole('progressbar', { name: /40\s*%/ })
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(getParcours).toHaveBeenCalledWith('6e', 'mathematiques')
  })

  it('reads "Chapitre terminé" at 100 %', async () => {
    vi.mocked(getMoi).mockResolvedValue(ELEVE)
    vi.mocked(getParcours).mockResolvedValue([
      { chapitreId: 'fractions', ordre: 1, etat: 'FAIT', pourcentage: 100 },
    ])

    renderBar()

    expect(await screen.findByText('Chapitre terminé')).toBeInTheDocument()
  })

  it('renders nothing for a logged-out visitor', async () => {
    vi.mocked(getMoi).mockResolvedValue(null)

    const { container } = renderBar()

    await waitFor(() => expect(getMoi).toHaveBeenCalled())
    expect(getParcours).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a teacher (no student path)', async () => {
    vi.mocked(getMoi).mockResolvedValue({ ...ELEVE, role: 'enseignant' })

    const { container } = renderBar()

    await waitFor(() => expect(getMoi).toHaveBeenCalled())
    expect(getParcours).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the chapter is absent from the path', async () => {
    vi.mocked(getMoi).mockResolvedValue(ELEVE)
    vi.mocked(getParcours).mockResolvedValue([
      { chapitreId: 'autre-chapitre', ordre: 1, etat: 'EN_COURS', pourcentage: 25 },
    ])

    const { container } = renderBar()

    await waitFor(() => expect(getParcours).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
