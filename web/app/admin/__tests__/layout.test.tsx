import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The admin-space role gate (suivi #338): it asks the backend who the caller is and lets only
// admin_brio accounts through; everyone else is redirected.

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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

describe('AdminLayout role gate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    redirectMock.mockClear()
  })

  it('renders children and the admin badge for an admin_brio', async () => {
    stubMoi(
      new Response(
        JSON.stringify({
          id: '1',
          role: 'admin_brio',
          statut: 'actif',
          nom: 'A',
          email: 'a@brio.fr',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    const { default: AdminLayout } = await import('../layout')

    render(await AdminLayout({ children: 'CONTENU' }))

    expect(redirectMock).not.toHaveBeenCalled()
    expect(screen.getByText('CONTENU')).toBeInTheDocument()
    expect(screen.getByText('Compte administrateur Brio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it('redirects a non-admin to the home page', async () => {
    stubMoi(
      new Response(
        JSON.stringify({ id: '2', role: 'enseignant', statut: 'actif', nom: null, email: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    const { default: AdminLayout } = await import('../layout')

    await expect(AdminLayout({ children: 'CONTENU' })).rejects.toThrow('REDIRECT:/')
  })

  it('redirects to login when there is no live session', async () => {
    stubMoi(new Response(null, { status: 401 }))
    const { default: AdminLayout } = await import('../layout')

    await expect(AdminLayout({ children: 'CONTENU' })).rejects.toThrow(
      'REDIRECT:/connexion?from=/admin'
    )
  })
})
