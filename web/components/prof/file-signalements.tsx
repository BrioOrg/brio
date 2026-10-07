'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

import {
  fileSignalements,
  masquerMessage,
  mesClasses,
  sanctionner,
  type SignalementVue,
  type TypeSanction,
} from '@brio/api-client'

import { dateCourte, messageErreur } from '@/components/entraide/entraide-format'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { TextInput } from '@/components/ui/text-input'
import { apiBaseUrl } from '@/lib/api-base-url'

// The teacher's moderation queue for class entraide (F6a, ADR 0023): open reports, oldest
// first, with the two actions the server offers — hide the message, sanction its author.

export function FileSignalements() {
  const [file, setFile] = useState<SignalementVue[] | null>(null)
  const [libelles, setLibelles] = useState<Record<string, string>>({})
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      setFile(await fileSignalements(apiBaseUrl()))
      setErreur(null)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de charger les signalements.'))
    }
  }, [])

  useEffect(() => {
    void charger()
    mesClasses(apiBaseUrl())
      .then((cs) => setLibelles(Object.fromEntries(cs.map((c) => [c.id, c.libelle]))))
      .catch(() => {})
  }, [charger])

  return (
    <div data-theme="light" className="min-h-screen bg-surface-page font-prose text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-panel px-4 py-3">
        <Link
          href="/prof"
          aria-label="Retour à l'espace enseignant"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-ink-muted hover:text-ink"
        >
          <Icon name="arrow-left" size={16} aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 font-display text-lg font-extrabold text-ink">
          Signalements
        </h1>
        <Button variant="ghost" size="sm" onClick={() => void charger()}>
          Actualiser
        </Button>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <p className="text-sm text-ink-muted">
          Les messages de l’entraide que tes élèves t’ont signalés. Masquer retire le message de la
          vue des élèves et clôt ses signalements.
        </p>

        {erreur && (
          <p
            role="alert"
            className="rounded-lg border border-danger bg-surface-panel px-4 py-2 text-sm text-danger"
          >
            {erreur}
          </p>
        )}
        {!file && !erreur && <p className="text-ink-muted">Chargement…</p>}

        {file?.length === 0 && (
          <p className="rounded-lg border border-line bg-surface-panel p-4 text-ink-muted">
            Aucun signalement en attente.
          </p>
        )}

        {file && file.length > 0 && (
          <ul className="flex flex-col gap-3">
            {file.map((s) => (
              <li key={s.id}>
                <Signalement
                  signalement={s}
                  classeLibelle={libelles[s.classeId]}
                  onTraite={charger}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

type SignalementProps = {
  signalement: SignalementVue
  classeLibelle?: string
  onTraite: () => Promise<void>
}

function Signalement({ signalement: s, classeLibelle, onTraite }: SignalementProps) {
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [sanctionne, setSanctionne] = useState(false)

  async function masquer() {
    setOccupe(true)
    setErreur(null)
    try {
      await masquerMessage(apiBaseUrl(), s.messageId)
      await onTraite()
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de masquer ce message.'))
      setOccupe(false)
    }
  }

  return (
    <article
      aria-label={`Signalement sur « ${s.filTitre} »`}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-panel p-4"
    >
      <div className="flex flex-col gap-0.5">
        <p className="font-display text-sm font-extrabold text-ink">{s.filTitre}</p>
        <p className="text-xs text-ink-muted">
          {classeLibelle ? `${classeLibelle} · ` : ''}Message de {s.auteurMessageNom} · signalé le{' '}
          {dateCourte(s.createdAt)}
        </p>
      </div>

      <blockquote className="whitespace-pre-line rounded-md border-l-4 border-warning bg-surface-raised px-3 py-2 text-sm text-ink">
        {s.extraitMessage}
      </blockquote>

      <p className="text-sm text-ink-muted">
        Motif : {s.motif ? <span className="text-ink">{s.motif}</span> : 'non précisé'}
      </p>

      {erreur && (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      )}
      {sanctionne && (
        <p role="status" className="text-sm text-ink">
          Sanction appliquée à {s.auteurMessageNom}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void masquer()} loading={occupe}>
          <Icon name="eye-slash" size={16} aria-hidden="true" />
          Masquer le message
        </Button>
        <DialogueSanction
          compteId={s.auteurMessageId}
          classeId={s.classeId}
          nom={s.auteurMessageNom}
          onApplique={() => setSanctionne(true)}
        />
      </div>
    </article>
  )
}

const TYPES: { valeur: TypeSanction; libelle: string; aide: string }[] = [
  {
    valeur: 'avertissement',
    libelle: 'Avertissement',
    aide: 'Trace la décision, sans limiter l’accès.',
  },
  {
    valeur: 'lecture_seule',
    libelle: 'Lecture seule',
    aide: 'L’élève lit l’entraide mais ne peut plus écrire.',
  },
]

type DialogueSanctionProps = {
  compteId: string
  classeId: string
  nom: string
  onApplique: () => void
}

function DialogueSanction({ compteId, classeId, nom, onApplique }: DialogueSanctionProps) {
  const [ouvert, setOuvert] = useState(false)
  const [type, setType] = useState<TypeSanction>('avertissement')
  const [motif, setMotif] = useState('')
  const [fin, setFin] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function appliquer(e: React.FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await sanctionner(apiBaseUrl(), {
        compteId,
        classeId,
        type,
        motif: motif.trim() || undefined,
        // The chosen day is included: the sanction ends at its last second, local time.
        fin: type === 'lecture_seule' && fin ? new Date(`${fin}T23:59:59`).toISOString() : undefined,
      })
      setOuvert(false)
      onApplique()
    } catch (err) {
      setErreur(messageErreur(err, "Impossible d'appliquer la sanction."))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Dialog.Root open={ouvert} onOpenChange={setOuvert}>
      <Dialog.Trigger asChild>
        <Button variant="destructive" size="sm">
          Sanctionner {nom}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          data-theme="light"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface-panel p-5 font-prose text-ink focus-visible:outline-none"
        >
          <Dialog.Title className="font-display text-lg font-extrabold text-ink">
            Sanctionner {nom}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink-muted">
            Elle vaut pour toute l’entraide de l’élève, pas seulement cette classe.
          </Dialog.Description>

          <form onSubmit={appliquer} className="mt-4 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold text-ink">Type</legend>
              {TYPES.map((t) => (
                <label
                  key={t.valeur}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 has-[:checked]:border-accent"
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.valeur}
                    checked={type === t.valeur}
                    onChange={() => setType(t.valeur)}
                    className="mt-1 accent-[var(--color-accent)]"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">{t.libelle}</span>
                    <span className="text-xs text-ink-muted">{t.aide}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <TextInput
              label="Motif (facultatif)"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              maxLength={500}
            />
            {type === 'lecture_seule' && (
<TextInput
              label="Jusqu’au (facultatif)"
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
            />
)}

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
                Appliquer
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
