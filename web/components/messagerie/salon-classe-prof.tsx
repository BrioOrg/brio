'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

import {
  MessagerieError,
  masquerMessageSalon,
  messagesDuSalon,
  publierDansSalon,
  type SalonMessageVue,
  type SalonVue,
} from '@brio/api-client'

import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { horodatage, messageErreur } from '@/components/messagerie/messagerie-format'
import { apiBaseUrl } from '@/lib/api-base-url'

const MESSAGE_MAX = 2000
const STATUT_PUBLIE = 'publie'
const STATUT_MASQUE = 'masque'

// French copy (U5, issue #399). Non-breaking spaces inside « » and before : ; ? !
const NBSP = '\u00a0'
const TEXTES = {
  titre: 'Salon de la classe',
  actualiser: 'Actualiser',
  introAvantLien: `Tes élèves retrouvent ce salon dans «${NBSP}Ma classe${NBSP}», onglet «${NBSP}Salon${NBSP}». Les messages qu'ils signalent arrivent aussi dans «${NBSP}`,
  introLien: 'Signalements du salon',
  introApresLien: `${NBSP}».`,
  listeNom: 'Messages du salon',
  vide: "Personne n'a encore écrit dans ce salon. Écris le premier message ci-dessous.",
  toi: 'Toi',
  masque: 'Masqué',
  masquer: 'Masquer',
  annuler: 'Annuler',
  titreConfirmation: `Masquer ce message${NBSP}?`,
  titreConfirmationMoi: `Masquer ton message${NBSP}?`,
  descriptionConfirmation: `Tes élèves ne le verront plus au prochain affichage de leur salon. Toi, tu le verras toujours ici, marqué «${NBSP}Masqué${NBSP}». Ses signalements en attente seront clos. Son auteur n'est pas prévenu, et tu ne pourras pas le réafficher.`,
  descriptionConfirmationMoi: `Tes élèves ne le verront plus au prochain affichage de leur salon. Toi, tu le verras toujours ici, marqué «${NBSP}Masqué${NBSP}». Tu ne pourras pas le réafficher.`,
  labelChamp: 'Ton message à la classe',
  placeholder: 'Écris à ta classe…',
  aide: `Toute la classe peut le lire. Pas de lien externe${NBSP}: il serait refusé.`,
  envoyer: 'Envoyer',
  annonceChargement: 'Chargement des messages…',
  annonceOuvert: 'Salon ouvert.',
  annonceEnvoye: 'Message envoyé.',
  annonceMasque: 'Message masqué.',
  erreurChargement: `Impossible de charger les messages. Vérifie ta connexion, puis appuie sur «${NBSP}Actualiser${NBSP}».`,
  erreurSalonIntrouvable: 'Ce salon est introuvable. Recharge la page.',
  erreurEnvoi: `Ton message n'est pas parti. Vérifie ta connexion et réessaie${NBSP}: ton texte est gardé.`,
  erreurMasquage: 'Impossible de masquer ce message. Vérifie ta connexion et réessaie.',
  erreurMessageIntrouvable: 'Ce message est introuvable. Actualise le salon.',
  erreurRefuse: `Ton message n'est pas parti${NBSP}: pas de lien externe, 2${NBSP}000 caractères au plus. Ton texte est gardé.`,
} as const

/**
 * The server's 404 copy carries a raw UUID ("Salon introuvable : …"): the screen swaps it for its
 * own text. Other messagerie errors (403, 429, 401) are shown as the server words them; a refused
 * message (422) gets the screen's text in `Composer`, see there.
 */
function erreurAffichee(e: unknown, repli: string, introuvable: string): string {
  if (e instanceof MessagerieError && e.status === 404) return introuvable
  return messageErreur(e, repli)
}

function nomAuteur(m: SalonMessageVue): string {
  return m.estMoi ? TEXTES.toi : m.auteurNom
}

/**
 * The class salon seen by its teacher (PL-7, #399): every message, hidden ones included and marked
 * "Masqué", a "Masquer" action on each published message, and a composer. No live updates: a reload
 * after each send or hide, and an "Actualiser" button. The student screen is `SalonClasse`.
 */
