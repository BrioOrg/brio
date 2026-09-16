'use client'

import { useState } from 'react'
import Link from 'next/link'
import { rejoindreClasse, RejoindreError } from '@/lib/enrollment'
import type { EleveInscritInfo } from '@/lib/enrollment'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { Icon } from '@/components/ui/icon'

// Mirror the backend constraints (RejoindreClasseRequest).
const MOT_DE_PASSE_MIN = 8
const NOM_AFFICHE_MAX = 30

function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return `Vérifie tes informations : le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`
    case 404:
      return 'Ce code de classe est introuvable. Revérifie-le avec ton prof.'
    case 410:
      return 'Ce code n’est plus valable (expiré ou déjà trop utilisé). Demande-en un nouveau à ton prof.'
    case 403:
      return 'Ton établissement n’est pas encore activé sur brio. Préviens ton enseignant.'
    default:
      return 'La demande a échoué. Réessaie dans un instant.'
  }
}

export function RejoindreForm() {
  const [code, setCode] = useState('')
  const [prenom, setPrenom] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<EleveInscritInfo | null>(null)

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
      const inscrit = await rejoindreClasse({
        code: code.trim(),
        nomAffiche: prenom.trim(),
        motDePasse,
      })
      setResult(inscrit)
    } catch (err) {
      setError(err instanceof RejoindreError ? messageForStatus(err.status) : messageForStatus(0))
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-accent">
          <Icon name="check" weight="bold" size={22} label="Réussi" />
          <p className="font-display text-lg font-extrabold text-ink">
            Te voilà dans la {result.classeLibelle}&nbsp;!
          </p>
        </div>

        {/* The identifiant is disclosed exactly once — make it impossible to miss. */}
        <div className="rounded-md border-2 border-line bg-surface-raised p-4">
          <p className="font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink">
            Ton identifiant de connexion
          </p>
          <p className="mt-1 font-display text-2xl font-black tracking-tight text-ink [font-variant-numeric:tabular-nums]">
            {result.identifiantConnexion}
          </p>
          <p className="mt-2 flex items-start gap-2 font-prose text-sm text-ink-muted">
            <Icon name="warning-circle" weight="bold" size={18} className="mt-0.5 shrink-0" />
            <span>Note-le bien : tu en auras besoin, avec ton mot de passe, pour te reconnecter.</span>
          </p>
        </div>

        <Link
          href="/connexion"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-none bg-accent px-6 py-4 font-display text-lg font-extrabold text-surface-page [box-shadow:var(--shadow-arcade)] transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 active:translate-y-[var(--depth-arcade)] active:[box-shadow:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
        >
          Me connecter
          <Icon name="arrow-right" weight="bold" size={20} />
        </Link>
      </div>
    )
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

      <TextInput
        label="Code de la classe"
        type="text"
        name="code"
        autoComplete="off"
        placeholder="Ex. 4EB-2K9P"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        autoFocus
      />

      <TextInput
        label="Ton prénom"
        type="text"
        name="nomAffiche"
        autoComplete="given-name"
        placeholder="Léa"
        maxLength={NOM_AFFICHE_MAX}
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        required
      />

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

      <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
        Rejoindre ma classe
        <Icon name="arrow-right" weight="bold" size={20} />
      </Button>
    </form>
  )
}
