import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// #371 (PL-2): the Accueil resolves a competence to the lesson that teaches it. Contract:
// GET /api/referentiel/lecon?competence=&niveau= -> 200 {niveauCode, matiereCode, chapitreId,
// sectionId, sectionTitre} | 204 (not linkable) | 401.

const LECON = {
  niveauCode: '5e',
  matiereCode: 'mathematiques',
  chapitreId: 'division-decimale-problemes',
  sectionId: 'diviser-par-un-decimal',
  sectionTitre: 'Diviser par un nombre décimal',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function appel(fetchMock: ReturnType<typeof vi.fn>) {
  const [input, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit | undefined]
  const url = new URL(String(input))
  return { url, cookie: new Headers(init?.headers).get('cookie') }
}

describe('lireLecon', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // critère 1
  it('should return the lesson the backend gives, asking with the code, the level and the cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(LECON))
    vi.stubGlobal('fetch', fetchMock)
    const { lireLecon } = await import('../revoir')

    const lecon = await lireLecon('c4.num.operations.diviser-decimal', '5e', 'JSESSIONID=abc')

    expect(lecon).toEqual(LECON)
    const { url, cookie } = appel(fetchMock)
    expect(url.pathname).toBe('/api/referentiel/lecon')
    expect(url.searchParams.get('competence')).toBe('c4.num.operations.diviser-decimal')
    expect(url.searchParams.get('niveau')).toBe('5e')
    expect(cookie).toBe('JSESSIONID=abc')
  })

  // critère 4
  it('should return null on a 204 (competence not linkable to a lesson)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const { lireLecon } = await import('../revoir')
    expect(await lireLecon('c4.geo.pythagore.reciproque', '4e', 'c')).toBeNull()
  })

  it.each([401, 404, 500])('should return null on a %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'x' }, status)))
    const { lireLecon } = await import('../revoir')
    expect(await lireLecon('c4.x', '5e', 'c')).toBeNull()
  })

  it('should return null on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau')))
    const { lireLecon } = await import('../revoir')
    expect(await lireLecon('c4.x', '5e', 'c')).toBeNull()
  })

  it.each(['TimeoutError', 'AbortError'])(
    'should return null when the request exceeds its time limit (%s)',
    async (name) => {
      const fetchMock = vi.fn().mockRejectedValue(new DOMException('délai dépassé', name))
      vi.stubGlobal('fetch', fetchMock)
      const { lireLecon } = await import('../revoir')

      expect(await lireLecon('c4.x', '5e', 'c')).toBeNull()
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init.signal).toBeInstanceOf(AbortSignal)
    }
  )

  it('should return null when the body does not match the contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ niveauCode: '5e' })))
    const { lireLecon } = await import('../revoir')
    expect(await lireLecon('c4.x', '5e', 'c')).toBeNull()
  })
})

describe('hrefLecon', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  // critère 1
  it('should point to the section of the chapter in the interactive mode', async () => {
    const { hrefLecon } = await import('../revoir')
    expect(hrefLecon(LECON)).toBe(
      '/5e/mathematiques/division-decimale-problemes?diapo=diviser-par-un-decimal'
    )
  })

  it('should encode the section id', async () => {
    const { hrefLecon } = await import('../revoir')
    expect(hrefLecon({ ...LECON, sectionId: 'a b&c' })).toBe(
      '/5e/mathematiques/division-decimale-problemes?diapo=a%20b%26c'
    )
  })
})
