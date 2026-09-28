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

// The tutor, like submissions, is gated by the student's session (#153): no Basic
// header (the API chain ignores it), the session cookie, and the CSRF echo on POST.
describe('tuteur', () => {
  beforeEach(() => {
    vi.resetModules()
    clearCookies()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubTuteur() {
    const posts: Array<{ url: string; init: RequestInit | undefined }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input)
        if (url.endsWith('/api/moi')) {
          document.cookie = 'XSRF-TOKEN=tok-tut'
          return new Response(null, { status: 401 })
        }
        posts.push({ url, init })
        return new Response(JSON.stringify({ reponse: 'Bonjour', citations: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )
    return posts
  }

  it.each([
    [{ kind: 'cours' as const, coursId: 'c-1' }, /\/api\/cours\/c-1\/tuteur$/],
    [
      { kind: 'chapitre' as const, niveau: '3e', matiere: 'mathematiques', slug: 'pythagore' },
      /\/api\/chapitres\/3e\/mathematiques\/pythagore\/tuteur$/,
    ],
  ])('rides the session with the CSRF token (%o)', async (target, urlPattern) => {
    const posts = stubTuteur()
    const { askTuteurForTarget } = await import('@/lib/api')

    const reponse = await askTuteurForTarget(target, 'Pourquoi ?', null)

    expect(reponse.reponse).toBe('Bonjour')
    const post = posts.find((p) => urlPattern.test(p.url))
    expect(post?.init?.credentials).toBe('include')
    const headers = new Headers(post?.init?.headers)
    expect(headers.get('X-XSRF-TOKEN')).toBe('tok-tut')
    expect(headers.get('Authorization')).toBeNull()
  })
})

describe('getCoursPublie', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('relays the incoming request cookie from the server, uncached', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ id: 'c-1', title: 'Mon cours', sections: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { getCoursPublie } = await import('@/lib/api')

    await getCoursPublie('c-1', 'JSESSIONID=abc')

    const init = fetchMock.mock.calls[0][1]
    const headers = new Headers(init?.headers)
    expect(headers.get('cookie')).toBe('JSESSIONID=abc')
    expect(headers.get('Authorization')).toBeNull()
    expect(init?.cache).toBe('no-store')
  })
})

describe('catalogue public', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends no Authorization header', async () => {
    vi.resetModules()
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { getCatalogue } = await import('@/lib/api')

    await getCatalogue()

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBeNull()
  })
})

describe('getCoursVisibles', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('relays the cookie and accepts a course without a teacher name', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: 'c-1',
              titre: 'Pythagore',
              niveauCode: '3e',
              matiereCode: 'mathematiques',
              enseignant: null,
              publieAt: '2026-09-28T10:00:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    )
    vi.stubGlobal('fetch', fetchMock)
    const { getCoursVisibles } = await import('@/lib/api')

    const cours = await getCoursVisibles('JSESSIONID=abc')

    expect(cours).toEqual([expect.objectContaining({ id: 'c-1', enseignant: null })])
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/cours$/)
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('cookie')).toBe('JSESSIONID=abc')
  })

  it('throws on 401 so the page can hide the section', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 }))
    )
    const { getCoursVisibles } = await import('@/lib/api')
    await expect(getCoursVisibles('')).rejects.toThrow()
  })
})
