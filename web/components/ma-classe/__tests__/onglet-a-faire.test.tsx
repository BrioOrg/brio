import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// PL-6a (#398), C13 et décision humaine : « Les cours de ta classe » dans l'onglet « À faire »,
// entre « À faire » et « Terminés », plafonné à 3 avec « Voir tous les cours du prof ».

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
vi.mock('next/navigation', () => ({ usePathname: () => '/ma-classe' }))
vi.mock('@/components/deposer-copie', () => ({ DeposerCopie: () => null }))

import { EspaceClasse } from '../espace-classe'
import { OngletAFaire } from '../onglets'

const classe4eB = {
  id: 'c1',
  libelle: '4e B',
  niveauCode: '4e',
  etablissementNom: 'Collège Jean Moulin',
  anneeScolaire: '2026-2027',
  nomAffiche: 'Inès',
}
const classe3eA = { ...classe4eB, id: 'c2', libelle: '3e A', niveauCode: '3e' }

const catalogue = [
  {
    niveauCode: '4e',
    niveauLibelle: '4e',
    matieres: [{ matiereCode: 'mathematiques', matiereLibelle: 'Mathématiques', chapitres: [] }],
  },
]

const cours = (id: string, titre: string, classeIds: string[]) => ({
  id,
  titre,
  niveauCode: '4e',
  matiereCode: 'mathematiques',
  enseignant: 'M. Dubois',
  publieAt: '2026-10-05T10:00:00Z',
  classeIds,
})

const devoir = (id: string, titre: string, sur: Record<string, unknown> = {}) => ({
  id,
  classeId: 'c1',
  titre,
  echeanceAt: '2026-10-03T18:00:00Z',
  nombreExercices: 1,
  statutRendu: 'non_commence',
  corrige: false,
  sourceType: 'chapitre',
  sourceRef: 'x',
  ...sur,
})

const Onglet = OngletAFaire

function afficher(coursDeLaClasse: ReturnType<typeof cours>[]) {
  return render(
    <EspaceClasse>
      <Onglet cheminsChapitres={{}} cours={coursDeLaClasse} catalogue={catalogue} />
    </EspaceClasse>
  )
}

const region = () => screen.queryByRole('region', { name: 'Les cours de ta classe' })

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.mesClasses.mockResolvedValue([classe4eB])
})

