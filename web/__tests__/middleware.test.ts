import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

function makeRequest(pathAndSearch: string, hasCookie = false) {
  const req = new NextRequest(`http://localhost${pathAndSearch}`)
  if (hasCookie) req.cookies.set('JSESSIONID', 'abc123')
  return req
}

/** The backend's answer to GET /api/moi. */
function stubMoi(reponse: number | Error) {
  const fetchMock = vi.fn(() =>
    reponse instanceof Error
      ? Promise.reject(reponse)
      : Promise.resolve(new Response(null, { status: reponse }))
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function locationOf(res: Response): string {
  return res.headers.get('location') ?? ''
}

describe('middleware', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    stubMoi(200)
  })

  it('redirige la page accueil vers /connexion sans session', async () => {
    const res = await middleware(makeRequest('/'))
    expect(res.status).toBe(302)
    expect(locationOf(res)).toContain('/connexion')
    expect(locationOf(res)).toContain('from=%2F')
  })

  it('passe la page accueil avec une session valide', async () => {
    const fetchMock = stubMoi(200)
    const res = await middleware(makeRequest('/', true))
    expect(res.status).not.toBe(302)
    // The backend is asked with the visitor's own cookies.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/moi'),
      expect.objectContaining({ headers: { cookie: 'JSESSIONID=abc123' } })
    )
  })

  it.each([
    '/connexion',
    '/inscription/enseignant',
    '/commencer',
    '/rejoindre',
    '/mot-de-passe-oublie',
    '/consentement/t-1',
  ])('passe %s sans session, sans interroger le backend', async (path) => {
    const fetchMock = stubMoi(401)
    const res = await middleware(makeRequest(path))
    expect(res.status).not.toBe(302)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('redirige les routes catalogue et chapitre sans session (#279)', async () => {
    for (const path of ['/6e', '/6e/mathematiques', '/6e/mathematiques/nombres-decimaux']) {
      const res = await middleware(makeRequest(path))
      expect(res.status, `expected ${path} to redirect`).toBe(302)
      expect(locationOf(res)).toContain(`from=${encodeURIComponent(path)}`)
    }
  })

  it('redirige un chapitre quand la session a expiré, en gardant la diapo pour le retour', async () => {
    stubMoi(401)
    const res = await middleware(
      makeRequest('/3e/mathematiques/theoreme-de-pythagore?diapo=enonce-prose', true)
    )
    expect(res.status).toBe(302)
    const from = new URL(locationOf(res)).searchParams.get('from')
    expect(from).toBe('/3e/mathematiques/theoreme-de-pythagore?diapo=enonce-prose')
  })

  it('passe un chapitre avec une session valide', async () => {
    const res = await middleware(makeRequest('/3e/mathematiques/theoreme-de-pythagore', true))
    expect(res.status).not.toBe(302)
  })

  it('laisse la page s’afficher quand le backend est injoignable', async () => {
    stubMoi(new Error('ECONNREFUSED'))
    const res = await middleware(makeRequest('/3e', true))
    expect(res.status).not.toBe(302)
  })

  it('ne redirige que sur un 401', async () => {
    stubMoi(500)
    const res = await middleware(makeRequest('/3e', true))
    expect(res.status).not.toBe(302)
  })

  it.each(['/ma-classe', '/prof', '/cours/c-1', '/devoirs', '/annales'])(
    'redirige %s vers /connexion sans session',
    async (path) => {
      const res = await middleware(makeRequest(path))
      expect(res.status).toBe(302)
      expect(locationOf(res)).toContain(`from=${encodeURIComponent(path)}`)
    }
  )

  it('redirige /prof quand la session a expiré', async () => {
    stubMoi(401)
    const res = await middleware(makeRequest('/prof', true))
    expect(res.status).toBe(302)
    expect(locationOf(res)).toContain('from=%2Fprof')
  })

  it('redirige les sous-chemins proteges', async () => {
    const res = await middleware(makeRequest('/profil/parametres'))
    expect(res.status).toBe(302)
    expect(locationOf(res)).toContain('from=%2Fprofil%2Fparametres')
  })

  // ADR 0036 §5 : après une réinitialisation par le prof, l'élève choisit son mot de passe avant
  // toute autre page (le backend refuse de toute façon les autres appels).
  describe('mot de passe à changer', () => {
    function stubMoiJson(body: unknown) {
      const fetchMock = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    it.each(['/', '/ma-classe', '/3e/mathematiques', '/prof'])(
      'envoie %s vers /changer-mot-de-passe',
      async (path) => {
        stubMoiJson({ id: 'e1', role: 'eleve', doitChangerMotDePasse: true })
        const res = await middleware(makeRequest(path, true))
        expect(res.status).toBe(302)
        expect(new URL(locationOf(res)).pathname).toBe('/changer-mot-de-passe')
      }
    )

    it('laisse /changer-mot-de-passe s’afficher', async () => {
      stubMoiJson({ id: 'e1', role: 'eleve', doitChangerMotDePasse: true })
      const res = await middleware(makeRequest('/changer-mot-de-passe', true))
      expect(res.status).not.toBe(302)
    })

    it('n’est pas une page publique : sans session, retour à la connexion', async () => {
      const fetchMock = stubMoi(401)
      const res = await middleware(makeRequest('/changer-mot-de-passe'))
      expect(res.status).toBe(302)
      expect(locationOf(res)).toContain('/connexion')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('renvoie à l’accueil quand plus rien n’est à changer', async () => {
      stubMoiJson({ id: 'e1', role: 'eleve', doitChangerMotDePasse: false })
      const res = await middleware(makeRequest('/changer-mot-de-passe', true))
      expect(res.status).toBe(302)
      expect(new URL(locationOf(res)).pathname).toBe('/')
    })

    it('laisse passer une session normale', async () => {
      stubMoiJson({ id: 'e1', role: 'eleve', doitChangerMotDePasse: false })
      const res = await middleware(makeRequest('/ma-classe', true))
      expect(res.status).not.toBe(302)
    })
  })
})
