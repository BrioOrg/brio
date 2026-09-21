import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Exercises the real api-client progression logic (credentials, Zod validation,
// 401 → null, error mapping) through @/lib/progression, with fetch stubbed.

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('progression client', () => {
  it('returns the parsed XP + level on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ xpTotal: 42, niveau: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )
    const { getProgression } = await import('@/lib/progression')
    expect(await getProgression()).toEqual({ xpTotal: 42, niveau: 0 })
  })

  it('sends the session cookie (credentials: include)', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ xpTotal: 0, niveau: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { getProgression } = await import('@/lib/progression')
    await getProgression()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/progression\/moi$/)
    expect(init?.credentials).toBe('include')
  })

  it('returns null when the student is not logged in (401)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    const { getProgression } = await import('@/lib/progression')
    expect(await getProgression()).toBeNull()
  })

  it('throws on a server error so the caller can leave the badge hidden', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    const { getProgression } = await import('@/lib/progression')
    await expect(getProgression()).rejects.toThrow()
  })
})
