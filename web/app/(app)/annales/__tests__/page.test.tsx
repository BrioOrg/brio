import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Page /annales (#395, PL-5) : depuis que les annales ont leur entrée dans la navigation
// principale, le fil d'Ariane ne passe plus par Explorer (critère 5), et le sous-titre ne promet
// plus de « vrais sujets » ni de « compétence précise » (critère 8, spec U5 §2.1).

vi.mock('next/navigation', () => ({
  usePathname: () => '/annales',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))

function reponse(status: number, corps?: unknown) {
  return new Response(corps === undefined ? null : JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function rendre() {
  // Liste d'annales vide : la page n'a besoin d'aucun sujet pour son en-tête. Le reste (session,
  // compétences réservées aux enseignants) répond 401, comme pour un visiteur.
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(String(url).endsWith('/api/annales') ? reponse(200, []) : reponse(401))
    )
  )
  const { default: AnnalesPage } = await import('../page')
  render(<AnnalesPage />)
  // La liste est chargée côté client : on juge la page une fois le chargement terminé.
  await waitFor(() => expect(screen.queryByText(/Chargement/)).not.toBeInTheDocument())
}

describe('AnnalesPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('titles the page « Annales »', async () => {
    await rendre()
    expect(screen.getByRole('heading', { level: 1, name: 'Annales' })).toBeInTheDocument()
  })

  // critère 5 : le fil d'Ariane est la seule section « Annales », sans miette « Explorer ».
  it('shows a breadcrumb made of « Annales » alone, current and not a link', async () => {
    await rendre()
    const fil = screen.getByRole('navigation', { name: "Fil d'ariane" })
    const miettes = within(fil).getAllByRole('listitem')
    expect(miettes).toHaveLength(1)
    expect(miettes[0]).toHaveTextContent(/^Annales$/)
    expect(within(fil).getByText('Annales')).toHaveAttribute('aria-current', 'page')
    expect(within(fil).queryByRole('link')).not.toBeInTheDocument()
    expect(within(fil).queryByText('Explorer')).not.toBeInTheDocument()
  })

  // critère 8 : chaque fragment est rendu vrai par la page (spec U5 §2.1).
  it('says what the page lets the student do', async () => {
    await rendre()
    expect(
      screen.getByText('Choisis un sujet, puis entraîne-toi à ton rythme ou en mode examen.')
    ).toBeInTheDocument()
  })

  it('promises neither real exam papers nor a precise skill', async () => {
    await rendre()
    expect(document.body).not.toHaveTextContent(/vrais sujets/i)
    expect(document.body).not.toHaveTextContent(/compétence précise/i)
  })
})
