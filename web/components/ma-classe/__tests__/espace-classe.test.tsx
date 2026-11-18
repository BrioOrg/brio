import { render, screen, within } from '@testing-library/react'
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

  // critère 7 (#370): a course homework opens its course, like a chapter one opens its chapter.
  describe('a course homework', () => {
    const COURS_ID = '0b6f2c1e-8d4a-4c3b-9f1e-2a7d5c9e1b40'
    const AUTRE_COURS = '5c1d9e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f'

    it('links to its course, carrying the homework id', async () => {
      api.mesClasses.mockResolvedValue([classe4eB])
      api.listerMesDevoirs.mockResolvedValue([
        devoir('d1', 'Lire le cours', 'c1', { sourceType: 'cours', sourceRef: COURS_ID }),
      ])
      render(
        <EspaceClasse>
          <OngletAFaire cheminsChapitres={{}} />
        </EspaceClasse>
      )

      const carte = (await screen.findByText('Lire le cours')).closest('li')!
      expect(within(carte).getByRole('link', { name: 'Ouvrir le cours' })).toHaveAttribute(
        'href',
        `/cours/${COURS_ID}?devoir=d1`
      )
      expect(within(carte).queryByRole('link', { name: 'Ouvrir le chapitre' })).toBeNull()
    })

    it('links each homework to its own source, finished ones too', async () => {
      api.mesClasses.mockResolvedValue([classe4eB])
      api.listerMesDevoirs.mockResolvedValue([
        devoir('d1', 'Cours à lire', 'c1', { sourceType: 'cours', sourceRef: COURS_ID }),
        devoir('d2', 'Chapitre à revoir', 'c1', { sourceType: 'chapitre', sourceRef: 'fractions' }),
        devoir('d3', 'Cours déjà rendu', 'c1', {
          sourceType: 'cours',
          sourceRef: AUTRE_COURS,
          statutRendu: 'rendu',
        }),
        devoir('d4', 'Cours corrigé', 'c1', {
          sourceType: 'cours',
          sourceRef: COURS_ID,
          corrige: true,
        }),
      ])
      render(
        <EspaceClasse>
          <OngletAFaire cheminsChapitres={{ fractions: '/4e/mathematiques/fractions' }} />
        </EspaceClasse>
      )

      const lien = async (titre: string, nom: string) =>
        within((await screen.findByText(titre)).closest('li')!).getByRole('link', { name: nom })
      expect(await lien('Cours à lire', 'Ouvrir le cours')).toHaveAttribute(
        'href',
        `/cours/${COURS_ID}?devoir=d1`
      )
      expect(await lien('Chapitre à revoir', 'Ouvrir le chapitre')).toHaveAttribute(
        'href',
        '/4e/mathematiques/fractions?devoir=d2'
      )
      // Terminés: the course stays one click away, as a finished chapter homework's does.
      expect(screen.getByRole('heading', { name: 'Terminés' })).toBeInTheDocument()
      expect(await lien('Cours déjà rendu', 'Ouvrir le cours')).toHaveAttribute(
        'href',
        `/cours/${AUTRE_COURS}?devoir=d3`
      )
      expect(await lien('Cours corrigé', 'Ouvrir le cours')).toHaveAttribute(
        'href',
        `/cours/${COURS_ID}?devoir=d4`
      )
    })

    it('offers no link when the source cannot be placed', async () => {
      api.mesClasses.mockResolvedValue([classe4eB])
      api.listerMesDevoirs.mockResolvedValue([
        devoir('d1', 'Type inconnu', 'c1', { sourceType: 'controle', sourceRef: COURS_ID }),
        devoir('d2', 'Chapitre hors catalogue', 'c1', {
          sourceType: 'chapitre',
          sourceRef: 'inconnu',
        }),
      ])
      render(
        <EspaceClasse>
          <OngletAFaire cheminsChapitres={{ fractions: '/4e/mathematiques/fractions' }} />
        </EspaceClasse>
      )

      expect(await screen.findByText('Type inconnu')).toBeInTheDocument()
      expect(screen.getByText('Chapitre hors catalogue')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^Ouvrir le/ })).toBeNull()
    })
  })
})