describe('OngletAFaire — Les cours de ta classe', () => {
  // C13
  it('C13 : le bloc vient après « À faire » et avant « Terminés », ses cartes ouvrent /cours/{id}', async () => {
    api.listerMesDevoirs.mockResolvedValue([
      devoir('d1', 'DM à faire'),
      devoir('d2', 'DM fini', { statutRendu: 'rendu' }),
    ])
    afficher([cours('k1', 'Les angles', ['c1']), cours('k2', 'Le cercle', ['c1'])])

    expect(await screen.findByText('DM à faire')).toBeInTheDocument()
    const bloc = (await screen.findByRole('region', { name: 'Les cours de ta classe' }))!
    const aFaire = screen.getByRole('heading', { name: 'À faire' })
    const termines = screen.getByRole('heading', { name: 'Terminés' })
    expect(aFaire.compareDocumentPosition(bloc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bloc.compareDocumentPosition(termines) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      within(bloc)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'))
    ).toEqual(['/cours/k1', '/cours/k2'])
  })

  it('le bloc suit la classe choisie : changer de classe change les cours', async () => {
    const user = userEvent.setup()
    api.mesClasses.mockResolvedValue([classe4eB, classe3eA])
    api.listerMesDevoirs.mockResolvedValue([])
    afficher([cours('k1', 'Cours de 4e B', ['c1']), cours('k2', 'Cours de 3e A', ['c2'])])

    expect(await screen.findByText('Cours de 4e B')).toBeInTheDocument()
    expect(screen.queryByText('Cours de 3e A')).toBeNull()

    await user.selectOptions(screen.getByLabelText('Classe'), 'c2')

    expect(await screen.findByText('Cours de 3e A')).toBeInTheDocument()
    expect(screen.queryByText('Cours de 4e B')).toBeNull()
  })

  // décision humaine : plafond 3 + lien
  it('4 cours pour la classe : 3 cartes (les premiers reçus) et « Voir tous les cours du prof »', async () => {
    api.listerMesDevoirs.mockResolvedValue([])
    afficher([
      cours('k1', 'Premier', ['c1']),
      cours('k2', 'Deuxième', ['c1']),
      cours('k3', 'Troisième', ['c1']),
      cours('k4', 'Quatrième', ['c1']),
    ])

    const bloc = await screen.findByRole('region', { name: 'Les cours de ta classe' })
    expect(within(bloc).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByText('Quatrième')).toBeNull()
    expect(within(bloc).getByRole('link', { name: /Voir tous les cours du prof/ })).toHaveAttribute(
      'href',
      '/ma-classe/cours'
    )
  })

  it('3 cours exactement : pas de « Voir tous les cours du prof »', async () => {
    api.listerMesDevoirs.mockResolvedValue([])
    afficher([cours('k1', 'A', ['c1']), cours('k2', 'B', ['c1']), cours('k3', 'C', ['c1'])])

    await screen.findByRole('region', { name: 'Les cours de ta classe' })
    expect(screen.queryByRole('link', { name: /Voir tous les cours du prof/ })).toBeNull()
  })

  // État : le bloc n'apparaît qu'une fois la liste des devoirs réglée (pas de saut de page).
  it('« Chargement… » : pas de bloc tant que les devoirs se chargent, puis le bloc', async () => {
    let livrer: (d: unknown[]) => void = () => {}
    api.listerMesDevoirs.mockReturnValue(
      new Promise((resolve) => {
        livrer = resolve
      })
    )
    afficher([cours('k1', 'Les angles', ['c1'])])

    expect(await screen.findByText('Chargement…')).toBeInTheDocument()
    expect(region()).toBeNull()

    livrer([devoir('d1', 'DM à faire')])

    expect(await screen.findByRole('region', { name: 'Les cours de ta classe' })).toBeVisible()
    expect(screen.queryByText('Chargement…')).toBeNull()
  })

  it.each([
    ['devoirs vides', () => api.listerMesDevoirs.mockResolvedValue([])],
    ['devoirs illisibles', () => api.listerMesDevoirs.mockRejectedValue(new Error('500'))],
    ['élève déconnecté', () => api.listerMesDevoirs.mockResolvedValue(null)],
  ])(
    'le bloc reste affiché quand la liste des devoirs est vide ou en échec (%s)',
    async (_n, p) => {
      p()
      afficher([cours('k1', 'Les angles', ['c1'])])

      expect(await screen.findByRole('region', { name: 'Les cours de ta classe' })).toBeVisible()
      expect(screen.getByText('Les angles')).toBeInTheDocument()
    }
  )

  // V1 (tour 2) : le bloc garde son espace sous ce qui le précède, et n'en a pas en tête d'onglet.
  it.each([
    [
      'sous « À faire »',
      () => api.listerMesDevoirs.mockResolvedValue([devoir('d1', 'DM')]),
      'mt-6',
    ],
    [
      'sous « Aucun devoir pour l’instant »',
      () => api.listerMesDevoirs.mockResolvedValue([]),
      'mt-6',
    ],
    [
      'sous un message d’erreur',
      () => api.listerMesDevoirs.mockRejectedValue(new Error('500')),
      'mt-6',
    ],
    ['sous « Connecte-toi »', () => api.listerMesDevoirs.mockResolvedValue(null), 'mt-6'],
    [
      'en tête quand tous les devoirs sont terminés',
      () =>
        api.listerMesDevoirs.mockResolvedValue([devoir('d2', 'DM fini', { statutRendu: 'rendu' })]),
      '',
    ],
  ])('espacement du bloc %s', async (_n, p, attendu) => {
    p()
    afficher([cours('k1', 'Les angles', ['c1'])])

    const bloc = await screen.findByRole('region', { name: 'Les cours de ta classe' })
    expect(bloc.parentElement?.className ?? '').toBe(attendu)
  })

  // garde : rien d'inventé quand il n'y a rien à montrer
  it('aucun cours pour la classe choisie : pas de bloc, les devoirs restent affichés', async () => {
    api.listerMesDevoirs.mockResolvedValue([devoir('d1', 'DM à faire')])
    afficher([cours('k1', 'Cours d’une autre classe', ['c2'])])

    expect(await screen.findByText('DM à faire')).toBeInTheDocument()
    expect(region()).toBeNull()
  })
})
