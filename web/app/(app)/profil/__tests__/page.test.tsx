import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: () => 'JSESSIONID=abc' })),
}))
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }))
vi.mock('@/lib/api', () => ({ getCatalogue: vi.fn() }))
vi.mock('@/lib/espace-eleve', () => ({
  lireMoi: vi.fn(),
  lireClasses: vi.fn(),
  lireProgression: vi.fn(),
  lireSerie: vi.fn(),
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

type Donnees = {
  moi?: unknown
  classes?: unknown
  progression?: unknown
  serie?: unknown
  maitrises?: unknown
  libelles?: Map<string, string>
}

async function rendre(donnees: Donnees = {}) {
  const espace = await import('@/lib/espace-eleve')
  const { getCatalogue } = await import('@/lib/api')
  const set = (fn: unknown, value: unknown) =>
    (fn as ReturnType<typeof vi.fn>).mockResolvedValue(value)
  set(espace.lireMoi, donnees.moi ?? ELEVE)
  set(espace.lireClasses, donnees.classes ?? [])
  set(espace.lireProgression, donnees.progression ?? null)
  set(espace.lireSerie, donnees.serie ?? null)
  set(espace.lireMaitrise, donnees.maitrises ?? [])
  set(espace.lireLibelles, donnees.libelles ?? new Map())
  vi.mocked(getCatalogue).mockResolvedValue([
    { niveauCode: '5e', niveauLibelle: 'Cinquième', matieres: [] },
  ])
  const { default: Page } = await import('../page')
  render(await Page())
}

const serie = (joursConsecutifs: number) => ({
  joursConsecutifs,
  gelsRestants: 1,
  actifAujourdhui: true,
})

describe('ProfilPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('montre le pseudonyme, le niveau et le nom dans chaque classe', async () => {
    await rendre({
      classes: [
        { id: 'b', libelle: '5e B', niveauCode: '5e', nomAffiche: 'Inès' },
        { id: 'l', libelle: 'Latin', niveauCode: '5e', nomAffiche: 'Inès D.' },
      ],
    })
    expect(screen.getByText('Renard-Indigo · Cinquième')).toBeVisible()
    expect(within(screen.getByText('Dans ta classe 5e B').parentElement!).getByText('Inès'))
    expect(within(screen.getByText('Dans ta classe Latin').parentElement!).getByText('Inès D.'))
    expect(screen.getByText('Les deux ne sont jamais affichés ensemble.')).toBeVisible()
  })

  it('montre l’XP et la série', async () => {
    await rendre({ progression: { xpTotal: 240, niveau: 1 }, serie: serie(3) })
    expect(screen.getByText('240 XP')).toBeVisible()
    expect(screen.getByText('Niveau 1')).toBeVisible()
    expect(screen.getByText('jours de suite')).toBeVisible()
  })

  it('n’affiche jamais une série à 0', async () => {
    await rendre({ progression: { xpTotal: 0, niveau: 0 }, serie: serie(0) })
    expect(screen.getByText('0 XP')).toBeVisible()
    expect(screen.queryByText(/de suite/)).not.toBeInTheDocument()
  })

  it('n’invente rien quand la progression est indisponible', async () => {
    await rendre()
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ta maîtrise' })).not.toBeInTheDocument()
  })

  it('montre la maîtrise par compétence, par son libellé', async () => {
    await rendre({
      maitrises: [
        { competenceCode: 'c.a', niveau: 3, echantillon: 6 },
        { competenceCode: 'c.b', niveau: null, echantillon: 1 },
        { competenceCode: 'c.sans-libelle', niveau: 2, echantillon: 6 },
      ],
      libelles: new Map([
        ['c.a', 'Calculer'],
        ['c.b', 'Démontrer'],
      ]),
    })
    expect(screen.getByRole('heading', { name: 'Ta maîtrise' })).toBeVisible()
    expect(screen.getByText('Calculer')).toBeVisible()
    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    expect(screen.getByText('En cours d’évaluation')).toBeVisible()
    expect(screen.queryByText(/c\.sans-libelle/)).not.toBeInTheDocument()
  })

  it('renvoie vers Paramètres', async () => {
    await rendre()
    expect(screen.getByRole('link', { name: /Thème/ })).toHaveAttribute('href', '/parametres')
  })

  it('ne montre à un enseignant que le lien vers Paramètres', async () => {
    await rendre({ moi: { ...ELEVE, role: 'enseignant', pseudonyme: null } })
    const espace = await import('@/lib/espace-eleve')
    expect(espace.lireProgression).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /Thème/ })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Qui tu es sur Brio' })).not.toBeInTheDocument()
  })
})
