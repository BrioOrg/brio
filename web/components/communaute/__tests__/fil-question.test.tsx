import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuestionDetail, ReponseCommunaute } from '@brio/api-client'

const refresh = vi.fn()
const push = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
// The composer has its own tests, and jsdom has no contentEditable.
vi.mock('@/components/communaute/editeur-message', () => ({
  EditeurMessage: ({ mode }: { mode: string }) => <div>éditeur {mode}</div>,
}))

const REPONSE: ReponseCommunaute = {
  id: 'r1',
  corps: [{ id: 'b1', type: 'prose', text: 'Une réponse.' }],
  auteur: { pseudonyme: 'Loutre-Corail', niveau: '5e' },
  nombreUtile: 2,
  aVote: false,
  estAuteur: false,
  aResolu: false,
  modifie: false,
  createdAt: '2026-10-20T16:00:00Z',
  commentaires: [],
}

const QUESTION: QuestionDetail = {
  id: 'q1',
  titre: 'Ma question',
  corps: [{ id: 'b1', type: 'prose', text: 'Le corps.' }],
  auteur: { pseudonyme: 'Renard-Turquoise', niveau: '3e' },
  niveau: '3e',
  matiere: 'mathematiques',
  resolue: false,
  nombreUtile: 0,
  aVote: false,
  estAuteur: false,
  modifie: false,
  createdAt: '2026-10-20T16:00:00Z',
  reponses: [REPONSE],
}

const fetchMock = vi.fn()

async function rendre(question: Partial<QuestionDetail> = {}) {
  const { FilQuestion } = await import('../fil-question')
  render(<FilQuestion question={{ ...QUESTION, ...question }} />)
}

const appels = () =>
  fetchMock.mock.calls
    .map(([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace(/^.*\/api/, '')}`)
    .filter((appel) => !appel.startsWith('GET'))

describe('FilQuestion', () => {
  beforeEach(() => {
    vi.resetModules()
    refresh.mockClear()
    push.mockClear()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('shows each author as a pseudonym and level', async () => {
    await rendre()
    expect(screen.getByText('Renard-Turquoise · 3e')).toBeInTheDocument()
    expect(screen.getByText('Loutre-Corail · 5e')).toBeInTheDocument()
  })

  it('shows an account that can no longer be found without a level', async () => {
    await rendre({ auteur: { pseudonyme: 'Membre', niveau: null } })
    expect(screen.getByText('Membre')).toBeInTheDocument()
  })

  it('offers the resolution to the question’s author only', async () => {
    await rendre()
    expect(screen.queryByRole('button', { name: 'Marquer comme résolue' })).toBeNull()
  })

  it('does not offer to keep one’s own answer', async () => {
    await rendre({ estAuteur: true, reponses: [{ ...REPONSE, estAuteur: true }] })
    expect(screen.queryByRole('button', { name: 'Marquer comme résolue' })).toBeNull()
  })

  it('marks an answer as solving, then reloads the thread', async () => {
    await rendre({ estAuteur: true })
    fireEvent.click(screen.getByRole('button', { name: 'Marquer comme résolue' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(appels()).toContain('POST /communaute/questions/q1/reponses/r1/resolution')
  })

  it('no longer offers it once the question is solved, and shows which answer did', async () => {
    await rendre({
      estAuteur: true,
      resolue: true,
      reponses: [{ ...REPONSE, aResolu: true }],
    })
    expect(screen.queryByRole('button', { name: 'Marquer comme résolue' })).toBeNull()
    expect(screen.getByText('Résolue')).toBeInTheDocument()
    expect(screen.getByText('A résolu la question')).toBeInTheDocument()
  })

  it('shows the server’s message when the resolution fails', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: 'Cette question est déjà résolue.' }), { status: 409 })
    )
    await rendre({ estAuteur: true })
    fireEvent.click(screen.getByRole('button', { name: 'Marquer comme résolue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette question est déjà résolue.')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('votes, and takes the vote back', async () => {
    await rendre()
    const liste = screen.getAllByRole('button', { name: /^Utile/ })
    expect(liste[1]).toHaveAccessibleName('Utile · 2')
    expect(liste[1]).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(liste[1]!)
    await waitFor(() => expect(appels()).toContain('PUT /communaute/reponses/r1/vote'))
  })

  it('takes a vote back with a DELETE', async () => {
    await rendre({ aVote: true, nombreUtile: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Utile · 1', pressed: true }))
    await waitFor(() => expect(appels()).toContain('DELETE /communaute/questions/q1/vote'))
  })

  it('shows the count but no vote button on one’s own message', async () => {
    await rendre({ estAuteur: true, nombreUtile: 3, reponses: [] })
    expect(screen.queryByRole('button', { name: /^Utile/ })).toBeNull()
    expect(screen.getByText('3 votes « Utile »')).toBeInTheDocument()
  })

  it('offers no edit or delete on someone else’s message', async () => {
    await rendre()
    expect(screen.queryByRole('button', { name: /^Modifier/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Supprimer/ })).toBeNull()
  })

  it('lists comments with no vote and no way to comment on them', async () => {
    await rendre({
      reponses: [
        {
          ...REPONSE,
          commentaires: [
            {
              id: 'c1',
              corps: [{ id: 'b1', type: 'prose', text: 'Un commentaire.' }],
              auteur: { pseudonyme: 'Hibou-Corail', niveau: '4e' },
              estAuteur: false,
              modifie: true,
              createdAt: '2026-10-20T17:00:00Z',
            },
          ],
        },
      ],
    })
    const commentaires = within(screen.getByRole('list', { name: 'Commentaires' }))
    expect(commentaires.getByText('Un commentaire.')).toBeInTheDocument()
    expect(commentaires.getByText(/modifié/)).toBeInTheDocument()
    expect(commentaires.queryByRole('button')).toBeNull()
  })

  it('opens the comment composer on demand', async () => {
    await rendre()
    expect(screen.queryByText('éditeur commentaire')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Commenter' }))
    expect(screen.getByText('éditeur commentaire')).toBeInTheDocument()
  })

  it('asks before deleting, warns when it reopens the question, and can be cancelled', async () => {
    await rendre({
      resolue: true,
      reponses: [{ ...REPONSE, estAuteur: true, aResolu: true }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer ma réponse' }))
    expect(screen.getByText(/La question redeviendra non résolue/)).toBeInTheDocument()
    expect(appels()).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Garder' }))
    expect(screen.queryByText(/La question redeviendra non résolue/)).toBeNull()
    expect(appels()).toEqual([])
  })

  it('goes back to the list once the question is deleted', async () => {
    await rendre({ estAuteur: true, reponses: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer ma question' }))
    fireEvent.click(screen.getByRole('button', { name: 'Oui, supprimer' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/communaute'))
    expect(appels()).toContain('DELETE /communaute/questions/q1')
  })

  it('says it when a thread has no answer yet', async () => {
    await rendre({ reponses: [] })
    expect(screen.getByRole('heading', { name: 'Pas encore de réponse' })).toBeInTheDocument()
  })
})
