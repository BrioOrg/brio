import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: () => 'JSESSIONID=abc' })),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
  usePathname: () => '/',
}))
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }))
vi.mock('@/lib/api', () => ({ getCatalogue: vi.fn() }))
vi.mock('@/lib/revoir', async (original) => ({
  ...(await original<typeof import('@/lib/revoir')>()),
  lireLecon: vi.fn(),
}))
vi.mock('@/lib/espace-eleve', async (original) => ({
  ...(await original<typeof import('@/lib/espace-eleve')>()),
  lireMoi: vi.fn(),
  lireClasses: vi.fn(),
  lireDevoirs: vi.fn(),
  lireReprendre: vi.fn(),
  lireMaitrise: vi.fn(),
  lireLibelles: vi.fn(),
}))

const ELEVE = {
  id: 'e',
  role: 'eleve',
  statut: 'actif',
  nom: null,
  email: null,
  pseudonyme: 'Renard-Indigo',
  niveau: '5e',
}
const CLASSE_B = { id: 'b', libelle: '5e B', niveauCode: '5e' }
const devoir = (id: string, echeanceAt: string, classeId = 'b') => ({
  id,
  classeId,
  titre: `Devoir ${id}`,
  sourceType: 'chapitre',
  sourceRef: 's',
  echeanceAt,
  nombreExercices: 1,
  statutRendu: 'non_commence',
  corrige: false,
})
const REPRENDRE = {
  chapitreId: 'les-fractions',
  titre: 'Les fractions',
  niveauCode: '5e',
  matiereCode: 'mathematiques',
  sectionsLues: 2,
  sectionsTotal: 5,
  derniereActivite: '2026-10-30T10:00:00Z',
}

const LECON = {
  niveauCode: '5e',
  matiereCode: 'mathematiques',
  chapitreId: 'les-fractions',
  sectionId: 'calculer-avec-des-fractions',
  sectionTitre: 'Calculer avec des fractions',
}
const MAITRISE_A_REVOIR = {
  competenceCode: 'c4.x',
  niveau: 1,
  echantillon: 5,
  dernierTravail: new Date().toISOString(),
}

const CATALOGUE = [
  {
    niveauCode: '5e',
    niveauLibelle: 'Cinquième',
    matieres: [
      {
        matiereCode: 'mathematiques',
        matiereLibelle: 'Mathématiques',
        chapitres: [{ slug: 'a', titre: 'A', dureeEstimeeMinutes: 10, ordre: 0 }],
      },
    ],
  },
]

// A homework on a teacher course (#370): the kind the teacher interface creates.
const COURS_ID = '0b6f2c1e-8d4a-4c3b-9f1e-2a7d5c9e1b40'
const devoirCours = (id: string, echeanceAt: string, coursId = COURS_ID) => ({
  ...devoir(id, echeanceAt),
  sourceType: 'cours',
  sourceRef: coursId,
})
const devoirChapitre = (id: string, echeanceAt: string, slug: string) => ({
  ...devoir(id, echeanceAt),
  sourceRef: slug,
})

type Donnees = {
  moi?: unknown
  classes?: unknown
  devoirs?: unknown
  reprendre?: unknown
  maitrises?: unknown
  libelles?: Map<string, string>
  lecon?: unknown
  /** The catalogue, or an Error when it fails to load. */
  catalogue?: unknown
}

async function afficher(donnees: Donnees = {}) {
  const espace = await import('@/lib/espace-eleve')
  const { getCatalogue } = await import('@/lib/api')
  const set = (fn: unknown, value: unknown) =>
    (fn as ReturnType<typeof vi.fn>).mockResolvedValue(value)
  set(espace.lireMoi, 'moi' in donnees ? donnees.moi : ELEVE)
  set(espace.lireClasses, donnees.classes ?? [CLASSE_B])
  set(espace.lireDevoirs, donnees.devoirs ?? [])
  set(espace.lireReprendre, donnees.reprendre ?? null)
  set(espace.lireMaitrise, donnees.maitrises ?? [])
  set(espace.lireLibelles, donnees.libelles ?? new Map())
  const { lireLecon } = await import('@/lib/revoir')
  vi.mocked(lireLecon).mockReset()
  set(lireLecon, 'lecon' in donnees ? donnees.lecon : LECON)
  // The mock outlives vi.resetModules(): start each page from no recorded call.
  vi.mocked(getCatalogue).mockReset()
  const catalogue = donnees.catalogue ?? CATALOGUE
  if (catalogue instanceof Error) vi.mocked(getCatalogue).mockRejectedValue(catalogue)
  else vi.mocked(getCatalogue).mockResolvedValue(catalogue as never)
  const { default: Page } = await import('../page')
  return Page()
}

