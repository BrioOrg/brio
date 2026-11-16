import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ChangerMotDePasseError,
  CompteInfoSchema,
  changerMotDePasse,
  reinitialiserAccesEleve,
} from '@brio/api-client'

// ADR 0036 : les deux appels du parcours « mot de passe oublié » — le prof réinitialise l'accès
// d'un élève, l'élève choisit ensuite son mot de passe. fetch est simulé.

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
}

function stub(status: number, body?: unknown) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('parcours de réinitialisation d’accès', () => {
  beforeEach(() => {
    clearCookies()
    document.cookie = 'XSRF-TOKEN=tok-1'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lit le drapeau doitChangerMotDePasse de CompteInfo', () => {
    const compte = CompteInfoSchema.parse({
      id: 'e1',
      role: 'eleve',
      statut: 'actif',
      nom: null,
      email: null,
      doitChangerMotDePasse: true,
    })
    expect(compte.doitChangerMotDePasse).toBe(true)
  })

  it('le prof obtient identifiant, mot de passe provisoire et expiration', async () => {
    const fetchMock = stub(200, {
      identifiantConnexion: 'k7m4p9xa3r',
      motDePasseProvisoire: 'abcd-efgh-jkmn',
      expireLe: '2026-11-23T10:00:00Z',
    })

    const acces = await reinitialiserAccesEleve('', 'cl 1', 'e/1')

    expect(acces).toEqual({
      identifiantConnexion: 'k7m4p9xa3r',
      motDePasseProvisoire: 'abcd-efgh-jkmn',
      expireLe: '2026-11-23T10:00:00Z',
    })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/classes/cl%201/inscriptions/e%2F1/reinitialisation-acces')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('tok-1')
  })

  it.each([
    [403, /accès à cette classe/i],
    [404, /n'est plus dans la classe/i],
    [409, /n'est pas actif/i],
    [429, /trop de réinitialisations.*jusqu’à 24 h/i],
  ])('traduit un refus %i en français', async (status, message) => {
    stub(status, { error: 'x' })
    await expect(reinitialiserAccesEleve('', 'c', 'e')).rejects.toThrow(message)
  })

  it('refuse une réponse qui n’a pas la forme attendue', async () => {
    stub(200, { identifiantConnexion: 'x' })
    await expect(reinitialiserAccesEleve('', 'c', 'e')).rejects.toThrow()
  })

  it('l’élève envoie son nouveau mot de passe en JSON, avec le jeton CSRF', async () => {
    const fetchMock = stub(204)
    await changerMotDePasse('', 'mon-secret-a-moi')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/moi/mot-de-passe')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('include')
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('tok-1')
    expect(JSON.parse(init?.body as string)).toEqual({ nouveauMotDePasse: 'mon-secret-a-moi' })
  })

  it.each([
    [400, /au moins 8 caractères/i],
    [422, /différent du mot de passe provisoire/i],
    [401, /nouveau mot de passe provisoire à ton prof/i],
  ])('traduit un refus %i du changement', async (status, message) => {
    stub(status, { error: 'x' })
    const erreur = await changerMotDePasse('', 'x').catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ChangerMotDePasseError)
    expect((erreur as ChangerMotDePasseError).status).toBe(status)
    expect((erreur as Error).message).toMatch(message)
  })

  it('dit « trop long » pour un 400 au-delà de 128 caractères', async () => {
    stub(400, { error: 'x' })
    await expect(changerMotDePasse('', 'a'.repeat(129))).rejects.toThrow(/trop long.*128/i)
  })

  // ADR 0036 §8-9 : le pseudonyme est retenu pendant le changement ; l'avis de réinitialisation
  // arrive ensuite.
  it('lit l’avis de réinitialisation et accepte un pseudonyme retenu', () => {
    const compte = CompteInfoSchema.parse({
      id: 'e1',
      role: 'eleve',
      statut: 'actif',
      nom: null,
      email: null,
      pseudonyme: null,
      doitChangerMotDePasse: false,
      accesReinitialise: { le: '2026-11-16T09:00:00Z', par: 'enseignant' },
    })
    expect(compte.accesReinitialise).toEqual({ le: '2026-11-16T09:00:00Z', par: 'enseignant' })
  })
})
