import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DevoirEleveVue } from '@brio/api-client'

const listerMesDevoirs = vi.hoisted(() => vi.fn())

vi.mock('@brio/api-client', () => ({ listerMesDevoirs }))

import { BandeauDevoir, BandeauDevoirVue } from '../bandeau-devoir'

const devoir: DevoirEleveVue = {
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

const COURS_ID = '0b6f2c1e-8d4a-4c3b-9f1e-2a7d5c9e1b40'
const devoirCours: DevoirEleveVue = {
  ...devoir,
  id: 'd2',
  sourceType: 'cours',
  sourceRef: COURS_ID,
}

// Waits for the homework list to be asked, then flushes the effects that follow its answer, so a
// "shows nothing" assertion runs after the banner has filtered the list, not before it loaded.
async function apresChargement(appels = 1) {
  await waitFor(() => expect(listerMesDevoirs).toHaveBeenCalledTimes(appels))
  await act(async () => {})
}

// A block body: an arrow returning the mock would hand it to Vitest as a cleanup, called after
// each test (and a rejecting mock would then fail the test).
beforeEach(() => {
  listerMesDevoirs.mockReset()
})

describe('BandeauDevoir (a catalogue chapter, loaded in the browser)', () => {
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

    await apresChargement()
    expect(container).toBeEmptyDOMElement()
  })

  // #370: a course homework never shows on a chapter, even when its ref equals the slug.
  it('shows nothing on a chapter for a course homework whose course id equals the slug', async () => {
    listerMesDevoirs.mockResolvedValue([{ ...devoirCours, sourceRef: 'fractions' }])
    const { container } = render(<BandeauDevoir devoirId="d2" slug="fractions" />)

    await apresChargement()
    expect(container).toBeEmptyDOMElement()
  })

  // A failed load shows nothing: the chapter stays readable.
  it.each([
    ['a network failure', 'reseau'],
    ['a lapsed session', 'session'],
  ])('shows nothing on %s', async (_cas, echec) => {
    if (echec === 'reseau') listerMesDevoirs.mockRejectedValue(new TypeError('fetch failed'))
    else listerMesDevoirs.mockResolvedValue(null)
    const { container } = render(<BandeauDevoir devoirId="d1" slug="fractions" />)

    await apresChargement()
    expect(container).toBeEmptyDOMElement()
  })
})

// #370: the same banner above a teacher course, the homework found on the server.
describe('BandeauDevoirVue (a teacher course, the homework already found)', () => {
  // critère 2
  it('names the teacher and the due date, without loading anything', () => {
    render(<BandeauDevoirVue enseignant="M. Dubois" echeanceAt="2026-10-03T10:00:00Z" />)

    expect(screen.getByText('Devoir de M. Dubois · à rendre le 3 octobre')).toBeInTheDocument()
    expect(listerMesDevoirs).not.toHaveBeenCalled()
  })

  it('omits a teacher the backend has no name for', () => {
    render(<BandeauDevoirVue enseignant={null} echeanceAt="2026-10-03T10:00:00Z" />)

    expect(screen.getByText('Devoir · à rendre le 3 octobre')).toBeInTheDocument()
    expect(screen.queryByText(/M\. Dubois/)).toBeNull()
  })
})
