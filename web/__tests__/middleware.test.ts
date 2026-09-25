import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

function makeRequest(pathname: string, hasCookie = false) {
  const url = `http://localhost${pathname}`
  const req = new NextRequest(url)
  if (hasCookie) req.cookies.set('JSESSIONID', 'abc123')
  return req
}

describe('middleware', () => {
  it('passe la page accueil sans session', () => {
    const res = middleware(makeRequest('/'))
    expect(res.status).not.toBe(302)
  })

  it('passe /connexion sans session', () => {
    const res = middleware(makeRequest('/connexion'))
    expect(res.status).not.toBe(302)
  })

  it('passe les routes catalogue sans session', () => {
    for (const path of ['/6e', '/6e/mathematiques', '/6e/mathematiques/nombres-decimaux']) {
      const res = middleware(makeRequest(path))
      expect(res.status, `expected ${path} to pass through`).not.toBe(302)
    }
  })

  it('redirige /ma-classe vers /connexion sans session', () => {
    const res = middleware(makeRequest('/ma-classe'))
    expect(res.status).toBe(302)
    const location = res.headers.get('location')!
    expect(location).toContain('/connexion')
    expect(location).toContain('from=%2Fma-classe')
  })

  it('passe /ma-classe avec session', () => {
    const res = middleware(makeRequest('/ma-classe', true))
    expect(res.status).not.toBe(302)
  })

  it('redirige /prof vers /connexion sans session', () => {
    const res = middleware(makeRequest('/prof'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('from=%2Fprof')
  })

  it('passe /prof avec session', () => {
    const res = middleware(makeRequest('/prof', true))
    expect(res.status).not.toBe(302)
  })

  it('redirige les sous-chemins proteges', () => {
    const res = middleware(makeRequest('/profil/parametres'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('from=%2Fprofil%2Fparametres')
  })
})
