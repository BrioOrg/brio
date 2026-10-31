import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  mesClasses: vi.fn(),
  listerMesDevoirs: vi.fn(),
  listerSalons: vi.fn(),
  messagesDuSalon: vi.fn(),
  publierDansSalon: vi.fn(),
  signalerMessageSalon: vi.fn(),
}))

vi.mock('@brio/api-client', () => ({
  ...api,
  MessagerieError: class MessagerieError extends Error {},
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/ma-classe/cours' }))
vi.mock('@/components/deposer-copie', () => ({ DeposerCopie: () => null }))

import { EspaceClasse } from '../espace-classe'
import { OngletAFaire, OngletCours } from '../onglets'

const classe4eB = {
  id: 'c1',
  libelle: '4e B',
  niveauCode: '4e',
  etablissementNom: 'Collège Jean Moulin',
  anneeScolaire: '2026-2027',
  nomAffiche: 'Inès',
}
const classe3eA = { ...classe4eB, id: 'c2', libelle: '3e A', nomAffiche: 'Inès M.' }

const cours = (id: string, titre: string, classeIds: string[]) => ({
  id,
  titre,
  niveauCode: '4e',
  matiereCode: 'mathematiques',
  enseignant: null,
  publieAt: '2026-09-28T10:00:00Z',
  classeIds,
})

const devoir = (
  id: string,
  titre: string,
  classeId: string,
  sur: Record<string, unknown> = {}
) => ({
  id,
  classeId,
  titre,
  echeanceAt: '2026-10-03T18:00:00Z',
  nombreExercices: 1,
  statutRendu: 'non_commence',
  corrige: false,
  sourceType: 'cours',
  sourceRef: 'x',
  ...sur,
})

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
})

describe('EspaceClasse', () => {
  it('sends a student in no class to /rejoindre, without the tabs', async () => {
    api.mesClasses.mockResolvedValue([])
    render(
      <EspaceClasse>
        <p>contenu</p>
      </EspaceClasse>
    )

    expect(await screen.findByText('Rejoins ta classe avec un code')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rejoindre ma classe' })).toHaveAttribute(
      'href',
      '/rejoindre'
    )
    expect(screen.queryByText('contenu')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Espace de la classe' })).toBeNull()
  })

  it('shows the class, the name the student goes by and the current tab', async () => {
    api.mesClasses.mockResolvedValue([classe4eB])
    render(
      <EspaceClasse>
        <p>contenu</p>
      </EspaceClasse>
    )

    expect(
      await screen.findByRole('heading', { name: '4e B · Collège Jean Moulin · 2026-2027' })
    ).toBeInTheDocument()
    expect(screen.getByText('Inès')).toBeInTheDocument()
    expect(screen.queryByLabelText('Classe')).toBeNull()
    expect(screen.getByRole('link', { name: 'À faire' })).toHaveAttribute('href', '/ma-classe')
    expect(screen.getByRole('link', { name: 'Cours du prof' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', { name: 'Salon' })).toHaveAttribute('href', '/ma-classe/salon')
  })

  it('changing class changes the courses of the open tab', async () => {
    const user = userEvent.setup()
    api.mesClasses.mockResolvedValue([classe4eB, classe3eA])
    render(
      <EspaceClasse>
        <OngletCours
          catalogue={[]}
          cours={[cours('a', 'Cours de 4e', ['c1']), cours('b', 'Cours de 3e', ['c2'])]}
        />
      </EspaceClasse>
    )

    expect(await screen.findByText('Cours de 4e')).toBeInTheDocument()
    expect(screen.queryByText('Cours de 3e')).toBeNull()

    await user.selectOptions(screen.getByLabelText('Classe'), 'c2')

    expect(await screen.findByText('Cours de 3e')).toBeInTheDocument()
    expect(screen.queryByText('Cours de 4e')).toBeNull()
    expect(screen.getByText('Inès M.')).toBeInTheDocument()
  })

  it('changing class changes the homework, which link to their chapter when it has one', async () => {
    const user = userEvent.setup()
    api.mesClasses.mockResolvedValue([classe4eB, classe3eA])
    api.listerMesDevoirs.mockResolvedValue([
      devoir('d1', 'DM de 4e', 'c1', { sourceType: 'chapitre', sourceRef: 'fractions' }),
      devoir('d2', 'DM de 3e', 'c2', { corrige: true, statutRendu: 'rendu' }),
    ])
    render(
      <EspaceClasse>
        <OngletAFaire cheminsChapitres={{ fractions: '/4e/mathematiques/fractions' }} />
      </EspaceClasse>
    )

    expect(await screen.findByText('DM de 4e')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir le chapitre' })).toHaveAttribute(
      'href',
      '/4e/mathematiques/fractions?devoir=d1'
    )
    expect(screen.queryByText('DM de 3e')).toBeNull()

    await user.selectOptions(screen.getByLabelText('Classe'), 'c2')

    expect(await screen.findByText('DM de 3e')).toBeInTheDocument()
    expect(screen.getByText('Corrigé')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ouvrir le chapitre' })).toBeNull()
  })
})
