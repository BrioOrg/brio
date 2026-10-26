import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The teacher-space role gate. It asks the backend who the caller is (forwarding the
// session cookie) and lets only ENSEIGNANT accounts through; everyone else is redirected.

const redirectMock = vi.fn((url: string) => {
  // Real next/navigation redirect throws to halt rendering — emulate that.
  throw new Error(`REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/prof/classes/c-1',
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: () => 'JSESSIONID=abc' })),
}))

function stubMoi(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response)
  )
}

describe('ProfLayout role gate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    redirectMock.mockClear()
  })

  it('renders children, the catalogue link and the logout button for an enseignant', async () => {
    stubMoi(
      new Response(
        JSON.stringify({ id: '1', role: 'enseignant', statut: 'actif', nom: 'P', email: 'p@t.fr' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    const { default: ProfLayout } = await import('../layout')

    render(await ProfLayout({ children: 'CONTENU' }))

    expect(redirectMock).not.toHaveBeenCalled()
    expect(screen.getByText('CONTENU')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir le catalogue' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
    // The burger menu (Paramètres) is there in the teacher space too (#282).
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
    // The role comes from the /api/moi answer the gate already fetched (#285): no other request.
    expect(screen.getByText('Compte enseignant')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('carries the teacher sections in a sidebar and a bottom bar (#286)', async () => {
    stubMoi(
      new Response(
        JSON.stringify({ id: '1', role: 'enseignant', statut: 'actif', nom: 'P', email: 'p@t.fr' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    const { default: ProfLayout } = await import('../layout')

    render(await ProfLayout({ children: 'CONTENU' }))

    // Both are in the page, one hidden by width (sm): the sidebar first, the bottom bar last.
    const navs = screen.getAllByRole('navigation', { name: "Navigation de l'espace enseignant" })
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      const liens = within(nav).getAllByRole('link')
      expect(liens.map((l) => l.textContent)).toEqual([
        'Mes cours',
        'Mes classes',
        'Devoirs',
        'Signalements',
        'Signalements du salon',
      ])
      expect(within(nav).getByRole('link', { name: 'Mes classes' })).toHaveAttribute(
        'aria-current',
        'page'
      )
      // No placeholder for a module that does not exist.
      expect(within(nav).queryByRole('button')).not.toBeInTheDocument()
    }
  })

  it('redirects a non-enseignant to the home page', async () => {
    stubMoi(
      new Response(
        JSON.stringify({ id: '2', role: 'eleve', statut: 'actif', nom: null, email: null }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    const { default: ProfLayout } = await import('../layout')

    await expect(ProfLayout({ children: 'CONTENU' })).rejects.toThrow('REDIRECT:/')
  })

  it('redirects to login when there is no live session', async () => {
    stubMoi(new Response(null, { status: 401 }))
    const { default: ProfLayout } = await import('../layout')

    await expect(ProfLayout({ children: 'CONTENU' })).rejects.toThrow(
      'REDIRECT:/connexion?from=/prof'
    )
  })
})
