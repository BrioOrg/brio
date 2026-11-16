import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))

const ELEVE = { id: 'e1', role: 'eleve', statut: 'actif', nom: null, email: null }

async function setup(moi: unknown) {
  const session = await import('@/lib/session')
  vi.mocked(session.getMoi).mockResolvedValue(moi as Awaited<ReturnType<typeof session.getMoi>>)
  const { AvisReinitialisation } = await import('../avis-reinitialisation')
  return render(<AvisReinitialisation />)
}

// ADR 0036 §8 (arbitrage N3) : après une réinitialisation, l'élève est prévenu à la première page
// qui suit le changement de mot de passe. Rien n'est inventé : date et auteur viennent du serveur.
describe('AvisReinitialisation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('prévient l’élève de la réinitialisation par son prof, datée', async () => {
    await setup({ ...ELEVE, accesReinitialise: { le: '2026-11-16T09:00:00Z', par: 'enseignant' } })
    const avis = await screen.findByRole('status')
    expect(avis).toHaveTextContent(/ton accès a été réinitialisé le 16 novembre 2026 par ton prof/i)
    expect(avis).toHaveTextContent(
      /si ce n’est pas toi qui as choisi ton mot de passe, préviens ton prof/i
    )
  })

  it('nomme l’équipe brio quand c’est elle qui a réinitialisé', async () => {
    await setup({ ...ELEVE, accesReinitialise: { le: '2026-11-16T09:00:00Z', par: 'admin_brio' } })
    expect(await screen.findByRole('status')).toHaveTextContent(/par l’équipe brio/i)
  })

  it('ne montre rien sans réinitialisation', async () => {
    await setup({ ...ELEVE, accesReinitialise: null })
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('se ferme et ne revient pas sur cet appareil pour la même réinitialisation', async () => {
    const moi = { ...ELEVE, accesReinitialise: { le: '2026-11-16T09:00:00Z', par: 'enseignant' } }
    const { unmount } = await setup(moi)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Fermer ce message' }))
    expect(screen.queryByRole('status')).toBeNull()
    unmount()

    await setup(moi)
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(screen.queryByRole('status')).toBeNull()

    // A later reset is told again.
    await setup({ ...ELEVE, accesReinitialise: { le: '2026-11-20T09:00:00Z', par: 'enseignant' } })
    expect(await screen.findByRole('status')).toHaveTextContent(/20 novembre 2026/)
  })
})
