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

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Merci, l’équipe brio va regarder ce message.'
      )
    )
    expect(appelsPost()).toContain('POST /communaute/reponses/r1/signalement')
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(JSON.parse(String(init.body))).toEqual({ motif: 'propos déplacés' })
    expect(document.activeElement).toBe(screen.getByRole('status'))
  })

  it('envoie un motif nul quand rien n’est précisé', async () => {
    await rendre({ cible: 'question', id: 'q1', estAuteur: false })

    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }))
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }))

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(JSON.parse(String(init.body))).toEqual({ motif: null })
  })

  it('place le focus dans le motif à l’ouverture et le rend au bouton à l’annulation', async () => {
    await rendre({ cible: 'reponse', id: 'r1', estAuteur: false })

    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }))
    expect(document.activeElement).toBe(screen.getByLabelText('Pourquoi signaler ? (facultatif)'))

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Signaler' }))
    )
    expect(appelsPost()).toEqual([])
  })

  it('se referme avec Échap', async () => {
    await rendre({ cible: 'reponse', id: 'r1', estAuteur: false })

    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }))
    fireEvent.keyDown(screen.getByLabelText('Pourquoi signaler ? (facultatif)'), { key: 'Escape' })

    expect(await screen.findByRole('button', { name: 'Signaler' })).toBeInTheDocument()
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
