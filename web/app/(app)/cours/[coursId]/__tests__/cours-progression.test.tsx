import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The teacher course page with the progression of a chapter (ADR 0050 §7, #400): the interactive
// mode, the course's own gauge in reading mode, and an end slide that sends back to the courses.

const modeCookie = vi.hoisted(() => ({ valeur: undefined as string | undefined }))
const getProgressionCours = vi.hoisted(() => vi.fn())

vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
  listerMesDevoirs: async () => [],
  getSerie: async () => null,
  getMoi: async () => ({ role: 'eleve' }),
  controleActif: async () => ({ enControle: false, titre: null, echeanceAt: null }),
  examenActif: async () => ({ enExamen: false, annaleId: null, titre: null, endsAt: null }),
  mesClasses: async () => [],
}))

vi.mock('@/lib/progression', () => ({
  getProgression: async () => null,
  getSerie: async () => null,
  getParcours: vi.fn(),
  getProgressionCours,
}))

vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  getCoursPublie: vi.fn(),
  marquerSectionCoursLue: vi.fn(async () => undefined),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    toString: () => 'JSESSIONID=abc',
    get: (nom: string) =>
      nom === 'brio_mode_chapitre' && modeCookie.valeur ? { value: modeCookie.valeur } : undefined,
  }),
}))

vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }))

const COURS_ID = '0b6f2c1e-8d4a-4c3b-9f1e-2a7d5c9e1b40'

const COURS = {
  schemaVersion: 1,
  id: 'contenu-du-cours',
  title: 'Les fractions, version M. Dubois',
  sections: [
    {
      id: 'decouvrir',
      title: 'Découvrir',
      kind: 'lesson',
      blocks: [{ id: 'b1', type: 'prose', text: 'Une fraction partage une unité.' }],
    },
  ],
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const { getCoursPublie } = await import('@/lib/api')
  vi.mocked(getCoursPublie).mockResolvedValue(COURS as never)
  const { default: Page } = await import('../page')
  const page = await Page({
    params: Promise.resolve({ coursId: COURS_ID }),
    searchParams: Promise.resolve(searchParams),
  })
  return render(page)
}

beforeEach(async () => {
  vi.resetModules()
  modeCookie.valeur = undefined
  getProgressionCours.mockReset()
  getProgressionCours.mockResolvedValue({
    coursId: COURS_ID,
    pourcentage: 50,
    termine: false,
    sectionsLues: 1,
    sectionsTotal: 2,
  })
  const { MODE_COOKIE } = await import('@/lib/diapos')
  expect(MODE_COOKIE).toBe('brio_mode_chapitre')
  window.scrollTo = vi.fn()
  window.history.replaceState(null, '', `/cours/${COURS_ID}`)
})

afterEach(async () => {
  await act(async () => {})
})

describe('CoursPage — progression and interactive mode (ADR 0050 §7)', () => {
  it('opens in the interactive mode, like a chapter, with no cookie', async () => {
    const { container } = await renderPage()
    expect(container.querySelector('[data-chapitre-mode="interactif"]')).not.toBeNull()
  })

  it('shows the course gauge in reading mode, from the course progression', async () => {
    modeCookie.valeur = 'lecture'
    const { container } = await renderPage()
    expect(container.querySelector('[data-chapitre-mode="lecture"]')).not.toBeNull()

    const jauge = await screen.findByRole('progressbar', { name: 'Progression du cours : 50 %' })
    expect(jauge.getAttribute('aria-valuenow')).toBe('50')
    expect(getProgressionCours).toHaveBeenCalledWith(COURS_ID)
  })

  it('draws no gauge when progression has none for the student', async () => {
    modeCookie.valeur = 'lecture'
    getProgressionCours.mockResolvedValue(null)
    await renderPage()
    await waitFor(() => expect(getProgressionCours).toHaveBeenCalled())
    expect(screen.queryByRole('progressbar', { name: /Progression du cours/ })).toBeNull()
  })

  it('ends on the course: no next one, back to the courses of the class', async () => {
    const { container } = await renderPage({ diapo: 'fin' })
    const fin = container.querySelector<HTMLElement>('[data-diapo="fin"]')!
    expect(within(fin).getByRole('heading', { name: 'Fin du cours' })).toBeTruthy()
    expect(
      within(fin).getByRole('link', { name: 'Revenir aux cours de ta classe' }).getAttribute('href')
    ).toBe('/ma-classe/cours')
    expect(within(fin).queryByRole('link', { name: /suivant/i })).toBeNull()
  })
})
