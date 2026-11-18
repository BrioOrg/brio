import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// PL-7 (#399): the teacher reads, writes and hides messages in a class salon, from the class
// page. Written from the acceptance criteria and the UI spec (porte 2, U5 copy), not from the
// component. The real client is kept (MessagerieError included); only the network calls are mocked.
vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    ...actual,
    listerSalons: vi.fn(),
    messagesDuSalon: vi.fn(),
    publierDansSalon: vi.fn(),
    masquerMessageSalon: vi.fn(),
    signalerMessageSalon: vi.fn(),
    creerSalon: vi.fn(),
  }
})

import * as client from '@brio/api-client'
import { MessagerieError, type SalonMessageVue, type SalonVue } from '@brio/api-client'

import { SalonClasseProf } from '../salon-classe-prof'

const api = {
  messagesDuSalon: vi.mocked(client.messagesDuSalon),
  publierDansSalon: vi.mocked(client.publierDansSalon),
  masquerMessageSalon: vi.mocked(client.masquerMessageSalon),
  signalerMessageSalon: vi.mocked(client.signalerMessageSalon),
  listerSalons: vi.mocked(client.listerSalons),
  creerSalon: vi.mocked(client.creerSalon),
}

const SALON: SalonVue = {
  id: 's1',
  classeId: 'c1',
  titre: 'Salon de la 3e C',
  statut: 'ouvert',
  nbMessages: 2,
  createdAt: '2026-10-12T08:00:00Z',
}

