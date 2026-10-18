import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  fileSignalementsSalon: vi.fn(),
  masquerMessageSalon: vi.fn(),
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

import { FileSignalementsSalon } from '../file-signalements-salon'

const signalement = {
  id: 'sig1',
  messageId: 'm1',
  salonId: 's1',
  salonTitre: 'Salon de 6e B',
  auteurMessageId: 'e1',
  auteurMessageNom: 'Léa',
  extraitMessage: 'un message déplacé',
  signalePar: 'e2',
  motif: 'insultant',
  createdAt: '2026-10-12T10:00:00Z',
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
})

describe('FileSignalementsSalon', () => {
  it('shows an empty queue', async () => {
    api.fileSignalementsSalon.mockResolvedValue([])
    render(<FileSignalementsSalon />)

    expect(await screen.findByText('Aucun signalement en attente.')).toBeInTheDocument()
  })

  it('lists a report with its salon, author and reason', async () => {
    api.fileSignalementsSalon.mockResolvedValue([signalement])
    render(<FileSignalementsSalon />)

    expect(await screen.findByText('Salon de 6e B')).toBeInTheDocument()
    expect(screen.getByText('un message déplacé')).toBeInTheDocument()
    expect(screen.getByText('insultant')).toBeInTheDocument()
  })

  it('hides a message and reloads the queue', async () => {
    const user = userEvent.setup()
    api.fileSignalementsSalon.mockResolvedValue([signalement])
    api.masquerMessageSalon.mockResolvedValue(undefined)
    render(<FileSignalementsSalon />)

    await screen.findByText('Salon de 6e B')
    await user.click(screen.getByRole('button', { name: /Masquer le message/ }))

    await waitFor(() =>
      expect(api.masquerMessageSalon).toHaveBeenCalledWith(expect.any(String), 'm1')
    )
    // One load on mount, one after hiding.
    expect(api.fileSignalementsSalon).toHaveBeenCalledTimes(2)
  })
})
