import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listerMesDevoirs = vi.hoisted(() => vi.fn())

vi.mock('@brio/api-client', () => ({ listerMesDevoirs }))

import { BandeauDevoir } from '../bandeau-devoir'

const devoir = {
  id: 'd1',
  classeId: 'c1',
  titre: 'DM',
  enseignant: 'M. Dubois',
  sourceType: 'chapitre',
  sourceRef: 'fractions',
  echeanceAt: '2026-10-03T10:00:00Z',
  nombreExercices: 1,
  statutRendu: 'non_commence',
  corrige: false,
}

beforeEach(() => listerMesDevoirs.mockReset())

describe('BandeauDevoir', () => {
  it('names the teacher and the due date', async () => {
    listerMesDevoirs.mockResolvedValue([devoir])
    render(<BandeauDevoir devoirId="d1" slug="fractions" />)

    expect(
      await screen.findByText('Devoir de M. Dubois · à rendre le 3 octobre')
    ).toBeInTheDocument()
  })

  it('omits a teacher the backend has no name for', async () => {
    listerMesDevoirs.mockResolvedValue([{ ...devoir, enseignant: null }])
    render(<BandeauDevoir devoirId="d1" slug="fractions" />)

    expect(await screen.findByText('Devoir · à rendre le 3 octobre')).toBeInTheDocument()
  })

  it.each([
    ['is not the student’s', 'autre', 'fractions'],
    ['points to another chapter', 'd1', 'pythagore'],
  ])('shows nothing when the homework %s', async (_cas, devoirId, slug) => {
    listerMesDevoirs.mockResolvedValue([devoir])
    const { container } = render(<BandeauDevoir devoirId={devoirId} slug={slug} />)

    await waitFor(() => expect(listerMesDevoirs).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