function message(over: Partial<SalonMessageVue>): SalonMessageVue {
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

const DU_PROF = message({
  id: 'm0',
  auteurId: 'p1',
  auteurNom: 'M. Dubois',
  corps: 'Bonjour la 3e C, le salon est ouvert.',
  estMoi: true,
  createdAt: '2026-10-12T09:00:00Z',
})
const DE_LEA = message({ id: 'm1', corps: 'Bonjour monsieur !', createdAt: '2026-10-12T09:05:00Z' })
const MASQUE = message({
  id: 'm2',
  auteurId: 'e2',
  auteurNom: 'Noé',
  corps: 'Un message hors sujet',
  statut: 'masque',
  createdAt: '2026-10-12T09:10:00Z',
})

/** A promise the test settles itself, to order concurrent responses. */
function differe<T>() {
  let resoudre: (valeur: T) => void = () => {}
  const promesse = new Promise<T>((r) => {
    resoudre = r
  })
  return { promesse, resoudre }
}

/** The <article> that holds a message body. */
function article(corps: string): HTMLElement {
  const el = screen.getByText(corps).closest('article')
  if (!el) throw new Error(`no article around « ${corps} »`)
  return el
}

const ZONE = 'Ton message à la classe'

beforeEach(() => {
  // Lesson of #377: a mock left over from the previous test makes a test meaningless.
  Object.values(api).forEach((f) => f.mockReset())
})

describe('SalonClasseProf', () => {
  // critère 1 + critère 4
  it('shows the messages in the server order, with author, « Toi » and time; a hidden one is marked « Masqué »', async () => {
    api.messagesDuSalon.mockResolvedValue([DU_PROF, DE_LEA, MASQUE])
    render(<SalonClasseProf salon={SALON} />)

    const liste = await screen.findByRole('list', { name: 'Messages du salon' })
    await within(liste).findByText('Bonjour monsieur !')
    expect(api.messagesDuSalon).toHaveBeenCalledWith(expect.any(String), 's1')

    // Chronological: the order of the response, not re-sorted.
    const textes = within(liste)
      .getAllByRole('article')
      .map((a) => a.textContent ?? '')
    expect(textes).toHaveLength(3)
    expect(textes[0]).toContain('Bonjour la 3e C, le salon est ouvert.')
    expect(textes[1]).toContain('Bonjour monsieur !')
    expect(textes[2]).toContain('Un message hors sujet')

    // Author: « Toi » for the teacher's own, the name otherwise; each one carries its date.
    expect(within(article('Bonjour la 3e C, le salon est ouvert.')).getByText('Toi')).toBeVisible()
    expect(article('Bonjour la 3e C, le salon est ouvert.')).not.toHaveTextContent('M. Dubois')
    expect(within(article('Bonjour monsieur !')).getByText('Léa')).toBeVisible()
    for (const a of within(liste).getAllByRole('article')) {
      expect(a.textContent).toMatch(/12\s*oct|12\/10/i)
    }

    // critère 4: the hidden message is there, marked, and distinct from a visible one.
    expect(within(article('Un message hors sujet')).getByText('Masqué')).toBeVisible()
    expect(within(article('Un message hors sujet')).getByText('Noé')).toBeVisible()
    expect(within(article('Bonjour monsieur !')).queryByText('Masqué')).toBeNull()
    expect(
      within(article('Bonjour la 3e C, le salon est ouvert.')).queryByText('Masqué')
    ).toBeNull()
  })

  // critère 4 + critère 3: « Masquer » on every visible message, never on a hidden one
  it('offers « Masquer » on visible messages only, and never « Signaler »', async () => {
    api.messagesDuSalon.mockResolvedValue([DU_PROF, DE_LEA, MASQUE])
    render(<SalonClasseProf salon={SALON} />)
    await screen.findByText('Bonjour monsieur !')

    expect(
      within(article('Bonjour monsieur !')).getByRole('button', {
        name: 'Masquer le message de Léa',
      })
    ).toBeVisible()
    expect(
      within(article('Bonjour la 3e C, le salon est ouvert.')).getByRole('button', {
        name: 'Masquer ton message',
      })
    ).toBeVisible()
    expect(within(article('Un message hors sujet')).queryByRole('button')).toBeNull()

    // No student tool on the teacher's screen.
    expect(screen.queryByRole('button', { name: /signaler/i })).toBeNull()
    expect(screen.queryByText(/signaler ce message/i)).toBeNull()
    expect(api.signalerMessageSalon).not.toHaveBeenCalled()
  })

  // critère 6: the copy speaks to an adult
  it('never addresses a student', async () => {
    api.messagesDuSalon.mockResolvedValue([DU_PROF, DE_LEA, MASQUE])
    render(<SalonClasseProf salon={SALON} />)
    await screen.findByText('Bonjour monsieur !')

    expect(screen.queryByText(/ton professeur/i)).toBeNull()
    expect(document.body).not.toHaveTextContent(/ton professeur/i)
    expect(document.body).not.toHaveTextContent(/ton prof\b/i)
    // The help under the field promises only what the salon checks (no phone number: issue 403).
    expect(screen.getByText(/Pas de lien externe/)).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/téléphone/i)
    // The field is labelled for the teacher.
    expect(screen.getByLabelText(ZONE)).toBeInTheDocument()
  })

  // critère 1 (salon vide) + critère 6
  it('invites the teacher to write the first message in an empty salon', async () => {
    api.messagesDuSalon.mockResolvedValue([])
    render(<SalonClasseProf salon={SALON} />)

    expect(await screen.findByText(/Personne n.a encore écrit dans ce salon/)).toBeInTheDocument()
    expect(screen.getByLabelText(ZONE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument()
  })

  // critère 2
  it('publishes a message, reloads the thread and shows it as « Toi »', async () => {
    const user = userEvent.setup()
    api.messagesDuSalon.mockResolvedValueOnce([DE_LEA]).mockResolvedValueOnce([
      DE_LEA,
      message({
        id: 'm9',
        auteurId: 'p1',
        auteurNom: 'M. Dubois',
        corps: 'Pensez au contrôle de jeudi.',
        estMoi: true,
      }),
    ])
    api.publierDansSalon.mockResolvedValue('m9')
    render(<SalonClasseProf salon={SALON} />)

    const zone = await screen.findByLabelText(ZONE)
    await user.type(zone, 'Pensez au contrôle de jeudi.')
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))

    await waitFor(() =>
      expect(api.publierDansSalon).toHaveBeenCalledWith(
        expect.any(String),
        's1',
        'Pensez au contrôle de jeudi.'
      )
    )
    expect(await screen.findByText('Pensez au contrôle de jeudi.')).toBeInTheDocument()
    expect(within(article('Pensez au contrôle de jeudi.')).getByText('Toi')).toBeVisible()
    // One load on mount, one after sending; the field is emptied only after a success.
    expect(api.messagesDuSalon).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.getByLabelText(ZONE)).toHaveValue(''))
  })

  // critère 2: a link refused (422) shows the screen's own text, not the server's « …dans
  // l'entraide », and keeps the typed text. Non-breaking spaces before « : » and in « 2 000 ».
  it('replaces the 422 on sending by the screen text and keeps the text', async () => {
    const user = userEvent.setup()
    api.messagesDuSalon.mockResolvedValue([DE_LEA])
    api.publierDansSalon.mockRejectedValue(
      new MessagerieError(422, "Les liens externes ne sont pas autorisés dans l'entraide.")
    )
    render(<SalonClasseProf salon={SALON} />)

    const saisi = 'Regardez www.exemple.org pour jeudi'
    const zone = await screen.findByLabelText(ZONE)
    await user.type(zone, saisi)
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(
      /Ton message n.est pas parti : pas de lien externe, 2 000 caractères au plus\. Ton texte est gardé\./
    )
    expect(alerte.textContent).toMatch(/parti[\u00a0\u202f]:/)
    expect(alerte.textContent).toMatch(/2[\u00a0\u202f]000/)
    expect(document.body).not.toHaveTextContent(/entraide/i)
    expect(screen.getByLabelText(ZONE)).toHaveValue(saisi)
    expect(screen.queryByText(saisi, { selector: 'article *' })).toBeNull()
  })

  // critère 2: other refusals are readable and the typed text is kept (phone left out: issue 403)
  it.each([
    [429, 'Vous écrivez trop vite. Patientez un instant.'],
    [403, 'Votre accès à la messagerie est en lecture seule.'],
  ])('shows the server refusal %i and keeps the text', async (status, texte) => {
    const user = userEvent.setup()
    api.messagesDuSalon.mockResolvedValue([DE_LEA])
    api.publierDansSalon.mockRejectedValue(new MessagerieError(status, texte))
    render(<SalonClasseProf salon={SALON} />)

    const saisi = 'Regardez www.exemple.org pour jeudi'
    const zone = await screen.findByLabelText(ZONE)
    await user.type(zone, saisi)
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(texte)
    expect(screen.getByLabelText(ZONE)).toHaveValue(saisi)
    // Nothing reloaded or added on a refusal.
    expect(screen.queryByText(saisi, { selector: 'article *' })).toBeNull()
  })

  // critère 2: a network failure says the text is kept, and keeps it
  it('keeps the text when the network fails', async () => {
    const user = userEvent.setup()
    api.messagesDuSalon.mockResolvedValue([DE_LEA])
    api.publierDansSalon.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<SalonClasseProf salon={SALON} />)

    const zone = await screen.findByLabelText(ZONE)
    await user.type(zone, 'Rendez-vous lundi')
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/n.est pas parti/)
    expect(screen.getByLabelText(ZONE)).toHaveValue('Rendez-vous lundi')
  })

  // critère 3
  it('hides a student message only after confirmation, then marks it « Masqué »', async () => {
    const user = userEvent.setup()
    api.messagesDuSalon
      .mockResolvedValueOnce([DE_LEA])
      .mockResolvedValueOnce([{ ...DE_LEA, statut: 'masque' }])
    api.masquerMessageSalon.mockResolvedValue(undefined)
    render(<SalonClasseProf salon={SALON} />)
    await screen.findByText('Bonjour monsieur !')

    // Cancelling calls nothing.
    await user.click(screen.getByRole('button', { name: 'Masquer le message de Léa' }))
    let dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).getByText('Masquer ce message ?')).toBeInTheDocument()
    // The confirmation tells what happens, and that it cannot be undone.
    expect(dialogue).toHaveTextContent(/ne le verront plus/)
    expect(dialogue).toHaveTextContent(/ne pourras pas le réafficher/)
    await user.click(within(dialogue).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.masquerMessageSalon).not.toHaveBeenCalled()

    // Confirming hides it.
    await user.click(screen.getByRole('button', { name: 'Masquer le message de Léa' }))
    dialogue = await screen.findByRole('dialog')
    await user.click(within(dialogue).getByRole('button', { name: 'Masquer' }))

    await waitFor(() =>
      expect(api.masquerMessageSalon).toHaveBeenCalledWith(expect.any(String), 'm1')
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await within(article('Bonjour monsieur !')).findByText('Masqué')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Masquer le message de Léa' })).toBeNull()
    expect(api.messagesDuSalon).toHaveBeenCalledTimes(2)
  })

  // critère 3: the teacher's own message has its own confirmation title
  it('asks « Masquer ton message ? » for the teacher’s own message', async () => {
    const user = userEvent.setup()
    api.messagesDuSalon.mockResolvedValue([DU_PROF])
    render(<SalonClasseProf salon={SALON} />)
    await screen.findByText('Bonjour la 3e C, le salon est ouvert.')

    await user.click(screen.getByRole('button', { name: 'Masquer ton message' }))
    expect(
      within(await screen.findByRole('dialog')).getByText('Masquer ton message ?')
    ).toBeVisible()
  })

  // critère 3: a 404 shows the screen's own text, never the server's UUID
  it('replaces the server 404 on hiding by a text without the UUID, and keeps the dialog open', async () => {
    const user = userEvent.setup()
    const uuid = '6f1c2b7e-5d4a-4c1e-9b2f-0a1b2c3d4e5f'
    api.messagesDuSalon.mockResolvedValue([DE_LEA])
    api.masquerMessageSalon.mockRejectedValue(
      new MessagerieError(404, `Message de salon introuvable : ${uuid}`)
    )
    render(<SalonClasseProf salon={SALON} />)
    await screen.findByText('Bonjour monsieur !')

    await user.click(screen.getByRole('button', { name: 'Masquer le message de Léa' }))
    const dialogue = await screen.findByRole('dialog')
    await user.click(within(dialogue).getByRole('button', { name: 'Masquer' }))

    expect(await within(dialogue).findByRole('alert')).toHaveTextContent(
      'Ce message est introuvable. Actualise le salon.'
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(uuid)
  })

  // critère 3: a 403 shows the server text as-is, in the dialog
  it('shows the server 403 on hiding as-is', async () => {
    const user = userEvent.setup()
    api.messagesDuSalon.mockResolvedValue([DE_LEA])
    api.masquerMessageSalon.mockRejectedValue(
      new MessagerieError(403, 'Vous ne modérez pas cette classe.')
    )
    render(<SalonClasseProf salon={SALON} />)
    await screen.findByText('Bonjour monsieur !')

    await user.click(screen.getByRole('button', { name: 'Masquer le message de Léa' }))
    const dialogue = await screen.findByRole('dialog')
    await user.click(within(dialogue).getByRole('button', { name: 'Masquer' }))

    expect(await within(dialogue).findByRole('alert')).toHaveTextContent(
      'Vous ne modérez pas cette classe.'
    )
  })

  // critère 1: a salon that vanished is told without the server's UUID
  it('replaces the server 404 on loading by a text without the UUID', async () => {
    const uuid = '0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70'
    api.messagesDuSalon.mockRejectedValue(new MessagerieError(404, `Salon introuvable : ${uuid}`))
    render(<SalonClasseProf salon={SALON} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce salon est introuvable. Recharge la page.'
    )
    expect(document.body).not.toHaveTextContent(uuid)
    // No dead end: « Actualiser » stays.
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeInTheDocument()
  })

  // critère 9′ (contre-épreuve) — double click on the confirming « Masquer » sends one request.
  // Without the guard (button disabled, or an in-flight flag, while the call runs), the two
  // clicks both reach the handler before the first call settles: masquerMessageSalon is called
  // twice and the `toHaveBeenCalledTimes(1)` below fails with « called 2 times ».
  it('sends a single hide request on a double click', async () => {
    const user = userEvent.setup()
    const masquage = differe<void>()
    api.messagesDuSalon
      .mockResolvedValueOnce([DE_LEA])
      .mockResolvedValue([{ ...DE_LEA, statut: 'masque' }])
    api.masquerMessageSalon.mockReturnValue(masquage.promesse)
    render(<SalonClasseProf salon={SALON} />)
    await screen.findByText('Bonjour monsieur !')

    await user.click(screen.getByRole('button', { name: 'Masquer le message de Léa' }))
    const confirmer = within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Masquer',
    })
    // Two clicks in a row, while the first call is still pending.
    fireEvent.click(confirmer)
    fireEvent.click(confirmer)

    await waitFor(() => expect(api.masquerMessageSalon).toHaveBeenCalled())
    expect(api.masquerMessageSalon).toHaveBeenCalledTimes(1)

    masquage.resoudre()
    expect(await within(article('Bonjour monsieur !')).findByText('Masqué')).toBeVisible()
    expect(api.masquerMessageSalon).toHaveBeenCalledTimes(1)
  })

  // critère 9′ (contre-épreuve) — reloads answered out of order: the latest one wins.
  // A publication triggers reload #2; « Actualiser » then triggers reload #3. Reload #3 answers
  // first (a classmate's message posted meanwhile included), then the older #2 answers without
  // it. Without the sequence guard, #2 is applied last and overwrites #3: « Noé est arrivé » vanishes
  // and the final `getByText` fails. With the guard, the stale #2 is dropped.
  it('keeps the latest reload when an older one answers last', async () => {
    const user = userEvent.setup()
    const recharge2 = differe<SalonMessageVue[]>()
    const recharge3 = differe<SalonMessageVue[]>()
    const mien = message({
      id: 'm9',
      auteurId: 'p1',
      auteurNom: 'M. Dubois',
      corps: 'Pensez au contrôle de jeudi.',
      estMoi: true,
      createdAt: '2026-10-12T09:20:00Z',
    })
    const deNoe = message({
      id: 'm10',
      auteurId: 'e2',
      auteurNom: 'Noé',
      corps: 'Noé est arrivé',
      createdAt: '2026-10-12T09:21:00Z',
    })
    api.messagesDuSalon
      .mockResolvedValueOnce([DE_LEA]) // #1, on mount
      .mockReturnValueOnce(recharge2.promesse) // #2, after the publication
      .mockReturnValueOnce(recharge3.promesse) // #3, « Actualiser »
    api.publierDansSalon.mockResolvedValue('m9')
    render(<SalonClasseProf salon={SALON} />)
    await screen.findByText('Bonjour monsieur !')

    await user.type(screen.getByLabelText(ZONE), 'Pensez au contrôle de jeudi.')
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => expect(api.messagesDuSalon).toHaveBeenCalledTimes(2))

    await user.click(screen.getByRole('button', { name: 'Actualiser' }))
    await waitFor(() => expect(api.messagesDuSalon).toHaveBeenCalledTimes(3))

    // The newest answers first…
    recharge3.resoudre([DE_LEA, mien, deNoe])
    expect(await screen.findByText('Noé est arrivé')).toBeInTheDocument()
    // …then the stale one.
    recharge2.resoudre([DE_LEA, mien])
    await new Promise((r) => setTimeout(r, 0))
    await waitFor(() =>
      expect(screen.getByText('Pensez au contrôle de jeudi.')).toBeInTheDocument()
    )
    expect(screen.getByText('Noé est arrivé')).toBeInTheDocument()
  })
})
