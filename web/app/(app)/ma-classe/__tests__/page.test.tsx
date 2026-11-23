import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// PL-6a (#398): /ma-classe lit les cours du prof côté serveur, avec la session relayée, en
// parallèle du catalogue ; un échec n'invente rien et ne casse pas la page.

const propsOnglet = vi.hoisted(() => [] as Record<string, unknown>[])
vi.mock('@/components/ma-classe/onglets', () => ({
  OngletAFaire: (props: Record<string, unknown>) => {
    propsOnglet.push(props)
    return null
  },
}))

vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  getCatalogue: vi.fn(),
  getCoursVisibles: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'JSESSIONID=abc', get: () => undefined }),
}))

const CATALOGUE = [
  {
    niveauCode: '5e',
    niveauLibelle: '5e',
    matieres: [
      {
        matiereCode: 'mathematiques',
        matiereLibelle: 'Mathématiques',
        chapitres: [{ slug: 'fractions', titre: 'Les fractions' }],
      },
    ],
  },
]

const COURS = [
  {
    id: 'k3',
    titre: 'Plus récent',
    niveauCode: '5e',
    matiereCode: 'mathematiques',
    enseignant: 'M. Dubois',
    publieAt: '2026-10-14T08:00:00Z',
    classeIds: ['c1'],
  },
  {
    id: 'k1',
    titre: 'Plus ancien',
    niveauCode: '5e',
    matiereCode: 'mathematiques',
    enseignant: null,
    publieAt: '2026-10-01T08:00:00Z',
    classeIds: ['c1'],
  },
]

async function charger() {
  const api = await import('@/lib/api')
  const { default: Page } = await import('../page')
  return { api, Page }
}

beforeEach(() => {
  vi.resetModules()
  propsOnglet.length = 0
})

describe('/ma-classe (page serveur)', () => {
  it('lit les cours avec le cookie relayé pendant que le catalogue est encore en attente', async () => {
    const { api, Page } = await charger()
    vi.mocked(api.getCatalogue).mockReturnValue(new Promise(() => {}) as never)
    vi.mocked(api.getCoursVisibles).mockResolvedValue(COURS as never)

    void Page()

    await vi.waitFor(() => expect(api.getCoursVisibles).toHaveBeenCalledWith('JSESSIONID=abc'))
  })

  it('transmet les cours tels quels, dans l’ordre reçu', async () => {
    const { api, Page } = await charger()
    vi.mocked(api.getCatalogue).mockResolvedValue(CATALOGUE as never)
    vi.mocked(api.getCoursVisibles).mockResolvedValue(COURS as never)

    render(await Page())

    expect(propsOnglet.at(-1)?.cours).toEqual(COURS)
    expect(propsOnglet.at(-1)?.cheminsChapitres).toEqual({
      fractions: '/5e/mathematiques/fractions',
    })
  })

  it('cours illisibles : la page se rend avec cours = [] et les chemins de chapitres intacts', async () => {
    const { api, Page } = await charger()
    vi.mocked(api.getCatalogue).mockResolvedValue(CATALOGUE as never)
    vi.mocked(api.getCoursVisibles).mockRejectedValue(new Error('401'))

    render(await Page())

    expect(propsOnglet.at(-1)?.cours).toEqual([])
    expect(propsOnglet.at(-1)?.cheminsChapitres).toEqual({
      fractions: '/5e/mathematiques/fractions',
    })
  })
})
