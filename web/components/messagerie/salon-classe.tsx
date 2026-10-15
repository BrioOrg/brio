'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

import {
  listerSalons,
  mesClasses,
  messagesDuSalon,
  publierDansSalon,
  signalerMessageSalon,
  type MaClasse,
  type SalonMessageVue,
  type SalonVue,
} from '@brio/api-client'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { SelectInput } from '@/components/ui/select-input'
import { Skeleton } from '@/components/ui/skeleton'
import { TextInput } from '@/components/ui/text-input'
import { horodatage, messageErreur } from '@/components/messagerie/messagerie-format'
import { apiBaseUrl } from '@/lib/api-base-url'

const MESSAGE_MAX = 2000

/**
 * The class salon (F6b, ADR 0033): the group chat of the student's class, where the teacher and
 * every classmate write. Asynchronous by design — an "Actualiser" button and a reload after each
 * message, no live updates. The teacher opens the salon; until then, there is nothing to show.
 */
export function SalonClasse() {
  const [classes, setClasses] = useState<MaClasse[] | null>(null)
  const [classeId, setClasseId] = useState<string | null>(null)
  const [salons, setSalons] = useState<SalonVue[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    Promise.all([mesClasses(apiBaseUrl()), listerSalons(apiBaseUrl())])
      .then(([cs, ss]) => {
        if (!vivant) return
        setClasses(cs)
        setClasseId(cs[0]?.id ?? null)
        setSalons(ss)
      })
      .catch((e) => {
        if (vivant) setErreur(messageErreur(e, 'Impossible de charger ta classe.'))
      })
    return () => {
      vivant = false
    }
  }, [])

  const salon = salons?.find((s) => s.classeId === classeId) ?? null

  return (
    <main className="px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold text-ink">Ma classe</h1>

        {classes !== null && classes.length > 1 && (
          <SelectInput
            label="Classe"
            value={classeId ?? ''}
            onChange={(e) => setClasseId(e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </SelectInput>
        )}

        {erreur && (
          <p role="alert" className="font-prose text-sm text-danger">
            {erreur}
          </p>
        )}

        {classes === null && !erreur && <Skeleton className="h-32 w-full" />}

        {classes !== null && classes.length === 0 && (
          <p className="rounded-lg border border-line bg-surface-raised p-4 font-prose text-sm text-ink-muted">
            Le salon de classe se fait entre membres d’une même classe. Rejoins ta classe pour
            discuter avec tes camarades et ton professeur.
          </p>
        )}

        {classeId && salons !== null && salon === null && (
          <p className="rounded-lg border border-line bg-surface-raised p-4 font-prose text-sm text-ink-muted">
            Ton professeur n’a pas encore ouvert le salon de la classe. Reviens un peu plus tard.
          </p>
        )}

        {salon && <Salon salon={salon} />}
      </div>
    </main>
  )
}

function Salon({ salon }: { salon: SalonVue }) {
  const [messages, setMessages] = useState<SalonMessageVue[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const finRef = useRef<HTMLDivElement | null>(null)

  const charger = useCallback(async () => {
    try {
      setMessages(await messagesDuSalon(apiBaseUrl(), salon.id))
      setErreur(null)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de charger les messages.'))
    }
  }, [salon.id])

  useEffect(() => {
    setMessages(null)
    void charger()
  }, [charger])

  useEffect(() => {
    // scrollIntoView is absent in jsdom; optional call keeps the test env happy.
    finRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages])

  return (
    <section
      aria-label={`Salon ${salon.titre}`}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface-panel p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-extrabold uppercase tracking-widest text-ink-muted">
          {salon.titre}
        </p>
        <Button variant="ghost" size="sm" onClick={() => void charger()}>
          Actualiser
        </Button>
      </div>

      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
          {erreur}
        </p>
      )}

      {messages === null && !erreur && <Skeleton className="h-24 w-full" />}

      {messages !== null && (
        <>
          {messages.length === 0 ? (
            <p className="font-prose text-sm text-ink-muted">
              Personne n’a encore écrit. Lance la discussion !
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {messages.map((m) => (
                <li key={m.id}>
                  <Message message={m} />
                </li>
              ))}
              <div ref={finRef} />
            </ul>
          )}

          <Composer salonId={salon.id} onEnvoye={charger} />
        </>
      )}
    </section>
  )
}

function Message({ message: m }: { message: SalonMessageVue }) {
  return (
    <article
      className={[
        'flex flex-col gap-1 rounded-lg border p-3',
        m.estMoi ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface-raised',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-prose text-xs font-semibold text-ink">
          {m.estMoi ? 'Toi' : m.auteurNom}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-prose text-xs text-ink-muted">{horodatage(m.createdAt)}</span>
          {!m.estMoi && <Signaler messageId={m.id} />}
        </span>
      </div>
      <p className="whitespace-pre-line font-prose text-sm text-ink">{m.corps}</p>
    </article>
  )
}

function Composer({ salonId, onEnvoye }: { salonId: string; onEnvoye: () => Promise<void> }) {
  const [corps, setCorps] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const vide = corps.trim() === ''

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (vide || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      await publierDansSalon(apiBaseUrl(), salonId, corps)
      setCorps('')
      await onEnvoye()
    } catch (err) {
      setErreur(messageErreur(err, "Impossible d'envoyer ton message."))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <form onSubmit={envoyer} aria-label="Écrire un message" className="flex flex-col gap-2">
      <label htmlFor={`message-${salonId}`} className="sr-only">
        Ton message
      </label>
      <textarea
        id={`message-${salonId}`}
        value={corps}
        onChange={(e) => setCorps(e.target.value)}
        maxLength={MESSAGE_MAX}
        rows={2}
        placeholder="Écris un message à ta classe…"
        className="w-full resize-none rounded-md border border-line bg-surface-page px-3 py-2 font-prose text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
          {erreur}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="font-prose text-xs text-ink-muted">
          Pas de lien, pas d’information personnelle. Ton professeur peut modérer.
        </p>
        <Button type="submit" size="sm" loading={envoi} disabled={vide}>
          Envoyer
        </Button>
      </div>
    </form>
  )
}

function Signaler({ messageId }: { messageId: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [signale, setSignale] = useState(false)

  async function signaler(e: React.FormEvent) {
    e.preventDefault()
    if (envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      await signalerMessageSalon(apiBaseUrl(), messageId, motif)
      setSignale(true)
      setOuvert(false)
    } catch (err) {
      setErreur(messageErreur(err, 'Impossible de signaler ce message.'))
    } finally {
      setEnvoi(false)
    }
  }

  if (signale) {
    return <span className="font-prose text-xs text-ink-muted">Signalé</span>
  }

  return (
    <Dialog.Root open={ouvert} onOpenChange={setOuvert}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Signaler ce message"
          className="text-ink-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="flag" size={14} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface-panel p-5 font-prose text-ink focus-visible:outline-none">
          <Dialog.Title className="font-display text-lg font-extrabold text-ink">
            Signaler ce message
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink-muted">
            Ton professeur le verra et pourra le masquer. Dis-lui ce qui ne va pas (facultatif).
          </Dialog.Description>
          <form onSubmit={signaler} className="mt-4 flex flex-col gap-4">
            <TextInput
              label="Motif (facultatif)"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              maxLength={500}
            />
            {erreur && (
              <p role="alert" className="text-sm text-danger">
                {erreur}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" type="button">
                  Annuler
                </Button>
              </Dialog.Close>
              <Button variant="destructive" size="sm" type="submit" loading={envoi}>
                Signaler
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