export function SalonClasseProf({
  salon,
  vientDOuvrir = false,
}: {
  salon: SalonVue
  /** The teacher just opened this salon from the page: focus the composer and say so. */
  vientDOuvrir?: boolean
}) {
  const [messages, setMessages] = useState<SalonMessageVue[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [annonce, setAnnonce] = useState<string>(vientDOuvrir ? TEXTES.annonceOuvert : '')
  const listeRef = useRef<HTMLUListElement | null>(null)
  const articlesRef = useRef(new Map<string, HTMLElement>())
  // A hidden message loses its "Masquer" button: focus goes to its article once the list reloads.
  const focusApresChargement = useRef<string | null>(null)
  // Sequence guard: only the answer to the latest load may update the list. Without it, a slow
  // answer started before a send or a hide could land last and bring back a stale list.
  const sequence = useRef(0)

  const charger = useCallback(async () => {
    const numero = ++sequence.current
    try {
      const recus = await messagesDuSalon(apiBaseUrl(), salon.id)
      if (numero !== sequence.current) return
      setMessages(recus)
      setErreur(null)
    } catch (e) {
      if (numero !== sequence.current) return
      setErreur(erreurAffichee(e, TEXTES.erreurChargement, TEXTES.erreurSalonIntrouvable))
    }
  }, [salon.id])

  useEffect(() => {
    void charger()
    return () => {
      // Drop any answer still in flight once unmounted.
      sequence.current += 1
    }
  }, [charger])

  useEffect(() => {
    // Scroll the list itself, not the page (scrollIntoView would jump the whole page).
    const liste = listeRef.current
    if (liste) liste.scrollTop = liste.scrollHeight
    const cible = focusApresChargement.current
    if (cible && messages?.some((m) => m.id === cible && m.statut === STATUT_MASQUE)) {
      focusApresChargement.current = null
      articlesRef.current.get(cible)?.focus()
    }
  }, [messages])

  const apresEnvoi = useCallback(async () => {
    setAnnonce('')
    await charger()
    setAnnonce(TEXTES.annonceEnvoye)
  }, [charger])

  const apresMasquage = useCallback(
    async (messageId: string) => {
      focusApresChargement.current = messageId
      setAnnonce('')
      await charger()
      setAnnonce(TEXTES.annonceMasque)
    },
    [charger]
  )

  const chargement = messages === null && !erreur

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-muted">
          {TEXTES.titre}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => void charger()}>
          {TEXTES.actualiser}
        </Button>
      </div>

      <p className="text-sm text-ink-muted">
        {TEXTES.introAvantLien}
        <Link
          href="/prof/signalements-salon"
          className="font-semibold text-accent-ink underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {TEXTES.introLien}
        </Link>
        {TEXTES.introApresLien}
      </p>

      <p role="status" className="sr-only">
        {chargement ? TEXTES.annonceChargement : annonce}
      </p>

      {erreur && (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      )}

      {chargement && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {messages !== null &&
        (messages.length === 0 ? (
          <p className="text-sm text-ink-muted">{TEXTES.vide}</p>
        ) : (
          <ul
            ref={listeRef}
            aria-label={TEXTES.listeNom}
            // A scrollable region must be reachable by keyboard (WCAG 2.1.1).
            tabIndex={0}
            className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {messages.map((m) => (
              <li key={m.id}>
                <MessageProf
                  message={m}
                  articleRef={(el) => {
                    if (el) articlesRef.current.set(m.id, el)
                    else articlesRef.current.delete(m.id)
                  }}
                  onMasque={apresMasquage}
                />
              </li>
            ))}
          </ul>
        ))}

      <Composer salonId={salon.id} focusInitial={vientDOuvrir} onEnvoye={apresEnvoi} />
    </>
  )
}

