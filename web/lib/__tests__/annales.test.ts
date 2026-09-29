import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CoursApiError,
  entrainementParCompetence,
  listerAnnales,
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
