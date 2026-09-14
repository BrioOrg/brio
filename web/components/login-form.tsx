'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { login, LoginError } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { Icon } from '@/components/ui/icon'

/**
 * Login form for the /connexion page. Client component: owns form state and
 * talks to the session API. On success it sends the user to the home page,
 * where their class and matières are shown.
 */
export function LoginForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const router = useRouter()
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await login(identifiant, motDePasse)
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof LoginError
          ? err.message
          : 'La connexion a échoué. Vérifie ta connexion et réessaie.'
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

      <TextInput
        label="Identifiant ou e-mail"
        type="text"
        name="identifiant"
        autoComplete="username"
        placeholder="lea.martin"
        value={identifiant}
        onChange={(e) => setIdentifiant(e.target.value)}
        required
        autoFocus
      />

      <TextInput
        label="Mot de passe"
        type="password"
        name="mot_de_passe"
        autoComplete="current-password"
        placeholder="••••••••"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        required
      />

      <div className="text-right">
        <Link
          href="/mot-de-passe-oublie"
          className="rounded-sm font-prose text-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
        Se connecter
        <Icon name="arrow-right" weight="bold" size={20} />
      </Button>

      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="font-display text-2xs font-extrabold uppercase tracking-widest text-ink-muted">
          ou
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* SSO établissement : aucun endpoint back pour l'instant — présent mais
          désactivé, avec une mention honnête plutôt qu'un bouton silencieux. */}
      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled
        className="w-full"
        title="Bientôt disponible"
      >
        Se connecter avec mon établissement
        <span className="font-prose text-xs font-normal text-ink-muted">(bientôt)</span>
      </Button>
    </form>
  )
}