function MessageProf({
  message: m,
  articleRef,
  onMasque,
}: {
  message: SalonMessageVue
  articleRef: (el: HTMLElement | null) => void
  onMasque: (messageId: string) => Promise<void>
}) {
  const masque = m.statut === STATUT_MASQUE
  const auteur = nomAuteur(m)

  const cadre = masque
    ? 'border-dashed border-line bg-surface-page'
    : m.estMoi
      ? 'border-accent-edge bg-accent-soft'
      : 'border-line bg-surface-raised'
  // On accent-soft, ink-muted falls under AA in the light theme: own messages stay in ink.
  const horodatageCouleur = !masque && m.estMoi ? 'text-ink' : 'text-ink-muted'

  return (
    <article
      ref={articleRef}
      aria-label={masque ? `Message masqué de ${auteur}` : `Message de ${auteur}`}
      tabIndex={masque ? -1 : undefined}
      className={[
        'flex flex-col gap-1 rounded-lg border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        cadre,
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 truncate text-xs font-semibold text-ink">{auteur}</span>
        <span className={['text-xs', horodatageCouleur].join(' ')}>{horodatage(m.createdAt)}</span>
        {masque && (
          <Chip variant="status" icon="eye-slash">
            {TEXTES.masque}
          </Chip>
        )}
        {m.statut === STATUT_PUBLIE && (
          <span className="ml-auto">
            <MasquerMessage message={m} onMasque={onMasque} />
          </span>
        )}
      </div>
      <p
        className={['whitespace-pre-line text-sm', masque ? 'text-ink-muted' : 'text-ink'].join(
          ' '
        )}
      >
        {m.corps}
      </p>
    </article>
  )
}

function MasquerMessage({
  message: m,
  onMasque,
}: {
  message: SalonMessageVue
  onMasque: (messageId: string) => Promise<void>
}) {
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  // Double-click guard: state updates are asynchronous, a ref is not. One request at most.
  const enCoursRef = useRef(false)
  const reussi = useRef(false)
  const annulerRef = useRef<HTMLButtonElement | null>(null)

  const nomAccessible = m.estMoi ? 'Masquer ton message' : `Masquer le message de ${m.auteurNom}`

  async function confirmer() {
    if (enCoursRef.current) return
    enCoursRef.current = true
    setEnCours(true)
    setErreur(null)
    try {
      await masquerMessageSalon(apiBaseUrl(), m.id)
      reussi.current = true
      setOuvert(false)
      await onMasque(m.id)
    } catch (e) {
      setErreur(erreurAffichee(e, TEXTES.erreurMasquage, TEXTES.erreurMessageIntrouvable))
    } finally {
      enCoursRef.current = false
      setEnCours(false)
    }
  }

  function changerOuverture(suivant: boolean) {
    // No closing while the request is running: its outcome must stay visible.
    if (!suivant && enCoursRef.current) return
    if (suivant) setErreur(null)
    setOuvert(suivant)
  }

  return (
    <Dialog.Root open={ouvert} onOpenChange={changerOuverture}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="sm" aria-label={nomAccessible}>
          <Icon name="eye-slash" size={16} aria-hidden="true" />
          {TEXTES.masquer}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* Same veil as the other dialogs of the app; a semantic veil token is a separate PR. */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            annulerRef.current?.focus()
          }}
          onCloseAutoFocus={(e) => {
            // After a hide, the trigger is gone: the list reload focuses the hidden article.
            if (reussi.current) e.preventDefault()
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface-panel p-5 font-prose text-ink focus-visible:outline-none"
        >
          <Dialog.Title className="font-display text-lg font-extrabold text-ink">
            {m.estMoi ? TEXTES.titreConfirmationMoi : TEXTES.titreConfirmation}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink-muted">
            {m.estMoi ? TEXTES.descriptionConfirmationMoi : TEXTES.descriptionConfirmation}
          </Dialog.Description>
          {erreur && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {erreur}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button ref={annulerRef} variant="ghost" size="sm" type="button">
                {TEXTES.annuler}
              </Button>
            </Dialog.Close>
            <Button
              variant="destructive"
              size="sm"
              type="button"
              loading={enCours}
              onClick={() => void confirmer()}
            >
              {TEXTES.masquer}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Composer({
  salonId,
  focusInitial,
  onEnvoye,
}: {
  salonId: string
  focusInitial: boolean
  onEnvoye: () => Promise<void>
}) {
  const [corps, setCorps] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const champRef = useRef<HTMLTextAreaElement | null>(null)

  const vide = corps.trim() === ''

  useEffect(() => {
    // The "Ouvrir le salon" button just disappeared: the composer takes the focus.
    if (focusInitial) champRef.current?.focus()
  }, [focusInitial])

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (vide || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      await publierDansSalon(apiBaseUrl(), salonId, corps)
      // Cleared on success only: a refused message stays in the field to be fixed.
      setCorps('')
      champRef.current?.focus()
      await onEnvoye()
    } catch (err) {
      // The server's 422 copy says "…dans l'entraide" (ModerationPreventive.java:52, issue 403):
      // wrong in the salon. Its only causes here are a link or more than 2000 characters
      // (ModerationPreventive.java:43-53; an empty message never leaves, the button is disabled).
      if (err instanceof MessagerieError && err.status === 422) setErreur(TEXTES.erreurRefuse)
      else setErreur(erreurAffichee(err, TEXTES.erreurEnvoi, TEXTES.erreurSalonIntrouvable))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-2">
      <label htmlFor={`message-prof-${salonId}`} className="sr-only">
        {TEXTES.labelChamp}
      </label>
      <textarea
        ref={champRef}
        id={`message-prof-${salonId}`}
        value={corps}
        onChange={(e) => setCorps(e.target.value)}
        maxLength={MESSAGE_MAX}
        rows={3}
        placeholder={TEXTES.placeholder}
        className="w-full resize-none rounded-md border border-line bg-surface-page px-3 py-2 font-prose text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {erreur && (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      )}
      <p className="text-xs text-ink-muted">{TEXTES.aide}</p>
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={envoi} disabled={vide}>
          {TEXTES.envoyer}
        </Button>
      </div>
    </form>
  )
}
