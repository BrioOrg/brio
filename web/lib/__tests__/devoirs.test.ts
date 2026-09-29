import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CoursApiError,
  controleActif,
  creerDevoir,
  getTableauDeBord,
  listerDevoirsClasse,
  listerMesDevoirs,
} from '@brio/api-client'

// Exerce la vraie logique des wrappers devoirs (CSRF, credentials, validation Zod, mapping d'erreur)
// avec fetch stubé — aucun backend requis.

const BASE = 'http://api.test'

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
}

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => clearCookies())

describe('listerMesDevoirs', () => {
  it('renvoie la liste validée', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { id: 'd1', titre: 'Pythagore', echeanceAt: '2026-10-03T18:00:00Z', nombreExercices: 3, statutRendu: 'non_commence' },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    const res = await listerMesDevoirs(BASE)
    expect(res).toHaveLength(1)
    expect(res?.[0]).toMatchObject({ id: 'd1', statutRendu: 'non_commence' })
  })

  it('renvoie null quand déconnecté (401)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    expect(await listerMesDevoirs(BASE)).toBeNull()
  })
})

describe('creerDevoir', () => {
  it('amorce le CSRF, poste et renvoie l’id créé', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push([url, init])
        if (url.endsWith('/api/moi')) {
          document.cookie = 'XSRF-TOKEN=tok-9'
          return new Response(null, { status: 401 })
        }
        return new Response(JSON.stringify({ id: 'dev-42' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )
    const id = await creerDevoir(BASE, {
      classeId: 'c1',
      titre: 'DM',
      sourceType: 'cours',
      sourceRef: 'cours-1',
      exerciceIds: ['e1', 'e2'],
      ouvreAt: '2026-09-29T08:00:00Z',
      echeanceAt: '2026-10-03T18:00:00Z',
    })
    expect(id).toBe('dev-42')
    const post = calls.find(([u]) => u.endsWith('/api/prof/devoirs'))!
    expect(post[1]?.method).toBe('POST')
    expect((post[1]?.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('tok-9')
  })

  it('mappe un 403 en CoursApiError avec un message FR', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/moi')
          ? new Response(null, { status: 401 })
          : new Response(null, { status: 403 })
      )
    )
    await expect(
      creerDevoir(BASE, {
        classeId: 'c1',
        titre: 'DM',
        sourceType: 'cours',
        sourceRef: 'cours-1',
        exerciceIds: ['e1'],
        ouvreAt: '2026-09-29T08:00:00Z',
        echeanceAt: '2026-10-03T18:00:00Z',
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(creerDevoir(BASE, {
      classeId: 'c1', titre: 'DM', sourceType: 'cours', sourceRef: 'x',
      exerciceIds: ['e1'], ouvreAt: '2026-09-29T08:00:00Z', echeanceAt: '2026-10-03T18:00:00Z',
    })).rejects.toBeInstanceOf(CoursApiError)
  })
})

describe('listerDevoirsClasse', () => {
  it('passe classeId en query et valide la réponse', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url)
        return new Response(
          JSON.stringify([
            { id: 'd1', titre: 'DM', ouvreAt: '2026-09-29T08:00:00Z', echeanceAt: '2026-10-03T18:00:00Z', statut: 'publie', nombreExercices: 2 },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )
    const res = await listerDevoirsClasse(BASE, 'classe-1')
    expect(res).toHaveLength(1)
    expect(calls[0]).toContain('classeId=classe-1')
  })
})

describe('getTableauDeBord', () => {
  it('valide le tableau de bord (élèves + par compétence)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            devoirId: 'd1',
            titre: 'DM',
            echeanceAt: '2026-10-03T18:00:00Z',
            total: 2,
            nbRendu: 1,
            nbEnCours: 0,
            nbNonCommence: 1,
            moyenne: 0.72,
            eleves: [{ eleveId: 'e1', nomAffiche: 'Léa', statut: 'rendu', score: 0.9 }],
            parCompetence: [{ code: 'c4.geo.pythagore', tauxReussite: 0.5, nombreReponses: 2 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    const tdb = await getTableauDeBord(BASE, 'd1')
    expect(tdb.nbRendu).toBe(1)
    expect(tdb.eleves[0].nomAffiche).toBe('Léa')
    expect(tdb.parCompetence[0].tauxReussite).toBe(0.5)
  })
})

describe('controleActif', () => {
  it('signale un contrôle en cours', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            enControle: true,
            titre: 'Contrôle Pythagore',
            echeanceAt: '2026-10-03T18:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    const c = await controleActif(BASE)
    expect(c.enControle).toBe(true)
    expect(c.titre).toBe('Contrôle Pythagore')
  })

  it('ne verrouille pas si déconnecté (401)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    expect((await controleActif(BASE)).enControle).toBe(false)
  })
})
