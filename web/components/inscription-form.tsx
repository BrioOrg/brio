'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { inscrireEleve, InscrireEleveError } from '@/lib/enrollment'
import type { InscriptionEleveEnAttenteInfo, InscrireEleveInput } from '@/lib/enrollment'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { Icon } from '@/components/ui/icon'

const NIVEAUX: { value: InscrireEleveInput['niveauDeclare']; label: string }[] = [
  { value: '6e', label: '6e' },
  { value: '5e', label: '5e' },
  { value: '4e', label: '4e' },
  { value: '3e', label: '3e' },
]

const MOT_DE_PASSE_MIN = 8

function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return `Vérifie tes informations : l'e-mail du parent doit être valide et le mot de passe faire au moins ${MOT_DE_PASSE_MIN} caractères.`
    default:
      return 'La demande a échoué. Réessaie dans un instant.'
  }
}

function WaitingScreen({ info }: { info: InscriptionEleveEnAttenteInfo }) {
  const [copied, setCopied] = useState(false)

  async function copyIdentifiant() {
    try {
      await navigator.clipboard.writeText(info.identifiantConnexion)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — the text is already visible, nothing more to do.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Icon name="hourglass" weight="bold" size={22} className="shrink-0 text-accent" />
        <p className="font-display text-lg font-extrabold leading-tight text-ink">
          On attend le feu vert de ton parent&nbsp;!
        </p>
      </div>

      <p className="font-prose text-sm text-ink-muted">
        Un e-mail a été envoyé au parent que tu as indiqué. Dès qu&apos;il valide, ton compte est
        actif.
      </p>

      {/* identifiantConnexion disclosed exactly once — make it impossible to miss. */}
      <div className="rounded-md border-2 border-line bg-surface-raised p-4">
        <p className="font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink">
          Ton identifiant de connexion
        </p>
        <div className="mt-1 flex items-center gap-3">
          <p className="flex-1 font-display text-2xl font-black tracking-tight text-ink [font-variant-numeric:tabular-nums]">
            {info.identifiantConnexion}
          </p>
          <button
            type="button"
            onClick={copyIdentifiant}
            aria-label={copied ? 'Copié !' : "Copier l'identifiant"}
            className="grid size-9 shrink-0 place-items-center rounded-md border-2 border-line bg-surface-page text-ink-muted transition-colors duration-[var(--duration-fast)] hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          >
            <Icon name={copied ? 'check' : 'copy'} weight="bold" size={18} aria-hidden />
          </button>
        </div>
        <p className="mt-2 flex items-start gap-2 font-prose text-sm text-ink-muted">
          <Icon name="warning-circle" weight="bold" size={18} className="mt-0.5 shrink-0" />
          <span>Note-le bien : tu en auras besoin, avec ton mot de passe, pour te connecter.</span>
        </p>
      </div>

      <Link
        href="/connexion"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-none bg-accent px-6 py-4 font-display text-lg font-extrabold text-surface-page [box-shadow:var(--shadow-arcade)] transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 active:translate-y-[var(--depth-arcade)] active:[box-shadow:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
      >
        Me connecter dès que c&apos;est validé
        <Icon name="arrow-right" weight="bold" size={20} />
      </Link>
    </div>
  )
}

export function InscriptionForm() {
  const niveauId = useId()

  const [niveau, setNiveau] = useState<InscrireEleveInput['niveauDeclare']>('6e')
  const [motDePasse, setMotDePasse] = useState('')
  const [emailParent, setEmailParent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<InscriptionEleveEnAttenteInfo | null>(null)

  if (result) return <WaitingScreen info={result} />

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    if (motDePasse.length < MOT_DE_PASSE_MIN) {
      setError(`Ton mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`)
      return
    }

    setSubmitting(true)
    try {
      const info = await inscrireEleve({ niveauDeclare: niveau, motDePasse, emailParent })
      setResult(info)
    } catch (err) {
      setError(
        err instanceof InscrireEleveError ? messageForStatus(err.status) : messageForStatus(0)
      )
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border-2 border-feedback-incorrect bg-surface-raised px-3 py-2.5 font-prose text-sm text-feedback-incorrect"
        >
          <Icon name="warning-circle" weight="bold" size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={niveauId} className="font-prose text-sm font-semibold text-ink">
          Ton niveau
        </label>
        <select
          id={niveauId}
          name="niveauDeclare"
          value={niveau}
          onChange={(e) => setNiveau(e.target.value as InscrireEleveInput['niveauDeclare'])}
          required
          className="rounded-md border-2 border-line bg-surface-raised px-4 py-3 font-prose text-base text-ink transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus:border-accent focus:outline-none focus:[box-shadow:0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]"
        >
          {NIVEAUX.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <TextInput
        label={`Choisis un mot de passe (${MOT_DE_PASSE_MIN} caractères min.)`}
        type="password"
        name="motDePasse"
        autoComplete="new-password"
        placeholder="••••••••"
        minLength={MOT_DE_PASSE_MIN}
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        required
      />

      <TextInput
        label="E-mail de ton parent ou tuteur légal"
        type="email"
        name="emailParent"
        autoComplete="email"
        placeholder="parent@exemple.fr"
        value={emailParent}
        onChange={(e) => setEmailParent(e.target.value)}
        required
      />

      <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
        Créer mon compte
        <Icon name="arrow-right" weight="bold" size={20} />
      </Button>
    </form>
  )
}
