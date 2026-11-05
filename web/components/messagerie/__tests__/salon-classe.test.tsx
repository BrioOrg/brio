import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  listerSalons: vi.fn(),
  messagesDuSalon: vi.fn(),
  publierDansSalon: vi.fn(),
  signalerMessageSalon: vi.fn(),
}))

vi.mock('@brio/api-client', () => ({
  ...api,
  MessagerieError: class MessagerieError extends Error {
    constructor(
      readonly status: number,
      message: string
    ) {
      super(message)
    }
  },
}))

import { SalonClasse } from '../salon-classe'

const salon = {
  id: 's1',
  classeId: 'c1',
  titre: 'Salon de 6e B',
  statut: 'ouvert',
  nbMessages: 2,
  createdAt: '2026-10-12T09:00:00Z',
}

function message(over: Record<string, unknown>) {
  return {
    id: 'm',
    auteurId: 'e1',
    auteurNom: 'Léa',
    corps: 'Salut la classe',
    statut: 'publie',
    estMoi: false,
    createdAt: '2026-10-12T09:05:00Z',
    ...over,
  }
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
})

describe('SalonClasse', () => {
  it('tells the student the teacher has not opened the salon yet', async () => {
    api.listerSalons.mockResolvedValue([])
    render(<SalonClasse classeId="c1" />)

    expect(await screen.findByText(/n’a pas encore ouvert le salon/)).toBeInTheDocument()
    expect(api.messagesDuSalon).not.toHaveBeenCalled()
  })

  it('shows the salon messages, marking the reader’s own', async () => {
    api.listerSalons.mockResolvedValue([salon])
    api.messagesDuSalon.mockResolvedValue([
      message({ id: 'm1', auteurNom: 'Léa', corps: 'Salut la classe', estMoi: false }),
      message({ id: 'm2', auteurNom: 'Moi', corps: 'Coucou', estMoi: true }),
    ])
    render(<SalonClasse classeId="c1" />)

    expect(await screen.findByText('Salut la classe')).toBeInTheDocument()
    expect(screen.getByText('Coucou')).toBeInTheDocument()
    expect(screen.getByText('Léa')).toBeInTheDocument()
    expect(screen.getByText('Toi')).toBeInTheDocument()
  })

  it('shows only the salon of the given class', async () => {
    api.listerSalons.mockResolvedValue([salon])
    api.messagesDuSalon.mockResolvedValue([])
    render(<SalonClasse classeId="autre" />)

    expect(await screen.findByText(/n’a pas encore ouvert le salon/)).toBeInTheDocument()
    expect(api.messagesDuSalon).not.toHaveBeenCalled()
  })

  it('publishes a message and reloads the thread', async () => {
    const user = userEvent.setup()
    api.listerSalons.mockResolvedValue([salon])
    api.messagesDuSalon.mockResolvedValue([])
    api.publierDansSalon.mockResolvedValue('m-new')
    render(<SalonClasse classeId="c1" />)

    const zone = await screen.findByLabelText('Ton message')
    await user.type(zone, 'Bonjour à tous')
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))

    await waitFor(() =>
      expect(api.publierDansSalon).toHaveBeenCalledWith(
        expect.any(String),
        's1',
        'Bonjour à tous'
      )
    )
    // One load on mount, one after sending.
    expect(api.messagesDuSalon).toHaveBeenCalledTimes(2)
  })
})
