import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    ...actual,
    listerMesClasses: vi.fn(),
    getCodeClasse: vi.fn(),
    genererCodeClasse: vi.fn(),
    listerInscrits: vi.fn(),
    renommerEleve: vi.fn(),
    reinitialiserAccesEleve: vi.fn(),
    // The class salon (PL-7, #399): mocked so the page never reaches the network.
    listerSalons: vi.fn(),
    creerSalon: vi.fn(),
    messagesDuSalon: vi.fn(),
    publierDansSalon: vi.fn(),
    masquerMessageSalon: vi.fn(),
    signalerMessageSalon: vi.fn(),
  }
})

const CLASSE = {
  id: 'cl1',
  etablissementId: 'e1',
  niveauCode: '4e',
  libelle: '4e B',
  anneeScolaire: '2026-2027',
  statut: 'active',
}
const CODE_ACTIF = { id: 'k1', expireAt: '2026-10-14T10:00:00Z', usages: 3, usagesMax: 40 }
const LEA = { compteId: 'a1', nomAffiche: 'Léa', depuis: '2026-09-30', homonyme: false }

async function api() {
  const client = await import('@brio/api-client')
  return {
    listerMesClasses: vi.mocked(client.listerMesClasses),
    getCodeClasse: vi.mocked(client.getCodeClasse),
    genererCodeClasse: vi.mocked(client.genererCodeClasse),
    listerInscrits: vi.mocked(client.listerInscrits),
    renommerEleve: vi.mocked(client.renommerEleve),
    reinitialiserAccesEleve: vi.mocked(client.reinitialiserAccesEleve),
    listerSalons: vi.mocked(client.listerSalons),
    creerSalon: vi.mocked(client.creerSalon),
    messagesDuSalon: vi.mocked(client.messagesDuSalon),
    publierDansSalon: vi.mocked(client.publierDansSalon),
    masquerMessageSalon: vi.mocked(client.masquerMessageSalon),
    signalerMessageSalon: vi.mocked(client.signalerMessageSalon),
  }
}

async function renderClasse(classeId = 'cl1') {
  const { ClasseDetail } = await import('../classe-detail')
  render(<ClasseDetail classeId={classeId} />)
}

