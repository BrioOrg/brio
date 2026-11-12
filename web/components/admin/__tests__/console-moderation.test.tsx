import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SIGNALEMENT = {
  cibleType: 'reponse',
  cibleId: 'r1',
  questionId: 'q1',
  auteurPseudonyme: 'Loutre-Corail',
  extrait: 'une réponse signalée',
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
    fireEvent.click(within(carte).getByRole('button', { name: 'Masquer' }))
    await waitFor(() =>
      expect(appelsPost()).toContain('POST /admin/communaute/reponse/r1/decision')
    )
  })

  it('offre la révocation d’XP pour une réponse utile signalée', async () => {
    await rendre()
    const carte = screen.getByRole('article', { name: /Réponse signalée de Loutre-Corail/ })
    fireEvent.click(within(carte).getByRole('button', { name: /Révoquer l’XP/ }))
    await waitFor(() => {
      const posts = appelsPost().filter((a) => a === 'POST /admin/communaute/reponse/r1/decision')
      expect(posts.length).toBeGreaterThan(0)
    })
  })

  it('accepte une contestation (restaure le contenu)', async () => {
    await rendre()
    const carte = screen.getByRole('article', { name: /Contestation de Renard-Turquoise/ })
    fireEvent.click(within(carte).getByRole('button', { name: /Accepter/ }))
    await waitFor(() => expect(appelsPost()).toContain('POST /admin/communaute/contestations/c1'))
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
