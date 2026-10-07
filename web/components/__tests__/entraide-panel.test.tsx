import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  mesClasses: vi.fn(),
  listerFils: vi.fn(),
  ouvrirFil: vi.fn(),
  consulterFil: vi.fn(),
  repondre: vi.fn(),
  marquerUtile: vi.fn(),
  signaler: vi.fn(),
}))

vi.mock('@brio/api-client', () => ({
  ...api,
  EntraideError: class EntraideError extends Error {
    constructor(
      readonly status: number,
      message: string
    ) {
      super(message)
    }
  },
}))

import { EntraidePanel } from '../entraide/entraide-panel'

const classe6eB = { id: 'c1', libelle: '6e B', niveauCode: '6e' }

const fil = {
  id: 'f1',
  portee: 'exercice',
  porteeRef: 'ex-1',
  titre: 'Je bloque sur la question 2',
  auteurId: 'e1',
  auteurNom: 'Léa',
  statut: 'ouvert',
  resolu: false,
  nbReponses: 2,
  createdAt: '2026-10-07T10:00:00Z',
}

function message(over: Record<string, unknown>) {
  return {
    id: 'm',
    auteurId: 'e1',
    auteurNom: 'Léa',
    corps: 'Pourquoi ?',
    statut: 'publie',
    utile: false,
    estMoi: false,
    createdAt: '2026-10-07T10:00:00Z',
    ...over,
  }
}

function detail(over: Record<string, unknown>) {
  return {
    ...fil,
    estAuteur: false,
    verrouille: false,
    reponsesMasquees: 0,
    messages: [message({ id: 'q' })],
    ...over,
  }
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
})

describe('EntraidePanel', () => {
  it('asks a student with no class to join one, with no form', async () => {
    api.mesClasses.mockResolvedValue([])
    render(<EntraidePanel portee="chapitre" porteeRef="fractions" />)

    expect(await screen.findByText(/Rejoins ta classe/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Poser une question/ })).not.toBeInTheDocument()
    expect(api.listerFils).not.toHaveBeenCalled()
  })

  it("lists the threads of the student's class, without a class picker", async () => {
    api.mesClasses.mockResolvedValue([classe6eB])
    api.listerFils.mockResolvedValue([fil])
    render(<EntraidePanel portee="exercice" porteeRef="ex-1" />)

    expect(await screen.findByText('Je bloque sur la question 2')).toBeInTheDocument()
    expect(screen.getByText('2 réponses')).toBeInTheDocument()
    expect(screen.queryByLabelText('Classe')).not.toBeInTheDocument()
    expect(api.listerFils).toHaveBeenCalledWith(expect.any(String), 'exercice', 'ex-1', 'c1')
  })

  it('lets a teacher with two classes pick one', async () => {
    api.mesClasses.mockResolvedValue([classe6eB, { id: 'c2', libelle: '6e C', niveauCode: '6e' }])
    api.listerFils.mockResolvedValue([])
    render(<EntraidePanel portee="chapitre" porteeRef="fractions" />)

    await userEvent.selectOptions(await screen.findByLabelText('Classe'), 'c2')
    await waitFor(() =>
      expect(api.listerFils).toHaveBeenLastCalledWith(
        expect.any(String),
        'chapitre',
        'fractions',
        'c2'
      )
    )
  })

  it('opens the new thread after asking a question', async () => {
    api.mesClasses.mockResolvedValue([classe6eB])
    api.listerFils.mockResolvedValue([])
    api.ouvrirFil.mockResolvedValue('f9')
    api.consulterFil.mockResolvedValue(
      detail({
        id: 'f9',
        titre: 'Ma question',
        estAuteur: true,
        messages: [message({ estMoi: true })],
      })
    )
    render(<EntraidePanel portee="chapitre" porteeRef="fractions" />)

    await userEvent.click(await screen.findByRole('button', { name: /Poser une question/ }))
    await userEvent.type(screen.getByLabelText('Ta question en une ligne'), 'Ma question')
    await userEvent.type(screen.getByLabelText('Explique ce qui te bloque'), 'Je ne comprends pas.')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(api.ouvrirFil).toHaveBeenCalledWith(expect.any(String), {
      portee: 'chapitre',
      porteeRef: 'fractions',
      classeId: 'c1',
      titre: 'Ma question',
      question: 'Je ne comprends pas.',
    })
    expect(await screen.findByRole('heading', { name: 'Ma question' })).toBeInTheDocument()
  })

  it("shows the server's refusal when a question is rejected", async () => {
    api.mesClasses.mockResolvedValue([classe6eB])
    api.listerFils.mockResolvedValue([])
    const { EntraideError } = await import('@brio/api-client')
    api.ouvrirFil.mockRejectedValue(
      new EntraideError(422, "Les liens externes ne sont pas autorisés dans l'entraide.")
    )
    render(<EntraidePanel portee="chapitre" porteeRef="fractions" />)

    await userEvent.click(await screen.findByRole('button', { name: /Poser une question/ }))
    await userEvent.type(screen.getByLabelText('Ta question en une ligne'), 'Regarde')
    await userEvent.type(screen.getByLabelText('Explique ce qui te bloque'), 'www.exemple.fr')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Les liens externes')
  })
})