async function rendre(donnees: Donnees = {}) {
  render(await afficher(donnees))
}

describe('AccueilPage', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('renvoie vers Explorer un compte qui n’est pas élève', async () => {
    await expect(afficher({ moi: { ...ELEVE, role: 'enseignant' } })).rejects.toThrow(
      'NEXT_REDIRECT /explorer'
    )
  })

  it('renvoie vers Explorer quand le compte est illisible', async () => {
    await expect(afficher({ moi: null })).rejects.toThrow('NEXT_REDIRECT /explorer')
  })

  it('salue l’élève par son pseudonyme', async () => {
    await rendre({ reprendre: REPRENDRE })
    expect(screen.getByRole('heading', { level: 1, name: 'Salut Renard-Indigo' })).toBeVisible()
  })

  it('dit simplement « Salut » sans pseudonyme', async () => {
    await rendre({ moi: { ...ELEVE, pseudonyme: null }, reprendre: REPRENDRE })
    expect(screen.getByRole('heading', { level: 1, name: 'Salut' })).toBeVisible()
  })

  // critère 4: their chapter ('s') is not in the catalogue, so each one falls back to Ma classe
  it('montre les 3 prochains devoirs ; ceux dont le chapitre est absent du catalogue renvoient vers Ma classe', async () => {
    await rendre({
      devoirs: [
        devoir('4', '2026-11-04T16:00:00Z'),
        devoir('1', '2026-11-01T16:00:00Z'),
        devoir('2', '2026-11-02T16:00:00Z'),
        devoir('3', '2026-11-03T16:00:00Z'),
      ],
    })
    expect(screen.getByRole('heading', { name: 'Pour ta classe · 5e B' })).toBeVisible()
    const liens = screen.getAllByRole('link', { name: /Devoir/ })
    expect(liens.map((l) => l.textContent)).toEqual([
      expect.stringContaining('Devoir 1'),
      expect.stringContaining('Devoir 2'),
      expect.stringContaining('Devoir 3'),
    ])
    expect(liens.map((l) => l.getAttribute('href'))).toEqual([
      '/ma-classe',
      '/ma-classe',
      '/ma-classe',
    ])
    expect(liens[0]).toHaveTextContent('À rendre le 1 novembre')
  })

  describe('chaque carte ouvre le contenu de son devoir (#370)', () => {
    // critère 1
    it('ouvre un devoir chapitre sur son chapitre, trouvé au catalogue', async () => {
      await rendre({ devoirs: [devoirChapitre('d1', '2026-11-01T16:00:00Z', 'a')] })
      expect(screen.getByRole('link', { name: /Devoir d1/ })).toHaveAttribute(
        'href',
        '/5e/mathematiques/a?devoir=d1'
      )
    })

    // critère 2
    it('ouvre un devoir cours sur son cours', async () => {
      await rendre({ devoirs: [devoirCours('d1', '2026-11-01T16:00:00Z')] })
      expect(screen.getByRole('link', { name: /Devoir d1/ })).toHaveAttribute(
        'href',
        `/cours/${COURS_ID}?devoir=d1`
      )
    })

    // critère 3
    it('mène chaque carte à son propre devoir, par échéance croissante', async () => {
      const autreCours = '5c1d9e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f'
      await rendre({
        devoirs: [
          devoirCours('c2', '2026-11-03T16:00:00Z', autreCours),
          devoirChapitre('ch', '2026-11-02T16:00:00Z', 'a'),
          devoirCours('c1', '2026-11-01T16:00:00Z'),
          devoirCours('tard', '2026-11-09T16:00:00Z'),
        ],
      })
      const liens = screen.getAllByRole('link', { name: /Devoir/ })
      expect(liens.map((l) => l.textContent)).toEqual([
        expect.stringContaining('Devoir c1'),
        expect.stringContaining('Devoir ch'),
        expect.stringContaining('Devoir c2'),
      ])
      expect(liens.map((l) => l.getAttribute('href'))).toEqual([
        `/cours/${COURS_ID}?devoir=c1`,
        '/5e/mathematiques/a?devoir=ch',
        `/cours/${autreCours}?devoir=c2`,
      ])
    })

    // critère 9: a card says only what the API returns — its title and its due date
    it('ne montre sur la carte que le titre et l’échéance', async () => {
      await rendre({ devoirs: [devoirCours('d1', '2026-11-01T16:00:00Z')] })
      expect(screen.getByRole('link', { name: /Devoir d1/ }).textContent).toMatch(
        /^Devoir d1\s*À rendre le 1 novembre$/
      )
    })

    // critère 4
    it('renvoie vers Ma classe un devoir au type de source inconnu', async () => {
      await rendre({
        devoirs: [{ ...devoir('d1', '2026-11-01T16:00:00Z'), sourceType: 'controle' }],
      })
      expect(screen.getByRole('link', { name: /Devoir d1/ })).toHaveAttribute('href', '/ma-classe')
    })

    // critère 4
    it('renvoie vers Ma classe un devoir chapitre quand le catalogue est indisponible', async () => {
      await rendre({
        devoirs: [
          devoirChapitre('ch', '2026-11-01T16:00:00Z', 'a'),
          devoirCours('c1', '2026-11-02T16:00:00Z'),
        ],
        catalogue: new Error('Catalogue unavailable'),
      })
      expect(screen.getByRole('link', { name: /Devoir ch/ })).toHaveAttribute('href', '/ma-classe')
      expect(screen.getByRole('link', { name: /Devoir c1/ })).toHaveAttribute(
        'href',
        `/cours/${COURS_ID}?devoir=c1`
      )
    })

    it('ne charge pas le catalogue quand les cartes ne sont que des cours', async () => {
      await rendre({
        devoirs: [
          devoirCours('c1', '2026-11-01T16:00:00Z'),
          devoirCours('c2', '2026-11-02T16:00:00Z'),
          devoirCours('c3', '2026-11-03T16:00:00Z'),
          // A fourth homework, due later, shows no card: it costs no catalogue either.
          devoirChapitre('ch', '2026-11-09T16:00:00Z', 'a'),
        ],
      })
      expect(screen.getAllByRole('link', { name: /Devoir c/ })).toHaveLength(3)
      const { getCatalogue } = await import('@/lib/api')
      expect(getCatalogue).not.toHaveBeenCalled()
    })

    it('charge le catalogue dès qu’une carte est un chapitre', async () => {
      await rendre({
        devoirs: [
          devoirCours('c1', '2026-11-01T16:00:00Z'),
          devoirChapitre('ch', '2026-11-02T16:00:00Z', 'a'),
        ],
      })
      const { getCatalogue } = await import('@/lib/api')
      expect(getCatalogue).toHaveBeenCalled()
    })

    // U6: the catalogue is asked for as soon as the cards are known, alongside the other reads,
    // not once they have all come back.
    it('demande le catalogue sans attendre la fin des autres lectures', async () => {
      let livrerReprendre: (valeur: unknown) => void = () => {}
      let livrerMaitrises: (valeur: unknown) => void = () => {}
      // Clear the calls left by the previous test now: `afficher` only resets the mock after its
      // own `await import`, too late for the first `waitFor` below (V3, tour 3).
      const { getCatalogue } = await import('@/lib/api')
      vi.mocked(getCatalogue).mockClear()
      const enCours = afficher({
        devoirs: [devoirChapitre('ch', '2026-11-01T16:00:00Z', 'a')],
        // Still pending until the catalogue has been asked for.
        reprendre: new Promise((resolve) => {
          livrerReprendre = resolve
        }),
        maitrises: new Promise((resolve) => {
          livrerMaitrises = resolve
        }),
      })

      await vi.waitFor(() => expect(getCatalogue).toHaveBeenCalled())
      livrerReprendre(null)
      livrerMaitrises([])
      render(await enCours)

      expect(screen.getByRole('link', { name: /Devoir ch/ })).toHaveAttribute(
        'href',
        '/5e/mathematiques/a?devoir=ch'
      )
    })
  })

  // critère 6
  it('ne rend pas « Pour ta classe » quand tous les devoirs sont rendus ou corrigés', async () => {
    await rendre({
      devoirs: [
        { ...devoirCours('rendu', '2026-11-01T16:00:00Z'), statutRendu: 'rendu' },
        { ...devoirChapitre('corrige', '2026-11-02T16:00:00Z', 'a'), corrige: true },
      ],
      reprendre: REPRENDRE,
    })
    expect(screen.queryByRole('heading', { name: /Pour t(a|es) classe/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Devoir/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continuer' })).toHaveAttribute(
      'href',
      '/5e/mathematiques/les-fractions'
    )
  })

  it('nomme la classe de chaque devoir quand il y en a plusieurs', async () => {
    await rendre({
      classes: [CLASSE_B, { id: 'latin', libelle: 'Latin 5e', niveauCode: '5e' }],
      devoirs: [devoir('1', '2026-11-01T16:00:00Z'), devoir('2', '2026-11-02T16:00:00Z', 'latin')],
    })
    expect(screen.getByRole('heading', { name: 'Pour tes classes' })).toBeVisible()
    expect(screen.getByRole('link', { name: /Devoir 2/ })).toHaveTextContent('Latin 5e')
  })

  it('propose de continuer le chapitre en cours', async () => {
    await rendre({ reprendre: REPRENDRE })
    expect(screen.getByText('Les fractions')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByRole('link', { name: 'Continuer' })).toHaveAttribute(
      'href',
      '/5e/mathematiques/les-fractions'
    )
    expect(screen.queryByText('Choisis par où commencer')).not.toBeInTheDocument()
  })

  it('montre la compétence à revoir, qui renvoie vers la leçon', async () => {
    await rendre({
      maitrises: [MAITRISE_A_REVOIR],
      libelles: new Map([['c4.x', 'Calculer avec des fractions']]),
    })
    const { lireLecon } = await import('@/lib/revoir')
    expect(lireLecon).toHaveBeenCalledWith('c4.x', '5e', expect.any(String))
    expect(screen.getByRole('heading', { name: 'À revoir' })).toBeVisible()
    const lien = screen.getByRole('link', { name: /Calculer avec des fractions/ })
    expect(lien).toHaveAttribute(
      'href',
      '/5e/mathematiques/les-fractions?diapo=calculer-avec-des-fractions'
    )
    expect(lien).not.toHaveAttribute('href', '/explorer')
    expect(screen.queryByText('c4.x')).not.toBeInTheDocument()
  })

  it('masque le bloc À revoir quand la compétence n’est rattachable à aucune leçon', async () => {
    await rendre({
      maitrises: [MAITRISE_A_REVOIR],
      libelles: new Map([['c4.x', 'Calculer avec des fractions']]),
      lecon: null,
    })
    expect(screen.queryByRole('heading', { name: 'À revoir' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Calculer avec des fractions/ })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Choisis par où commencer' })).toBeVisible()
  })

  it('n’affiche que les blocs qui ont du contenu', async () => {
    await rendre({ reprendre: REPRENDRE })
    expect(screen.queryByRole('heading', { name: /Pour ta classe/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'À revoir' })).not.toBeInTheDocument()
    const { lireLecon } = await import('@/lib/revoir')
    expect(lireLecon).not.toHaveBeenCalled()
  })

  it('montre côte à côte un devoir et la compétence à revoir, chacun avec son lien', async () => {
    await rendre({
      devoirs: [devoirChapitre('ch', '2026-11-01T16:00:00Z', 'a')],
      maitrises: [MAITRISE_A_REVOIR],
      libelles: new Map([['c4.x', 'Calculer avec des fractions']]),
    })
    expect(screen.getByRole('heading', { name: 'Pour ta classe · 5e B' })).toBeVisible()
    expect(screen.getByRole('link', { name: /Devoir ch/ })).toHaveAttribute(
      'href',
      '/5e/mathematiques/a?devoir=ch'
    )
    expect(screen.getByRole('heading', { name: 'À revoir' })).toBeVisible()
    expect(screen.getByRole('link', { name: /Calculer avec des fractions/ })).toHaveAttribute(
      'href',
      '/5e/mathematiques/les-fractions?diapo=calculer-avec-des-fractions'
    )
    expect(screen.queryByText('Choisis par où commencer')).not.toBeInTheDocument()
    const { getCatalogue } = await import('@/lib/api')
    expect(getCatalogue).toHaveBeenCalledTimes(1)
  })

  it('ne propose pas la première connexion quand un devoir reste, même sans leçon à revoir', async () => {
    await rendre({
      devoirs: [devoirChapitre('ch', '2026-11-01T16:00:00Z', 'a')],
      maitrises: [MAITRISE_A_REVOIR],
      libelles: new Map([['c4.x', 'Calculer avec des fractions']]),
      lecon: null,
    })
    expect(screen.getByRole('link', { name: /Devoir ch/ })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'À revoir' })).not.toBeInTheDocument()
    expect(screen.queryByText('Choisis par où commencer')).not.toBeInTheDocument()
  })

  it('montre les matières du niveau à la première connexion', async () => {
    await rendre()
    expect(screen.getByRole('heading', { name: 'Choisis par où commencer' })).toBeVisible()
    expect(screen.getByRole('link', { name: /Mathématiques/ })).toHaveAttribute(
      'href',
      '/5e/mathematiques'
    )
  })

  it('renvoie vers Explorer à la première connexion si le niveau est inconnu', async () => {
    await rendre({ moi: { ...ELEVE, niveau: null } })
    expect(screen.getByRole('link', { name: /Tous les niveaux/ })).toHaveAttribute(
      'href',
      '/explorer'
    )
  })
})
