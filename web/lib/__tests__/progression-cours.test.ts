import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { ContenuAReprendreSchema } from '@brio/api-client'

// The teacher-course gauge and the « Reprendre » union (ADR 0050), through the real api-client
// logic with fetch stubbed: never a 0 % the backend did not give.

const JAUGE = {
  coursId: 'c0ffee00-0000-4000-8000-000000000001',
  pourcentage: 50,
  termine: false,
  sectionsLues: 2,
  sectionsTotal: 4,
}

function repondre(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getProgressionCours', () => {
  it('returns the parsed gauge on 200, asking with the session cookie', async () => {
    const appels: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        appels.push({ url, init })
        return repondre(200, JAUGE)
      })
    )
    const { getProgressionCours } = await import('@/lib/progression')

    expect(await getProgressionCours('c0ffee00-0000-4000-8000-000000000001')).toEqual(JAUGE)
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toMatch(
      /\/api\/progression\/cours\/c0ffee00-0000-4000-8000-000000000001$/
    )
    expect(appels[0].init?.credentials).toBe('include')
  })

  it('encodes the course id in the path', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        return repondre(204)
      })
    )
    const { getProgressionCours } = await import('@/lib/progression')
    await getProgressionCours('a/b')
    expect(urls[0]).toMatch(/\/api\/progression\/cours\/a%2Fb$/)
  })

  it.each([204, 401])('returns null on %i: no gauge, never a 0 %', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => repondre(status))
    )
    const { getProgressionCours } = await import('@/lib/progression')
    expect(await getProgressionCours('c')).toBeNull()
  })

  it('throws on another failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => repondre(500))
    )
    const { getProgressionCours } = await import('@/lib/progression')
    await expect(getProgressionCours('c')).rejects.toThrow(
      'Impossible de récupérer la progression du cours.'
    )
  })

  it('rejects a body that is not a gauge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => repondre(200, { ...JAUGE, termine: 'non' }))
    )
    const { getProgressionCours } = await import('@/lib/progression')
    await expect(getProgressionCours('c')).rejects.toThrow()
  })
})

describe('ContenuAReprendreSchema', () => {
  const commun = {
    titre: 'T',
    sectionsLues: 1,
    sectionsTotal: 3,
    derniereActivite: '2026-11-23T10:00:00Z',
  }

  it('reads a chapter and a course by their type', () => {
    const chapitre = ContenuAReprendreSchema.parse({
      type: 'chapitre',
      chapitreId: 'les-fractions',
      niveauCode: '5e',
      matiereCode: 'mathematiques',
      ...commun,
    })
    const cours = ContenuAReprendreSchema.parse({ type: 'cours', coursId: 'c1', ...commun })
    expect(chapitre.type).toBe('chapitre')
    expect(cours).toEqual({ type: 'cours', coursId: 'c1', ...commun })
  })

  it('refuses a course without its id and an unknown type', () => {
    expect(ContenuAReprendreSchema.safeParse({ type: 'cours', ...commun }).success).toBe(false)
    expect(
      ContenuAReprendreSchema.safeParse({ type: 'devoir', coursId: 'c1', ...commun }).success
    ).toBe(false)
  })
})

describe('ContenuAReprendreSchema — a backend from before teacher courses', () => {
  it('refuses a chapter without its type: the home page then draws no block, never a broken one', () => {
    expect(
      ContenuAReprendreSchema.safeParse({
        chapitreId: 'les-fractions',
        titre: 'Les fractions',
        niveauCode: '5e',
        matiereCode: 'mathematiques',
        sectionsLues: 1,
        sectionsTotal: 3,
        derniereActivite: '2026-11-23T10:00:00Z',
      }).success
    ).toBe(false)
  })
})
