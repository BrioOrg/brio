import { afterEach, describe, expect, it, vi } from 'vitest'

import { CoursApiError, listerCompetences } from '@brio/api-client'

// The referential wrapper goes through openapi-fetch (global fetch). We stub it with real Response
// objects (no running backend) and assert the happy path plus the status→French error mapping.

const BASE = 'http://localhost:8080'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('referentiel client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the active competencies on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          code: 'c4.geo.pythagore.calculer',
          intitule: 'Calculer une longueur avec Pythagore',
          domaine: 'espace-et-geometrie',
          niveaux: ['4e'],
        },
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const competences = await listerCompetences(BASE)
    expect(competences).toHaveLength(1)
    expect(competences[0].code).toBe('c4.geo.pythagore.calculer')

    const [a] = fetchMock.mock.calls[0] as [RequestInfo | URL]
    const url = a instanceof Request ? a.url : String(a)
    expect(url).toContain('/api/prof/referentiel/competences')
  })

  it('maps a failure to a CoursApiError carrying the status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })))
    const err = await listerCompetences(BASE).catch((e) => e)
    expect(err).toBeInstanceOf(CoursApiError)
    expect(err.status).toBe(403)
    expect(err.message).toContain('référentiel')
  })
})
