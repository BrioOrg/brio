import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signalerSessionExpiree } from '@brio/api-client'
import {
  DELAI_REDIRECTION_MS,
  SessionExpireeAlerte,
  urlReconnexion,
} from '@/components/session-expiree-alerte'

describe('SessionExpireeAlerte', () => {
  const assign = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    assign.mockReset()
    vi.stubGlobal('location', {
      pathname: '/3e/mathematiques/theoreme-de-pythagore',
      search: '?diapo=enonce-prose',
      assign,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reste invisible tant que la session est valide', () => {
    render(<SessionExpireeAlerte />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('prévient l’élève puis le renvoie à la connexion, avec retour à la page', () => {
    render(<SessionExpireeAlerte />)
    act(() => signalerSessionExpiree())

    const attendu = urlReconnexion('/3e/mathematiques/theoreme-de-pythagore?diapo=enonce-prose')
    expect(screen.getByRole('alert')).toHaveTextContent('Ta session a expiré')
    expect(screen.getByRole('link', { name: 'Me reconnecter maintenant' })).toHaveAttribute(
      'href',
      attendu
    )
    // The message is read first: no redirect yet.
    expect(assign).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(DELAI_REDIRECTION_MS))
    expect(assign).toHaveBeenCalledWith(attendu)
    expect(attendu).toBe(
      '/connexion?from=%2F3e%2Fmathematiques%2Ftheoreme-de-pythagore%3Fdiapo%3Denonce-prose'
    )
  })

  it('ne redirige qu’une fois, même après plusieurs 401', () => {
    render(<SessionExpireeAlerte />)
    act(() => {
      signalerSessionExpiree()
      signalerSessionExpiree()
    })
    act(() => vi.advanceTimersByTime(DELAI_REDIRECTION_MS * 2))
    expect(assign).toHaveBeenCalledOnce()
  })

  it('ne fait rien sur la page de connexion elle-même', () => {
    vi.stubGlobal('location', { pathname: '/connexion', search: '', assign })
    render(<SessionExpireeAlerte />)
    act(() => signalerSessionExpiree())
    act(() => vi.advanceTimersByTime(DELAI_REDIRECTION_MS))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(assign).not.toHaveBeenCalled()
  })
})
