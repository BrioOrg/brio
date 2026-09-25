import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    ...actual,
    listerMesCours: vi.fn(),
    creerCours: vi.fn(),
  }
})

async function renderMesCours() {
  const { MesCours } = await import('../prof/mes-cours')
  render(<MesCours />)
}

async function mockCours() {
  const { listerMesCours } = await import('@brio/api-client')
  return vi.mocked(listerMesCours)
}

describe('MesCours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('liste les cours renvoyés par le serveur', async () => {
    ;(await mockCours()).mockResolvedValue([
      {
        id: 'c1',
        titre: 'Pythagore',
        niveauCode: '3e',
        matiereCode: 'mathematiques',
        statut: 'publie',
        versionPubliee: 2,
      },
    ])
    await renderMesCours()
    expect(await screen.findByText('Pythagore')).toBeInTheDocument()
    expect(screen.getByText(/Publié · v2/)).toBeInTheDocument()
  })

  it('montre l’état vide quand l’enseignant n’a aucun cours', async () => {
    ;(await mockCours()).mockResolvedValue([])
    await renderMesCours()
    expect(await screen.findByText(/Aucun cours pour l’instant/)).toBeInTheDocument()
  })
})
