import { describe, it, expect, vi, afterEach } from 'vitest'
import { RejoindreError } from '@brio/api-client'

// Exercises the real api-client enrollment logic through @/lib/enrollment,
// with fetch stubbed. Path A is public + CSRF-exempt, so no token/cookie dance.

const INSCRIT = {
  id: 'abc',
  identifiantConnexion: 'lea.martin.4eb',
  nomAffiche: 'Léa',
  classeLibelle: '4e B',
}

describe('enrollment client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs JSON to /api/classes/rejoindre and returns the inscrit', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(INSCRIT), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const { rejoindreClasse } = await import('@/lib/enrollment')
    const inscrit = await rejoindreClasse({
      code: '4EB-2K9P',
      nomAffiche: 'Léa',
      motDePasse: 'motdepasse1',
    })

    expect(inscrit).toEqual(INSCRIT)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/classes\/rejoindre$/)
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(init?.body as string)).toEqual({
      code: '4EB-2K9P',
      nomAffiche: 'Léa',
      motDePasse: 'motdepasse1',
    })
  })

  it('throws RejoindreError carrying the HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Code inconnu' }), { status: 404 }))
    )

    const { rejoindreClasse } = await import('@/lib/enrollment')
    await expect(
      rejoindreClasse({ code: 'BAD', nomAffiche: 'Léa', motDePasse: 'motdepasse1' })
    ).rejects.toMatchObject({ name: 'RejoindreError', status: 404 })
    await expect(
      rejoindreClasse({ code: 'BAD', nomAffiche: 'Léa', motDePasse: 'motdepasse1' })
    ).rejects.toBeInstanceOf(RejoindreError)
  })
})
