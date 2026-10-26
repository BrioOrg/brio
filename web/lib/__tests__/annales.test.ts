import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CoursApiError,
  demarrerExamen,
  entrainementParCompetence,
  examenActif,
  listerAnnales,
  rendreExamen,
} from '@brio/api-client'

// Exerce les wrappers annales (validation Zod, encodage du paramètre, mapping d'erreur) avec fetch
// stubé — aucun backend requis (F7, ADR 0026).

const BASE = 'http://api.test'

afterEach(() => vi.unstubAllGlobals())

describe('listerAnnales', () => {
  it('renvoie la liste validée', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              id: 'dnb-2025-metropole-juin',
              titre: 'Brevet — Métropole',
              examen: 'brevet',
              session: 'juin',
              annee: 2025,
              centre: 'Métropole',
              niveau: '3e',
              matiere: 'mathematiques',
              dureeMinutes: 120,
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    const res = await listerAnnales(BASE)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ examen: 'brevet', annee: 2025, niveau: '3e' })
  })

  it('mappe une erreur serveur en CoursApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    await expect(listerAnnales(BASE)).rejects.toBeInstanceOf(CoursApiError)
  })
})

describe('entrainementParCompetence', () => {
  it('encode le code en paramètre et valide la réponse', async () => {
    let calledUrl = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calledUrl = url
        return new Response(
          JSON.stringify([
            {
              exerciceId: 'ex1',
              prompt: 'Calcule…',
              exerciseType: 'numeric',
              annaleId: 'dnb-2025-metropole-juin',
              annaleTitre: 'Brevet — Métropole',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )

    const res = await entrainementParCompetence(BASE, 'c4.geo.pythagore.calculer')
    expect(res[0]?.annaleTitre).toBe('Brevet — Métropole')
    expect(calledUrl).toContain('competence=c4.geo.pythagore.calculer')
  })
})

// --- Mode examen (F7, ADR 0027) ---

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
}

describe('examenActif', () => {
  it('renvoie l’examen en cours', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            enExamen: true,
            sessionId: 's1',
            annaleId: 'a1',
            titre: 'Brevet — Métropole',
            endsAt: '2026-01-01T10:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    const res = await examenActif(BASE)
    expect(res.enExamen).toBe(true)
    expect(res.sessionId).toBe('s1')
  })

  it('ne verrouille pas si l’appel échoue (401 → enExamen false)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    const res = await examenActif(BASE)
    expect(res.enExamen).toBe(false)
  })
})

describe('demarrerExamen', () => {
  beforeEach(clearCookies)

  it('porte le token CSRF et renvoie la session', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/moi')) {
        document.cookie = 'XSRF-TOKEN=tok-1'
        return new Response(null, { status: 401 })
      }
      return new Response(
        JSON.stringify({ sessionId: 'sess-7', endsAt: '2026-01-01T10:00:00Z' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await demarrerExamen(BASE, 'a1')
    expect(res.sessionId).toBe('sess-7')
    const post = fetchMock.mock.calls.find(([u]) => String(u).includes('/examen'))
    expect((post?.[1]?.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('tok-1')
  })
})

describe('rendreExamen', () => {
  beforeEach(clearCookies)

  it('résout sur 204', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/moi')
          ? new Response(null, { status: 401 })
          : new Response(null, { status: 204 })
      )
    )
    await expect(rendreExamen(BASE, 'sess-7')).resolves.toBeUndefined()
  })
})
