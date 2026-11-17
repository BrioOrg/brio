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

// A block body: an arrow returning the mock would hand it to Vitest as a cleanup, called after
// each test (and a rejecting mock would then fail the test).
beforeEach(() => {
  listerMesDevoirs.mockReset()
})

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

  // #370: the same banner above a teacher course opened from a homework.
  describe('on a course', () => {
    const COURS_ID = '0b6f2c1e-8d4a-4c3b-9f1e-2a7d5c9e1b40'
    const devoirCours = { ...devoir, id: 'd2', sourceType: 'cours', sourceRef: COURS_ID }

    // critère 2
    it('names the teacher and the due date', async () => {
      listerMesDevoirs.mockResolvedValue([devoir, devoirCours])
      render(<BandeauDevoir devoirId="d2" coursId={COURS_ID} />)

      expect(
        await screen.findByText('Devoir de M. Dubois · à rendre le 3 octobre')
      ).toBeInTheDocument()
    })

    it('omits a teacher the backend has no name for', async () => {
      listerMesDevoirs.mockResolvedValue([{ ...devoirCours, enseignant: null }])
      render(<BandeauDevoir devoirId="d2" coursId={COURS_ID} />)

      expect(await screen.findByText('Devoir · à rendre le 3 octobre')).toBeInTheDocument()
    })

    it.each([
      ['is not the student’s', 'autre', COURS_ID],
      ['points to another course', 'd2', '5c1d9e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f'],
    ])('shows nothing when the homework %s', async (_cas, devoirId, coursId) => {
      listerMesDevoirs.mockResolvedValue([devoirCours])
      const { container } = render(<BandeauDevoir devoirId={devoirId} coursId={coursId} />)

      await waitFor(() => expect(listerMesDevoirs).toHaveBeenCalled())
      expect(container).toBeEmptyDOMElement()
    })

    it('shows nothing for a chapter homework whose slug equals the course id', async () => {
      listerMesDevoirs.mockResolvedValue([{ ...devoir, sourceRef: COURS_ID }])
      const { container } = render(<BandeauDevoir devoirId="d1" coursId={COURS_ID} />)

      await waitFor(() => expect(listerMesDevoirs).toHaveBeenCalled())
      expect(container).toBeEmptyDOMElement()
    })

    it('shows nothing on a chapter for a course homework whose course id equals the slug', async () => {
      listerMesDevoirs.mockResolvedValue([{ ...devoirCours, sourceRef: 'fractions' }])
      const { container } = render(<BandeauDevoir devoirId="d2" slug="fractions" />)

      await waitFor(() => expect(listerMesDevoirs).toHaveBeenCalled())
      expect(container).toBeEmptyDOMElement()
    })
  })

  // A failed load shows nothing: the content stays readable.
  it.each([
    ['a network failure', 'reseau'],
    ['a lapsed session', 'session'],
  ])('shows nothing on %s, on a chapter or a course', async (_cas, echec) => {
    if (echec === 'reseau') listerMesDevoirs.mockRejectedValue(new TypeError('fetch failed'))
    else listerMesDevoirs.mockResolvedValue(null)
    const surChapitre = render(<BandeauDevoir devoirId="d1" slug="fractions" />)
    const surCours = render(
      <BandeauDevoir devoirId="d2" coursId="0b6f2c1e-8d4a-4c3b-9f1e-2a7d5c9e1b40" />
    )

    await waitFor(() => expect(listerMesDevoirs).toHaveBeenCalledTimes(2))
    expect(surChapitre.container).toBeEmptyDOMElement()
    expect(surCours.container).toBeEmptyDOMElement()
  })
})
