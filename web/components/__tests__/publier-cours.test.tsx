import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Brouillon } from '@/lib/cours-editeur'

vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    ...actual,
    listerMesClasses: vi.fn(),
    definirPortees: vi.fn(),
    publierCours: vi.fn(),
  }
})

const brouillon: Brouillon = {
  schemaVersion: 1,
  id: 'c1',
  title: 'Pythagore',
  sections: [
    { id: 's1', title: 'Leçon', kind: 'lesson', blocks: [{ id: 'b1', type: 'prose', text: 'x' }] },
  ],
}

async function setup(overrides: { onPublie?: () => void; onFermer?: () => void } = {}) {
  const { listerMesClasses, definirPortees, publierCours } = await import('@brio/api-client')
  vi.mocked(listerMesClasses).mockResolvedValue([
    { id: 'cl1', libelle: '3e A', niveauCode: '3e' },
    { id: 'cl2', libelle: '3e B', niveauCode: '3e' },
  ])
  const onAvant = vi.fn().mockResolvedValue(undefined)
  const { PublierCours } = await import('../prof/publier-cours')
  render(
    <PublierCours
      coursId="c1"
      brouillon={brouillon}
      classeIdsInitiales={[]}
      onAvantPublicationAction={onAvant}
      onPublieAction={overrides.onPublie ?? vi.fn()}
      onFermerAction={overrides.onFermer ?? vi.fn()}
    />
  )
  return {
    onAvant,
    definirPortees: vi.mocked(definirPortees),
    publierCours: vi.mocked(publierCours),
  }
}

describe('PublierCours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exige au moins une classe avant d’autoriser la publication', async () => {
    await setup()
    await screen.findByRole('checkbox', { name: /3e A/ })
    expect(screen.getByRole('button', { name: 'Publier' })).toBeDisabled()
  })

  it('enregistre, définit les portées, publie, puis confirme la version figée', async () => {
    const user = userEvent.setup()
    const onPublie = vi.fn()
    const { onAvant, definirPortees, publierCours } = await setup({ onPublie })
    publierCours.mockResolvedValue({ coursId: 'c1', version: 1 })
    definirPortees.mockResolvedValue(undefined)

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    await user.click(screen.getByRole('button', { name: 'Publier' }))

    await waitFor(() => expect(publierCours).toHaveBeenCalledWith(expect.any(String), 'c1'))
    expect(onAvant).toHaveBeenCalled()
    expect(definirPortees).toHaveBeenCalledWith(expect.any(String), 'c1', ['cl1'])
    expect(onPublie).toHaveBeenCalledWith(1)
    expect(await screen.findByText(/version 1/i)).toBeInTheDocument()
  })

  it('affiche le motif serveur en cas de 422', async () => {
    const user = userEvent.setup()
    const { CoursApiError } = await import('@brio/api-client')
    const { definirPortees, publierCours } = await setup()
    definirPortees.mockResolvedValue(undefined)
    publierCours.mockRejectedValue(new CoursApiError(422, 'Référence interne cassée'))

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    await user.click(screen.getByRole('button', { name: 'Publier' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Référence interne cassée')
  })
})
