import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EntraideError,
  consulterFil,
  fileSignalements,
  listerFils,
  mesClasses,
  ouvrirFil,
  repondre,
  sanctionner,
  signaler,
} from '@brio/api-client'

// Runs the real entraide wrappers (CSRF, credentials, Zod validation, error mapping)
// against a stubbed fetch — no backend required.

const BASE = 'http://api.test'

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fil = {
  id: 'f1',
  portee: 'chapitre',
  porteeRef: 'fractions',
  titre: 'Comment simplifier ?',
  auteurId: 'e1',
  auteurNom: 'Léa',
  statut: 'visible',
  resolu: false,
  nbReponses: 2,
  createdAt: '2026-10-07T10:00:00Z',
}

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => clearCookies())

describe('mesClasses', () => {
  it('keeps only what the UI needs from ClasseInfo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json([
          {
            id: 'c1',
            etablissementId: 'x',
            niveauCode: '6e',
            libelle: '6e B',
            anneeScolaire: '2026-2027',
            statut: 'active',
            enseignantPrincipalId: null,
          },
        ])
      )
    )
    expect(await mesClasses(BASE)).toEqual([{ id: 'c1', libelle: '6e B', niveauCode: '6e' }])
  })

  it('returns no class when logged out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 }))
    )
    expect(await mesClasses(BASE)).toEqual([])
  })
})

describe('listerFils', () => {
  it('passes portee, ref and classeId as query parameters', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        return json([fil])
      })
    )
    const res = await listerFils(BASE, 'exercice', 'ex-1', 'c1')
    expect(res[0]).toMatchObject({ id: 'f1', nbReponses: 2 })
    expect(urls[0]).toBe(`${BASE}/api/entraide?portee=exercice&ref=ex-1&classeId=c1`)
  })

  it("shows the server's French message on a 403", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: "Vous n'êtes pas membre de cette classe." }, 403))
    )
    await expect(listerFils(BASE, 'chapitre', 'x', 'c1')).rejects.toEqual(
      new EntraideError(403, "Vous n'êtes pas membre de cette classe.")
    )
  })
})

describe('ouvrirFil', () => {
  it('primes CSRF, posts the question and returns the new id', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push([url, init])
        if (url.endsWith('/api/moi')) {
          document.cookie = 'XSRF-TOKEN=tok-1'
          return new Response(null, { status: 401 })
        }
        return json({ id: 'f9' }, 201)
      })
    )
    const id = await ouvrirFil(BASE, {
      portee: 'chapitre',
      porteeRef: 'fractions',
      classeId: 'c1',
      titre: 'Une question',
      question: 'Pourquoi ?',
    })
    expect(id).toBe('f9')
    const [url, init] = calls[1]!
    expect(url).toBe(`${BASE}/api/entraide`)
    expect(init?.credentials).toBe('include')
    expect((init?.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('tok-1')
    expect(JSON.parse(init?.body as string)).toMatchObject({
      classeId: 'c1',
      titre: 'Une question',
    })
  })
})

describe('repondre', () => {
  it('surfaces the rate-limit message (429)', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'Vous écrivez trop vite. Patientez un instant.' }, 429))
    )
    await expect(repondre(BASE, 'f1', 'salut')).rejects.toMatchObject({
      status: 429,
      message: 'Vous écrivez trop vite. Patientez un instant.',
    })
  })
})

describe('consulterFil', () => {
  it('validates a locked exercise thread', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          ...fil,
          portee: 'exercice',
          estAuteur: false,
          verrouille: true,
          reponsesMasquees: 3,
          messages: [
            {
              id: 'm1',
              auteurId: 'e1',
              auteurNom: 'Léa',
              corps: 'Pourquoi ?',
              statut: 'visible',
              utile: false,
              estMoi: false,
              createdAt: '2026-10-07T10:00:00Z',
            },
          ],
        })
      )
    )
    const detail = await consulterFil(BASE, 'f1')
    expect(detail.verrouille).toBe(true)
    expect(detail.reponsesMasquees).toBe(3)
  })
})

describe('signaler', () => {
  it('sends a null reason when none is given', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    const bodies: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(init?.body as string))
        return new Response(null, { status: 204 })
      })
    )
    await signaler(BASE, 'm1', '   ')
    expect(bodies[0]).toEqual({ motif: null })
  })
})

describe('moderation', () => {
  it('reads the queue with the class of each report', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json([
          {
            id: 's1',
            messageId: 'm1',
            filId: 'f1',
            classeId: 'c1',
            filTitre: 'Q',
            auteurMessageId: 'e2',
            auteurMessageNom: 'Tom',
            extraitMessage: 'bla',
            signalePar: 'e1',
            motif: null,
            createdAt: '2026-10-07T10:00:00Z',
          },
        ])
      )
    )
    const file = await fileSignalements(BASE)
    expect(file[0]).toMatchObject({ classeId: 'c1', auteurMessageNom: 'Tom' })
  })

  it('posts a sanction', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    const calls: Array<[string, RequestInit | undefined]> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push([url, init])
        return json({ id: 'sa1' }, 201)
      })
    )
    const id = await sanctionner(BASE, { compteId: 'e2', classeId: 'c1', type: 'lecture_seule' })
    expect(id).toBe('sa1')
    expect(calls[0]![0]).toBe(`${BASE}/api/prof/entraide/sanctions`)
  })
})