describe('FilEntraide (through the panel)', () => {
  async function ouvrir(d: ReturnType<typeof detail>) {
    api.mesClasses.mockResolvedValue([classe6eB])
    api.listerFils.mockResolvedValue([fil])
    api.consulterFil.mockResolvedValue(d)
    render(<EntraidePanel portee="exercice" porteeRef="ex-1" />)
    await userEvent.click(await screen.findByText('Je bloque sur la question 2'))
  }

  it('says how many answers stay hidden until the exercise is submitted', async () => {
    await ouvrir(detail({ verrouille: true, reponsesMasquees: 3 }))

    expect(await screen.findByRole('status')).toHaveTextContent('3 réponses masquées')
    expect(screen.getByRole('status')).toHaveTextContent('Réponds d’abord à l’exercice')
  })

  it('lets the author keep a classmate answer as useful, and shows no XP', async () => {
    const d = detail({
      estAuteur: true,
      messages: [message({ id: 'q', estMoi: true }), message({ id: 'r1', auteurNom: 'Tom' })],
    })
    await ouvrir(d)
    api.marquerUtile.mockResolvedValue(undefined)

    await userEvent.click(await screen.findByRole('button', { name: /Ça m’a aidé/ }))

    expect(api.marquerUtile).toHaveBeenCalledWith(expect.any(String), 'f1', 'r1')
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument()
  })

  it('does not offer "Ça m’a aidé" to a reader who is not the author', async () => {
    await ouvrir(
      detail({ messages: [message({ id: 'q' }), message({ id: 'r1', auteurNom: 'Tom' })] })
    )

    await screen.findByText('Tom')
    expect(screen.queryByRole('button', { name: /Ça m’a aidé/ })).not.toBeInTheDocument()
  })

  it('reports a message with an optional reason', async () => {
    await ouvrir(
      detail({ messages: [message({ id: 'q' }), message({ id: 'r1', auteurNom: 'Tom' })] })
    )
    api.signaler.mockResolvedValue(undefined)

    await userEvent.click(await screen.findByRole('button', { name: /Signaler/ }))
    await userEvent.type(screen.getByLabelText(/Pourquoi ce message/), 'moqueur')
    await userEvent.click(screen.getByRole('button', { name: 'Signaler au professeur' }))

    expect(api.signaler).toHaveBeenCalledWith(expect.any(String), 'r1', 'moqueur')
    expect(await screen.findByText(/ton professeur va regarder/)).toBeInTheDocument()
  })

  it('posts an answer and reloads the thread', async () => {
    await ouvrir(detail({}))
    api.repondre.mockResolvedValue('r2')

    await userEvent.type(await screen.findByLabelText('Ta réponse'), 'Regarde la définition.')
    await userEvent.click(screen.getByRole('button', { name: 'Répondre' }))

    expect(api.repondre).toHaveBeenCalledWith(expect.any(String), 'f1', 'Regarde la définition.')
    await waitFor(() => expect(api.consulterFil).toHaveBeenCalledTimes(2))
  })
})