describe('ClasseDetail', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const a = await api()
    a.listerMesClasses.mockResolvedValue([CLASSE])
    a.getCodeClasse.mockResolvedValue(null)
    a.listerInscrits.mockResolvedValue([])
    // Default: the class has no salon yet (critère 5 below covers the open one). The salon
    // mocks are reset, not only cleared: a queued answer must not leak into the next test.
    for (const f of [
      a.listerSalons,
      a.creerSalon,
      a.messagesDuSalon,
      a.publierDansSalon,
      a.masquerMessageSalon,
      a.signalerMessageSalon,
    ]) {
      f.mockReset()
    }
    a.listerSalons.mockResolvedValue([])
    a.messagesDuSalon.mockResolvedValue([])
  })

  afterEach(() => vi.unstubAllGlobals())

  it('ne montre rien d’une classe qui n’est pas celle de l’enseignant', async () => {
    await renderClasse('autre')
    expect(await screen.findByText(/cette classe est introuvable/i)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Code de classe' })).not.toBeInTheDocument()
  })

  it('génère un premier code et l’affiche une fois, en groupes lisibles', async () => {
    const a = await api()
    a.genererCodeClasse.mockResolvedValue({ ...CODE_ACTIF, usages: 0, code: '4EB22K9PXYZ7' })
    const user = userEvent.setup()
    await renderClasse()

    expect(await screen.findByText(/n’a pas de code actif/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Générer un code' }))

    expect(await screen.findByTestId('code-genere')).toHaveTextContent('4EB2-2K9P-XYZ7')
    expect(screen.getByText(/il ne sera plus affiché/i)).toBeInTheDocument()
    expect(screen.getByText(/0 utilisation sur 40/)).toBeInTheDocument()
  })

  it('ne réaffiche jamais un code existant, seulement son usage', async () => {
    ;(await api()).getCodeClasse.mockResolvedValue(CODE_ACTIF)
    await renderClasse()

    expect(await screen.findByText(/3 utilisations sur 40/)).toBeInTheDocument()
    expect(screen.getByText(/n’est pas réaffichable/i)).toBeInTheDocument()
    expect(screen.queryByTestId('code-genere')).not.toBeInTheDocument()
  })

  it('demande confirmation avant de remplacer un code actif', async () => {
    const a = await api()
    a.getCodeClasse.mockResolvedValue(CODE_ACTIF)
    const confirmer = vi.fn(() => false)
    vi.stubGlobal('confirm', confirmer)
    const user = userEvent.setup()
    await renderClasse()

    await user.click(await screen.findByRole('button', { name: 'Générer un nouveau code' }))

    expect(confirmer).toHaveBeenCalled()
    expect(a.genererCodeClasse).not.toHaveBeenCalled()
  })

  it('dit qu’aucun élève n’a rejoint la classe', async () => {
    await renderClasse()
    expect(await screen.findByText(/aucun élève n’a encore rejoint/i)).toBeInTheDocument()
  })

  it('signale un homonyme et suggère une initiale', async () => {
    ;(await api()).listerInscrits.mockResolvedValue([
      { ...LEA, homonyme: true },
      { ...LEA, compteId: 'a2', homonyme: true },
    ])
    await renderClasse()
    expect(await screen.findAllByText(/un autre élève de la classe porte ce nom/i)).toHaveLength(2)
  })

  it('renomme un élève puis recharge la liste', async () => {
    const a = await api()
    a.listerInscrits.mockResolvedValueOnce([LEA])
    a.listerInscrits.mockResolvedValueOnce([{ ...LEA, nomAffiche: 'Léa B.' }])
    a.renommerEleve.mockResolvedValue({ ...LEA, nomAffiche: 'Léa B.' })
    const user = userEvent.setup()
    await renderClasse()

    await user.click(await screen.findByRole('button', { name: 'Renommer Léa' }))
    const champ = screen.getByLabelText('Nom affiché de Léa')
    await user.clear(champ)
    await user.type(champ, 'Léa B.')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(a.renommerEleve).toHaveBeenCalledWith(expect.any(String), 'cl1', 'a1', 'Léa B.')
    )
    expect(await screen.findByText('Léa B.')).toBeInTheDocument()
  })

  // ADR 0036 : le prof réinitialise l'accès du compte EXISTANT d'un élève ; il voit une seule
  // fois l'identifiant (AC4 : identifiant oublié) et le mot de passe provisoire.
  describe('réinitialisation de l’accès', () => {
    const ACCES = {
      identifiantConnexion: 'k7m4p9xa3r',
      motDePasseProvisoire: 'abcd-efgh-jkmn',
      expireLe: '2026-11-23T10:00:00Z',
    }

    it('demande confirmation, puis affiche une seule fois identifiant, provisoire et expiration', async () => {
      const a = await api()
      a.listerInscrits.mockResolvedValue([LEA])
      a.reinitialiserAccesEleve.mockResolvedValue(ACCES)
      const user = userEvent.setup()
      await renderClasse()

      await user.click(await screen.findByRole('button', { name: 'Réinitialiser l’accès de Léa' }))
      const confirmation = screen.getByRole('group', {
        name: 'Confirmer la réinitialisation de l’accès de Léa',
      })
      expect(confirmation).toHaveTextContent(/garde son compte, ses classes et sa progression/i)
      expect(confirmation).toHaveTextContent(/sessions seront fermées sur tous ses appareils/i)
      expect(confirmation).toHaveTextContent(/7\s*jours/)
      // WCAG 2.4.3: focus moves into the confirmation it opened.
      expect(confirmation).toHaveFocus()
      expect(a.reinitialiserAccesEleve).not.toHaveBeenCalled()

      await user.click(within(confirmation).getByRole('button', { name: 'Réinitialiser l’accès' }))

      expect(a.reinitialiserAccesEleve).toHaveBeenCalledWith(expect.any(String), 'cl1', 'a1')
      const acces = await screen.findByRole('region', { name: 'Nouvel accès de Léa' })
      // Then onto the result.
      expect(within(acces).getByText(/accès de léa réinitialisé/i)).toHaveFocus()
      expect(within(acces).getByTestId('identifiant-connexion')).toHaveTextContent('k7m4p9xa3r')
      expect(acces).toHaveTextContent(/23 novembre 2026/)
      expect(acces).toHaveTextContent(/affiché une seule fois/i)
      expect(acces).toHaveTextContent(/n’affichez pas cet écran au tableau/i)

      // Masked by default: a classroom screen is often projected.
      expect(within(acces).queryByTestId('mot-de-passe-provisoire')).toBeNull()
      expect(acces).not.toHaveTextContent('abcd-efgh-jkmn')
      // Read as « masqué », not as a row of dots; no aria-label on a bare span.
      expect(acces).toHaveTextContent(/masqué/)
      // A toggle with a fixed name, contextualised with the student: aria-pressed says the state.
      const afficher = within(acces).getByRole('button', {
        name: 'Afficher le mot de passe provisoire de Léa',
      })
      expect(afficher).toHaveAttribute('aria-pressed', 'false')
      await user.click(afficher)
      expect(within(acces).getByTestId('mot-de-passe-provisoire')).toHaveTextContent(
        'abcd-efgh-jkmn'
      )
      expect(afficher).toHaveAttribute('aria-pressed', 'true')
      expect(afficher).toHaveAccessibleName('Afficher le mot de passe provisoire de Léa')
      await user.click(afficher)
      expect(acces).not.toHaveTextContent('abcd-efgh-jkmn')

      // Once closed, nothing can show it again; focus goes back to the student's button.
      await user.click(within(acces).getByRole('button', { name: 'J’ai noté, fermer' }))
      expect(screen.queryByText('abcd-efgh-jkmn')).toBeNull()
      expect(screen.queryByRole('region', { name: 'Nouvel accès de Léa' })).toBeNull()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Réinitialiser l’accès de Léa' })).toHaveFocus()
      )
    })

    it('groupe l’identifiant par quatre sans changer ce qui est copié', async () => {
      const a = await api()
      a.listerInscrits.mockResolvedValue([LEA])
      a.reinitialiserAccesEleve.mockResolvedValue(ACCES)
      const writeText = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      // userEvent installs its own clipboard: replace it after setup.
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      await renderClasse()

      await user.click(await screen.findByRole('button', { name: 'Réinitialiser l’accès de Léa' }))
      await user.click(
        within(screen.getByRole('group')).getByRole('button', { name: 'Réinitialiser l’accès' })
      )
      const acces = await screen.findByRole('region', { name: 'Nouvel accès de Léa' })
      const groupes = within(acces)
        .getByTestId('identifiant-connexion')
        .querySelectorAll('span > span')
      expect(Array.from(groupes, (g) => g.textContent)).toEqual(['k7m4', 'p9xa', '3r'])

      await user.click(within(acces).getByRole('button', { name: 'Copier l’identifiant de Léa' }))
      expect(writeText).toHaveBeenLastCalledWith('k7m4p9xa3r')
      // The provisional password copies without being shown.
      await user.click(
        within(acces).getByRole('button', { name: 'Copier le mot de passe provisoire de Léa' })
      )
      expect(writeText).toHaveBeenLastCalledWith('abcd-efgh-jkmn')
      expect(within(acces).queryByTestId('mot-de-passe-provisoire')).toBeNull()
      expect(await within(acces).findAllByText('Copié')).not.toHaveLength(0)
    })

    // I4/R4 : une nouvelle réinitialisation du même élève repart d'un panneau neuf — masqué, sans
    // « Copié » périmé, focus sur le nouveau résultat — et la confirmation prévient que le
    // provisoire encore affiché cessera de marcher.
    it('repart masqué, sans « Copié », focus sur le résultat, quand on réinitialise à nouveau', async () => {
      const a = await api()
      a.listerInscrits.mockResolvedValue([LEA])
      a.reinitialiserAccesEleve.mockResolvedValueOnce(ACCES).mockResolvedValueOnce({
        ...ACCES,
        motDePasseProvisoire: 'pqrs-tuvw-xyz2',
        expireLe: '2026-11-23T10:05:00Z',
      })
      const writeText = vi.fn(() => Promise.resolve())
      const user = userEvent.setup()
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      await renderClasse()

      await user.click(await screen.findByRole('button', { name: 'Réinitialiser l’accès de Léa' }))
      // No provisional password shown yet: nothing to warn about.
      expect(screen.getByRole('group')).not.toHaveTextContent(/affiché plus bas/i)
      await user.click(
        within(screen.getByRole('group')).getByRole('button', { name: 'Réinitialiser l’accès' })
      )
      const premier = await screen.findByRole('region', { name: 'Nouvel accès de Léa' })
      await user.click(
        within(premier).getByRole('button', { name: 'Afficher le mot de passe provisoire de Léa' })
      )
      await user.click(
        within(premier).getByRole('button', { name: 'Copier le mot de passe provisoire de Léa' })
      )
      expect(await within(premier).findByText('Copié')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Réinitialiser l’accès de Léa' }))
      const confirmation = screen.getByRole('group', {
        name: 'Confirmer la réinitialisation de l’accès de Léa',
      })
      expect(confirmation).toHaveTextContent(
        /le mot de passe provisoire affiché plus bas cessera de fonctionner/i
      )
      await user.click(within(confirmation).getByRole('button', { name: 'Réinitialiser l’accès' }))

      const second = await screen.findByRole('region', { name: 'Nouvel accès de Léa' })
      await waitFor(() =>
        expect(within(second).getByText(/accès de léa réinitialisé/i)).toHaveFocus()
      )
      expect(within(second).queryByTestId('mot-de-passe-provisoire')).toBeNull()
      expect(second).not.toHaveTextContent('pqrs-tuvw-xyz2')
      expect(second).not.toHaveTextContent('abcd-efgh-jkmn')
      expect(within(second).queryByText('Copié')).toBeNull()
      expect(
        within(second).getByRole('button', { name: 'Afficher le mot de passe provisoire de Léa' })
      ).toHaveAttribute('aria-pressed', 'false')
    })

    it('garde le résultat du premier élève quand on en réinitialise un second', async () => {
      const a = await api()
      const TOM = { compteId: 'b2', nomAffiche: 'Tom', depuis: '2026-09-30', homonyme: false }
      a.listerInscrits.mockResolvedValue([LEA, TOM])
      a.reinitialiserAccesEleve
        .mockResolvedValueOnce(ACCES)
        .mockResolvedValueOnce({ ...ACCES, identifiantConnexion: 'tomtomtomt' })
      const user = userEvent.setup()
      await renderClasse()

      await user.click(await screen.findByRole('button', { name: 'Réinitialiser l’accès de Léa' }))
      await user.click(
        within(screen.getByRole('group')).getByRole('button', { name: 'Réinitialiser l’accès' })
      )
      await screen.findByRole('region', { name: 'Nouvel accès de Léa' })

      await user.click(screen.getByRole('button', { name: 'Réinitialiser l’accès de Tom' }))
      await user.click(
        within(
          screen.getByRole('group', { name: 'Confirmer la réinitialisation de l’accès de Tom' })
        ).getByRole('button', { name: 'Réinitialiser l’accès' })
      )

      expect(await screen.findByRole('region', { name: 'Nouvel accès de Tom' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Nouvel accès de Léa' })).toBeInTheDocument()
    })

    it('n’appelle rien quand le prof annule', async () => {
      const a = await api()
      a.listerInscrits.mockResolvedValue([LEA])
      const user = userEvent.setup()
      await renderClasse()

      await user.click(await screen.findByRole('button', { name: 'Réinitialiser l’accès de Léa' }))
      await user.click(screen.getByRole('button', { name: 'Annuler' }))

      expect(a.reinitialiserAccesEleve).not.toHaveBeenCalled()
      expect(screen.queryByRole('group', { name: /confirmer la réinitialisation/i })).toBeNull()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Réinitialiser l’accès de Léa' })).toHaveFocus()
      )
    })

    it('affiche le refus du serveur sans rien montrer d’autre', async () => {
      const a = await api()
      const { CoursApiError } = await import('@brio/api-client')
      a.listerInscrits.mockResolvedValue([LEA])
      a.reinitialiserAccesEleve.mockRejectedValue(
        new CoursApiError(
          429,
          'Trop de réinitialisations en peu de temps. Réessayez plus tard : l’attente peut aller jusqu’à 24 h pour un même élève.'
        )
      )
      const user = userEvent.setup()
      await renderClasse()

      await user.click(await screen.findByRole('button', { name: 'Réinitialiser l’accès de Léa' }))
      await user.click(
        within(screen.getByRole('group')).getByRole('button', { name: 'Réinitialiser l’accès' })
      )

      // The class salon may raise its own alert: find this one by its text.
      expect(await screen.findByText(/trop de réinitialisations/i)).toHaveAttribute('role', 'alert')
      expect(screen.getByText(/trop de réinitialisations/i)).toHaveTextContent(/jusqu’à 24 h/)
      expect(screen.queryByTestId('mot-de-passe-provisoire')).toBeNull()
    })
  })

  // PL-7 (#399): the teacher reads and writes in the class salon from this page.
  describe('salon de la classe', () => {
    const SALON = {
      id: 's1',
      classeId: 'cl1',
      titre: 'Salon de la 4e B',
      statut: 'ouvert',
      nbMessages: 1,
      createdAt: '2026-10-12T08:00:00Z',
    }
    const DE_LEA = {
      id: 'm1',
      auteurId: 'a1',
      auteurNom: 'Léa',
      corps: 'Bonjour monsieur !',
      statut: 'publie',
      estMoi: false,
      createdAt: '2026-10-12T09:05:00Z',
    }

    function section() {
      return screen.getByRole('region', { name: 'Salon de la classe' })
    }

    // critère 6: the text of a class without salon promises only what the screen does
    // (classe-detail.tsx:181 used to promise « masquer un message signalé » only).
    it('offers to open the salon, with a text that matches the screen', async () => {
      await renderClasse()

      expect(await screen.findByRole('button', { name: 'Ouvrir le salon' })).toBeInTheDocument()
      const salon = section()
      expect(salon).toHaveTextContent(/tes élèves et toi pourrez y écrire/i)
      expect(salon).toHaveTextContent(/tu le liras ici/i)
      expect(salon).toHaveTextContent(/tu pourras masquer les messages de tes élèves/i)
      expect(salon).not.toHaveTextContent(/message signalé/i)
      expect(salon).not.toHaveTextContent(/ton professeur/i)
      const a = await api()
      expect(a.messagesDuSalon).not.toHaveBeenCalled()
    })

    // critère 5
    it('opens the salon and shows it in place, empty, with the field', async () => {
      const a = await api()
      a.listerSalons.mockResolvedValueOnce([]).mockResolvedValue([SALON])
      a.creerSalon.mockResolvedValue('s1')
      a.messagesDuSalon.mockResolvedValue([])
      const user = userEvent.setup()
      await renderClasse()
      const avant = window.location.href

      await user.click(await screen.findByRole('button', { name: 'Ouvrir le salon' }))

      expect(a.creerSalon).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ classeId: 'cl1' })
      )
      const champ = await waitFor(
        () => within(section()).getByLabelText('Ton message à la classe'),
        { timeout: 5000 }
      )
      expect(within(section()).getByRole('button', { name: 'Envoyer' })).toBeInTheDocument()
      expect(section()).toHaveTextContent(/Personne n.a encore écrit dans ce salon/)
      expect(screen.queryByRole('button', { name: 'Ouvrir le salon' })).toBeNull()
      expect(a.messagesDuSalon).toHaveBeenCalledWith(expect.any(String), 's1')
      // Without leaving the page: same URL, the rest of the class page still there.
      expect(window.location.href).toBe(avant)
      expect(screen.getByRole('region', { name: 'Code de classe' })).toBeInTheDocument()
      // The button is gone: focus moves to the field (spec UI, état « Salon pas ouvert »).
      await waitFor(() => expect(champ).toHaveFocus())
    })

    // critère 5: a failed opening keeps the button, no dead end
    it('keeps « Ouvrir le salon » when the opening fails', async () => {
      const a = await api()
      const { MessagerieError } = await import('@brio/api-client')
      a.creerSalon.mockRejectedValue(new MessagerieError(403, "Vous n'enseignez pas cette classe."))
      const user = userEvent.setup()
      await renderClasse()

      await user.click(await screen.findByRole('button', { name: 'Ouvrir le salon' }))

      expect(await within(section()).findByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ouvrir le salon' })).toBeInTheDocument()
    })

    // critère 1 + critère 6: an open salon shows its messages at the top of the page
    it('shows the messages of the open salon, first on the page, for the teacher', async () => {
      const a = await api()
      a.listerSalons.mockResolvedValue([SALON])
      a.messagesDuSalon.mockResolvedValue([DE_LEA])
      await renderClasse()

      // Three chained calls (classes, salons, messages) before the message shows: under the load
      // of the full suite that can exceed findBy's default 1 s. The region is re-queried at each
      // try, as the section may be re-rendered while the salon loads.
      await waitFor(
        () => expect(within(section()).getByText('Bonjour monsieur !')).toBeInTheDocument(),
        { timeout: 5000 }
      )
      expect(a.messagesDuSalon).toHaveBeenCalledWith(expect.any(String), 's1')
      expect(within(section()).getByText('Léa')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ouvrir le salon' })).toBeNull()

      // Copy for an adult, pointing to the moderation queue.
      expect(section()).toHaveTextContent(/Tes élèves retrouvent ce salon dans « Ma classe »/)
      expect(
        within(section()).getByRole('link', { name: /Signalements du salon/ })
      ).toHaveAttribute('href', '/prof/signalements-salon')
      expect(document.body).not.toHaveTextContent(/ton professeur/i)
      expect(screen.queryByRole('button', { name: /signaler/i })).toBeNull()

      // Salon first, then the class code (spec UI: visible without scrolling at 360 px).
      const code = screen.getByRole('region', { name: 'Code de classe' })
      expect(
        section().compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    })

    it('shows only the salon of this class', async () => {
      const a = await api()
      a.listerSalons.mockResolvedValue([{ ...SALON, id: 's2', classeId: 'autre' }])
      await renderClasse()

      expect(await screen.findByRole('button', { name: 'Ouvrir le salon' })).toBeInTheDocument()
      expect(a.messagesDuSalon).not.toHaveBeenCalled()
    })
  })
})
