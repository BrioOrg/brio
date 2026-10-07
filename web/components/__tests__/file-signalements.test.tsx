import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const api = vi.hoisted(() => ({
  fileSignalements: vi.fn(),
  masquerMessage: vi.fn(),
  mesClasses: vi.fn(),
  sanctionner: vi.fn(),
}))

vi.mock('@brio/api-client', () => ({ ...api, EntraideError: class extends Error {} }))

import { FileSignalements } from '../prof/file-signalements'

const signalement = {
  id: 's1',
  messageId: 'm1',
  filId: 'f1',
  classeId: 'c1',
  filTitre: 'Question sur les fractions',
  auteurMessageId: 'e2',
  auteurMessageNom: 'Tom',
  extraitMessage: 'un message moqueur',
  signalePar: 'e1',
  motif: 'moqueur',
  createdAt: '2026-10-07T10:00:00Z',
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.mesClasses.mockResolvedValue([{ id: 'c1', libelle: '6e B', niveauCode: '6e' }])
})

describe('FileSignalements', () => {
  it('says when nothing waits', async () => {
    api.fileSignalements.mockResolvedValue([])
    render(<FileSignalements />)
    expect(await screen.findByText('Aucun signalement en attente.')).toBeInTheDocument()
  })

  it('shows a report with its class, excerpt and reason', async () => {
    api.fileSignalements.mockResolvedValue([signalement])
    render(<FileSignalements />)

    const carte = await screen.findByRole('article', { name: /Question sur les fractions/ })
    expect(within(carte).getByText('un message moqueur')).toBeInTheDocument()
    await waitFor(() => expect(carte).toHaveTextContent('6e B'))
    expect(carte).toHaveTextContent('Motif : moqueur')
  })

  it('hides the message and reloads the queue', async () => {
    api.fileSignalements.mockResolvedValueOnce([signalement]).mockResolvedValueOnce([])
    api.masquerMessage.mockResolvedValue(undefined)
    render(<FileSignalements />)

    await userEvent.click(await screen.findByRole('button', { name: /Masquer le message/ }))

    expect(api.masquerMessage).toHaveBeenCalledWith(expect.any(String), 'm1')
    expect(await screen.findByText('Aucun signalement en attente.')).toBeInTheDocument()
  })

  it('sanctions the author in the class of the report', async () => {
    api.fileSignalements.mockResolvedValue([signalement])
    api.sanctionner.mockResolvedValue('sa1')
    render(<FileSignalements />)

    await userEvent.click(await screen.findByRole('button', { name: 'Sanctionner Tom' }))
    const dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).queryByLabelText(/Jusqu’au/)).not.toBeInTheDocument()
    await userEvent.click(within(dialogue).getByRole('radio', { name: /Lecture seule/ }))
    await userEvent.type(within(dialogue).getByLabelText(/Motif/), 'propos blessants')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Appliquer' }))

    expect(api.sanctionner).toHaveBeenCalledWith(expect.any(String), {
      compteId: 'e2',
      classeId: 'c1',
      type: 'lecture_seule',
      motif: 'propos blessants',
      fin: undefined,
    })
    expect(await screen.findByText('Sanction appliquée à Tom.')).toBeInTheDocument()
  })
})
