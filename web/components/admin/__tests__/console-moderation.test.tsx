import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SIGNALEMENT = {
  cibleType: 'reponse',
  cibleId: 'r1',
  questionId: 'q1',
  auteurPseudonyme: 'Loutre-Corail',
  extrait: 'une réponse signalée',
  extraitAuSignalement: 'une réponse signalée',
  statutContenu: 'publie',
  estReponseResolue: true,
  xpDejaRevoquee: false,
  nombreSignalements: 2,
  motifs: ['spam'],
  premierSignalementAt: '2026-11-10T10:00:00Z',
}

const CONTESTATION = {
  id: 'c1',
  cibleType: 'question',
  cibleId: 'q1',
  questionId: 'q1',
  auteurPseudonyme: 'Renard-Turquoise',
  extrait: 'ma question masquée',
  message: 'je conteste cette décision',
  decisionAction: 'masquer',
  decisionMotif: 'hors sujet',
  statutContenu: 'masque',
  createdAt: '2026-11-11T10:00:00Z',
}

const fetchMock = vi.fn()

function reponse(url: string, method: string): Response {
  if (method === 'GET' && url.includes('/admin/communaute/signalements')) {
    return new Response(JSON.stringify([SIGNALEMENT]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (method === 'GET' && url.includes('/admin/communaute/contestations')) {
    return new Response(JSON.stringify([CONTESTATION]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (method === 'POST' && url.includes('/decision')) {
    return new Response(JSON.stringify({ id: 'd1' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }
  return new Response(null, { status: 204 })
}

/** Le corps JSON du dernier POST vers une URL qui contient `fragment`. */
const corpsPost = (fragment: string): unknown => {
  const appel = fetchMock.mock.calls
    .filter(([url, init]) => init?.method === 'POST' && String(url).includes(fragment))
    .at(-1)
  return appel ? JSON.parse(String(appel[1].body)) : undefined
}

const appelsPost = () =>
  fetchMock.mock.calls
    .map(([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace(/^.*\/api/, '')}`)
    .filter((appel) => appel.startsWith('POST'))

async function rendre() {
  const { ConsoleModeration } = await import('../console-moderation')
  render(<ConsoleModeration />)
  await screen.findByText('une réponse signalée')
}

describe('ConsoleModeration', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      reponse(String(url), init?.method ?? 'GET')
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  it('affiche les contenus signalés et les contestations', async () => {
    await rendre()
    expect(screen.getByText('une réponse signalée')).toBeInTheDocument()
    expect(screen.getByText(/Loutre-Corail/)).toBeInTheDocument()
    expect(screen.getByText(/je conteste cette décision/)).toBeInTheDocument()
  })

  it('masque un contenu signalé', async () => {
    await rendre()
    const carte = screen.getByRole('article', { name: /Réponse signalée de Loutre-Corail/ })
    fireEvent.change(within(carte).getByLabelText('Motif de la décision (facultatif)'), {
      target: { value: 'insulte' },
    })
    fireEvent.click(within(carte).getByRole('button', { name: 'Masquer' }))
    await waitFor(() =>
      expect(appelsPost()).toContain('POST /admin/communaute/reponse/r1/decision')
    )
    expect(corpsPost('/reponse/r1/decision')).toEqual({ action: 'masquer', motif: 'insulte' })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Contenu masqué.'))
  })

  it('demande confirmation avant de supprimer', async () => {
    await rendre()
    const carte = screen.getByRole('article', { name: /Réponse signalée de Loutre-Corail/ })
    fireEvent.click(within(carte).getByRole('button', { name: 'Supprimer' }))
    expect(appelsPost()).toEqual([])
    expect(within(carte).getByText(/Supprimer définitivement ce contenu/)).toBeInTheDocument()

    fireEvent.click(within(carte).getByRole('button', { name: 'Annuler' }))
    expect(appelsPost()).toEqual([])
    fireEvent.click(within(carte).getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(carte).getByRole('button', { name: 'Oui, supprimer' }))

    await waitFor(() =>
      expect(corpsPost('/reponse/r1/decision')).toMatchObject({ action: 'supprimer' })
    )
  })

  it('rejette un signalement sans toucher au contenu', async () => {
    await rendre()
    const carte = screen.getByRole('article', { name: /Réponse signalée de Loutre-Corail/ })
    fireEvent.click(within(carte).getByRole('button', { name: /Rejeter le signalement/ }))
    await waitFor(() =>
      expect(corpsPost('/reponse/r1/decision')).toMatchObject({ action: 'rejeter' })
    )
  })

  it('montre ce que le membre a lu quand l’auteur a modifié son message depuis', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (
        String(url).includes('/admin/communaute/signalements') &&
        (init?.method ?? 'GET') === 'GET'
      ) {
        return new Response(
          JSON.stringify([{ ...SIGNALEMENT, extraitAuSignalement: 'le texte blessant d’origine' }]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return reponse(String(url), init?.method ?? 'GET')
    })
    await rendre()
    expect(screen.getByText('le texte blessant d’origine')).toBeInTheDocument()
    expect(screen.getByText(/Au moment du signalement/)).toBeInTheDocument()
  })

  it('offre la révocation d’XP pour une réponse utile signalée', async () => {
    await rendre()
    const carte = screen.getByRole('article', { name: /Réponse signalée de Loutre-Corail/ })
    fireEvent.click(within(carte).getByRole('button', { name: /Révoquer l’XP/ }))
    expect(appelsPost()).toEqual([])
    fireEvent.click(within(carte).getByRole('button', { name: /Oui, révoquer l’XP/ }))
    await waitFor(() =>
      expect(corpsPost('/reponse/r1/decision')).toMatchObject({ action: 'revoquer_xp' })
    )
  })

  it('n’offre pas la révocation d’XP sur une réponse non retenue', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (
        String(url).includes('/admin/communaute/signalements') &&
        (init?.method ?? 'GET') === 'GET'
      ) {
        return new Response(JSON.stringify([{ ...SIGNALEMENT, estReponseResolue: false }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return reponse(String(url), init?.method ?? 'GET')
    })
    await rendre()
    expect(screen.queryByRole('button', { name: /Révoquer l’XP/ })).toBeNull()
  })

  it('accepte une contestation (restaure le contenu)', async () => {
    await rendre()
    const carte = screen.getByRole('article', { name: /Contestation de Renard-Turquoise/ })
    fireEvent.click(within(carte).getByRole('button', { name: 'Accepter et restaurer' }))
    await waitFor(() => expect(appelsPost()).toContain('POST /admin/communaute/contestations/c1'))
    expect(corpsPost('/contestations/c1')).toMatchObject({ accepter: true })
  })

  it('rejette une contestation', async () => {
    await rendre()
    const carte = screen.getByRole('article', { name: /Contestation de Renard-Turquoise/ })
    fireEvent.click(within(carte).getByRole('button', { name: 'Rejeter la contestation' }))
    await waitFor(() => expect(corpsPost('/contestations/c1')).toMatchObject({ accepter: false }))
  })

  it('affiche la décision contestée en clair', async () => {
    await rendre()
    const carte = screen.getByRole('article', { name: /Contestation de Renard-Turquoise/ })
    expect(within(carte).getByText('Décision : masqué')).toBeInTheDocument()
  })

  it('n’offre pas la révocation quand l’XP est déjà révoquée', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (
        String(url).includes('/admin/communaute/signalements') &&
        (init?.method ?? 'GET') === 'GET'
      ) {
        return new Response(JSON.stringify([{ ...SIGNALEMENT, xpDejaRevoquee: true }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return reponse(String(url), init?.method ?? 'GET')
    })
    await rendre()
    expect(screen.queryByRole('button', { name: /Révoquer l’XP/ })).toBeNull()
  })
})
