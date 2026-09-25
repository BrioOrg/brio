import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CoursApiError,
  creerCours,
  getCoursBrouillon,
  listerMesCours,
  publierCours,
} from '@brio/api-client'

// The authoring wrappers go through openapi-fetch, which calls the global fetch. We stub it with
// real Response objects (no running backend) and assert status→French mapping and the CSRF header.

const BASE = 'http://localhost:8080'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Normalise a fetch mock call to method + headers, whether it received (url, init) or a Request. */
function callInfo(call: unknown[]): { method: string; url: string; headers: Headers } {
  const [a, b] = call as [RequestInfo | URL, RequestInit | undefined]
  if (a instanceof Request) {
    return { method: a.method, url: a.url, headers: a.headers }
  }
  return {
    method: (b?.method ?? 'GET').toUpperCase(),
    url: String(a),
    headers: new Headers(b?.headers),
  }
}

describe('cours-edition client', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=tok123'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the teacher courses on 200', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse([{ id: 'c1', titre: 'Pythagore', statut: 'brouillon' }]))
    vi.stubGlobal('fetch', fetchMock)

    const cours = await listerMesCours(BASE)
    expect(cours).toHaveLength(1)
    expect(cours[0].titre).toBe('Pythagore')
  })

  it('maps a 403 to the "no access" French message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })))

    await expect(getCoursBrouillon(BASE, 'c1')).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("n'avez pas accès"),
    })
  })

  it('surfaces the server reason on a 422 publish failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'Référence interne cassée' }, 422))
    )

    await expect(publierCours(BASE, 'c1')).rejects.toMatchObject({
      status: 422,
      message: 'Référence interne cassée',
    })
  })

  it('throws a CoursApiError instance carrying the status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
    const err = await getCoursBrouillon(BASE, 'c1').catch((e) => e)
    expect(err).toBeInstanceOf(CoursApiError)
    expect(err.status).toBe(404)
  })

  it('creates a course, echoing the CSRF token on the POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ coursId: 'nouveau-id' }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const id = await creerCours(BASE, {
      titre: 'Pythagore',
      niveauCode: '3e',
      matiereCode: 'mathematiques',
    })
    expect(id).toBe('nouveau-id')

    const { method, url, headers } = callInfo(fetchMock.mock.calls[0])
    expect(method).toBe('POST')
    expect(url).toContain('/api/prof/cours')
    expect(headers.get('X-XSRF-TOKEN')).toBe('tok123')
  })
})
