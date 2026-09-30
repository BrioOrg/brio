import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    ...actual,
    listerMesCours: vi.fn(),
    listerMesClasses: vi.fn(),
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

async function mockClasses() {
  const { listerMesClasses } = await import('@brio/api-client')
  return vi.mocked(listerMesClasses)
}

const CLASSE = { id: 'cl1', etablissementId: 'e1', libelle: '4e B', niveauCode: '4e' }

describe('MesCours', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    window.localStorage.clear()
    ;(await mockClasses()).mockResolvedValue([CLASSE])
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

  it('guide un enseignant sans classe vers la création de sa classe', async () => {
    ;(await mockCours()).mockResolvedValue([])
    ;(await mockClasses()).mockResolvedValue([])
    await renderMesCours()
    expect(await screen.findByText(/Commencez par créer votre classe/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Créer ma classe/ })).toHaveAttribute(
      'href',
      '/prof/classes'
    )
  })

  it('ne montre pas ce guide à un enseignant qui a une classe, ni si l’appel échoue', async () => {
    ;(await mockCours()).mockResolvedValue([])
    ;(await mockClasses()).mockRejectedValue(new Error('réseau'))
    await renderMesCours()
    expect(await screen.findByText(/Aucun cours pour l’instant/)).toBeInTheDocument()
    expect(screen.queryByText(/Commencez par créer votre classe/)).not.toBeInTheDocument()
  })
})
