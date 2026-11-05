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

type Donnees = {
  moi?: unknown
  classes?: unknown
  devoirs?: unknown
  reprendre?: unknown
  maitrises?: unknown
  libelles?: Map<string, string>
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
  vi.mocked(getCatalogue).mockResolvedValue([
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
  ])
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

  it('montre les 3 prochains devoirs, qui renvoient vers Ma classe', async () => {
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
    expect(liens[0]).toHaveAttribute('href', '/ma-classe')
    expect(liens[0]).toHaveTextContent('À rendre le 1 novembre')
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

  it('montre la compétence à revoir, qui renvoie vers Explorer', async () => {
    await rendre({
      maitrises: [
        {
          competenceCode: 'c4.x',
          niveau: 1,
          echantillon: 5,
          dernierTravail: new Date().toISOString(),
        },
      ],
      libelles: new Map([['c4.x', 'Calculer avec des fractions']]),
    })
    expect(screen.getByRole('heading', { name: 'À revoir' })).toBeVisible()
    expect(screen.getByRole('link', { name: /Calculer avec des fractions/ })).toHaveAttribute(
      'href',
      '/explorer'
    )
    expect(screen.queryByText('c4.x')).not.toBeInTheDocument()
  })

  it('n’affiche que les blocs qui ont du contenu', async () => {
    await rendre({ reprendre: REPRENDRE })
    expect(screen.queryByRole('heading', { name: /Pour ta classe/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'À revoir' })).not.toBeInTheDocument()
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
