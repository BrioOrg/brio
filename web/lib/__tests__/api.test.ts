import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Exercises soumettre() end-to-end (CSRF priming, session cookie, no Basic auth,
// Zod parse) through the real api-client, with fetch stubbed. Guards the #110 fix:
// a submission must ride the session so the backend attributes XP to the student.

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
}

// openapi-fetch may call fetch with a Request or with (url, init); normalise both.
function headerOf(input: unknown, init: RequestInit | undefined, name: string): string | null {
  if (input instanceof Request) return input.headers.get(name)
  return new Headers(init?.headers).get(name)
}

const OK_RESPONSE = {
  soumissionId: 's1',
  correct: true,
  score: 1,
  choiceFeedback: [],
  expectedValue: null,
  explanation: null,
}

describe('soumettre', () => {
  beforeEach(() => {
    vi.resetModules()
    clearCookies()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('primes the CSRF token, sends X-XSRF-TOKEN, and no Basic auth', async () => {
    const seen: Array<{ url: string; xsrf: string | null; auth: string | null }> = []
    let primeCredentials: RequestCredentials | undefined

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.endsWith('/api/moi')) {
        primeCredentials = input instanceof Request ? input.credentials : init?.credentials
        document.cookie = 'XSRF-TOKEN=tok-xyz'
        return new Response(null, { status: 401 })
      }
      seen.push({
        url,
        xsrf: headerOf(input, init, 'X-XSRF-TOKEN'),
        auth: headerOf(input, init, 'Authorization'),
      })
      return new Response(JSON.stringify(OK_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { soumettre } = await import('@/lib/api')
    const result = await soumettre('ex-1', { choiceIds: ['a'] })

    expect(result.correct).toBe(true)

    // CSRF was primed with the session cookie riding.
    expect(primeCredentials).toBe('include')

    const post = seen.find((c) => /\/api\/exercices\/ex-1\/soumissions$/.test(c.url))
    expect(post).toBeDefined()
    expect(post?.xsrf).toBe('tok-xyz')
    expect(post?.auth).toBeNull() // Basic dev-scaffolding is gone
  })

  it('does not re-prime when an XSRF-TOKEN cookie already exists', async () => {
    document.cookie = 'XSRF-TOKEN=already'
    const urls: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(input instanceof Request ? input.url : String(input))
      return new Response(JSON.stringify(OK_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { soumettre } = await import('@/lib/api')
    await soumettre('ex-1', { choiceIds: ['a'] })

    expect(urls.some((u) => u.endsWith('/api/moi'))).toBe(false)
  })

  it('maps a 401 to a clear error', async () => {
    document.cookie = 'XSRF-TOKEN=already'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 }))
    )
    const { soumettre } = await import('@/lib/api')
    await expect(soumettre('ex-1', { choiceIds: ['a'] })).rejects.toThrow('Non authentifié')
  })
})
