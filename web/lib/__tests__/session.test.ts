import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LoginError } from '@brio/api-client'

// Exercises the real api-client session logic (CSRF priming, headers, body,
// Zod validation, error mapping) through @/lib/session, with fetch stubbed.

const COMPTE = { id: 'abc', role: 'enseignant', statut: 'actif', nom: 'Dupont', email: 'p@t.fr' }

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
}

describe('session client', () => {
  beforeEach(() => {
    clearCookies()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('primes the CSRF cookie, sends X-XSRF-TOKEN and a form body, returns the compte', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init])
      if (url.endsWith('/api/moi')) {
        // The priming GET: server would set the cookie via Set-Cookie; emulate it.
        document.cookie = 'XSRF-TOKEN=tok-123'
        return new Response(null, { status: 401 })
      }
      return new Response(JSON.stringify(COMPTE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { login } = await import('@/lib/session')
    const compte = await login('prof.test', 'motdepasse')

    expect(compte).toEqual(COMPTE)

    const post = calls.find(([u]) => u.endsWith('/api/sessions'))!
    const [, init] = post
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('include')
    const headers = new Headers(init?.headers)
    expect(headers.get('X-XSRF-TOKEN')).toBe('tok-123')
    expect(headers.get('Content-Type')).toBe('application/x-www-form-urlencoded')
    const body = new URLSearchParams(init?.body as string)
    expect(body.get('identifiant')).toBe('prof.test')
    expect(body.get('mot_de_passe')).toBe('motdepasse')
  })

  it('does not re-prime when an XSRF-TOKEN cookie already exists', async () => {
    document.cookie = 'XSRF-TOKEN=existing'
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(COMPTE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const { login } = await import('@/lib/session')
    await login('prof.test', 'motdepasse')

    // Only the POST — no priming GET to /api/moi.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(headers.get('X-XSRF-TOKEN')).toBe('existing')
  })

  it('throws LoginError with status 401 on bad credentials', async () => {
    document.cookie = 'XSRF-TOKEN=tok'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Identifiant ou mot de passe incorrect' }), {
          status: 401,
        })
      )
    )

    const { login } = await import('@/lib/session')
    await expect(login('prof.test', 'faux')).rejects.toMatchObject({
      name: 'LoginError',
      status: 401,
    })
    await expect(login('prof.test', 'faux')).rejects.toBeInstanceOf(LoginError)
  })

  it('getMoi returns null when unauthenticated', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    const { getMoi } = await import('@/lib/session')
    expect(await getMoi()).toBeNull()
  })
})
