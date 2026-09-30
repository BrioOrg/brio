'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EtablissementPublic } from '@brio/api-client'
import { inscrireEnseignant, InscrireEnseignantError } from '@/lib/enrollment'
import { Button } from '@/components/ui/button'
import { SelectInput } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import { Icon } from '@/components/ui/icon'

const MOT_DE_PASSE_MIN = 8

function messageForStatus(status: number): string {
  switch (status) {
    case 409:
      return 'Un compte existe déjà avec cet e-mail. Connectez-vous plutôt.'
    case 422:
      return "Cet établissement n'est plus proposé. Rechargez la page et choisissez-en un autre."
    case 400:
      return `Vérifiez vos informations : l'e-mail doit être valide et le mot de passe faire au moins ${MOT_DE_PASSE_MIN} caractères.`
    default:
      return 'La demande a échoué. Réessayez dans un instant.'
  }
}

/**
 * Teacher signup form for /inscription/enseignant. No identifiant to choose: the
 * e-mail is the login. The teacher picks their établissement among the existing ones —
 * they never create one (ADR 0029). On success the teacher is sent to /connexion, which
 * confirms the account and returns them to /prof once logged in.
 */
export function InscriptionEnseignantForm({
  etablissements,
}: {
  etablissements: EtablissementPublic[]
}) {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  // A single établissement needs no choosing.
  const [etablissementId, setEtablissementId] = useState(
    etablissements.length === 1 ? etablissements[0].id : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    if (!nom.trim() || !email.trim()) {
      setError('Indiquez votre nom et votre e-mail.')
      return
    }
    if (!etablissementId) {
      setError('Choisissez votre établissement.')
      return
    }
    if (motDePasse.length < MOT_DE_PASSE_MIN) {
      setError(`Votre mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`)
      return
    }

    setSubmitting(true)
    try {
      await inscrireEnseignant({ nom: nom.trim(), email: email.trim(), motDePasse, etablissementId })
      router.push('/connexion?from=/prof&inscrit=1')
    } catch (err) {
      setError(
        err instanceof InscrireEnseignantError ? messageForStatus(err.status) : messageForStatus(0)
      )
      setSubmitting(false)
    }
  }

  if (etablissements.length === 0) {
    return (
      <p role="status" className="font-prose text-sm text-ink-muted">
        Aucun établissement n’est encore ouvert sur Brio : l’inscription des enseignants n’est pas
        possible pour le moment.
      </p>
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
        label="Votre nom"
        type="text"
        name="nom"
        autoComplete="name"
        placeholder="Mme Durand"
        maxLength={200}
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        required
        autoFocus
      />

      <TextInput
        label="Votre e-mail"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="prenom.nom@exemple.fr"
        maxLength={100}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <SelectInput
        label="Votre établissement"
        name="etablissementId"
        value={etablissementId}
        onChange={(e) => setEtablissementId(e.target.value)}
        required
      >
        <option value="">Choisir…</option>
        {etablissements.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nom}
          </option>
        ))}
      </SelectInput>

      <TextInput
        label={`Choisissez un mot de passe (${MOT_DE_PASSE_MIN} caractères min.)`}
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
        Créer mon compte
        <Icon name="arrow-right" weight="bold" size={20} />
      </Button>
    </form>
  )
}
