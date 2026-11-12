import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const appelsPost = () =>
  fetchMock.mock.calls
    .map(([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace(/^.*\/api/, '')}`)
    .filter((appel) => appel.startsWith('POST'))

async function rendre(props: { cible: 'question' | 'reponse'; id: string; estAuteur: boolean }) {
  const { BoutonSignaler } = await import('../bouton-signaler')
  render(<BoutonSignaler {...props} />)
}

describe('BoutonSignaler', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('ne propose rien à l’auteur du contenu', async () => {
    await rendre({ cible: 'reponse', id: 'r1', estAuteur: true })
    expect(screen.queryByRole('button', { name: 'Signaler' })).toBeNull()
  })

  it('signale une réponse avec un motif, puis affiche l’état signalé', async () => {
    await rendre({ cible: 'reponse', id: 'r1', estAuteur: false })

    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }))
    fireEvent.change(screen.getByLabelText('Pourquoi signaler ? (facultatif)'), {
      target: { value: 'propos déplacés' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }))

    await waitFor(() => expect(screen.getByText('Signalé')).toBeInTheDocument())
    expect(appelsPost()).toContain('POST /communaute/reponses/r1/signalement')
  })

  it('montre le message du serveur quand le signalement échoue', async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ error: 'Déjà signalé.' }), { status: 422 })
    )
    await rendre({ cible: 'question', id: 'q1', estAuteur: false })

    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }))
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Déjà signalé.'))
  })
})
