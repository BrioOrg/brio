import { beforeEach, describe, expect, it, vi } from 'vitest'

// The teacher-space role gate. It asks the backend who the caller is (forwarding the
// session cookie) and lets only ENSEIGNANT accounts through; everyone else is redirected.

const redirectMock = vi.fn((url: string) => {
  // Real next/navigation redirect throws to halt rendering — emulate that.
  throw new Error(`REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
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

  it('renders children for an enseignant', async () => {
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

    const result = await ProfLayout({ children: 'CONTENU' })

    expect(redirectMock).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
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
