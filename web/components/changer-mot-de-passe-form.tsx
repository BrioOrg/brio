'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChangerMotDePasseError,
  MOT_DE_PASSE_MAX,
  MOT_DE_PASSE_MIN,
  changerMotDePasse,
} from '@brio/api-client'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { TextInput } from '@/components/ui/text-input'
import { LogoutButton } from '@/components/logout-button'
import { apiBaseUrl } from '@/lib/api-base-url'

/**
 * The student's own password, chosen right after logging in with the provisional one a teacher
 * gave them (ADR 0036 §5). On success they land on the home page, where their class and
 * progression are waiting — the account is the same one.
 */
const CHAMP = 'nouveau-mot-de-passe'
const AIDE = 'nouveau-mot-de-passe-aide'

export function ChangerMotDePasseForm() {
  const router = useRouter()
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [erreurConfirmation, setErreurConfirmation] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enCours) return
    setErreur(null)
    setErreurConfirmation(null)
    if (motDePasse.length < MOT_DE_PASSE_MIN) {
      setErreur(`Ton mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`)
      return
    }
    if (motDePasse.length > MOT_DE_PASSE_MAX) {
      setErreur(`Ton mot de passe est trop long : ${MOT_DE_PASSE_MAX} caractères au maximum.`)
      return
    }
    if (confirmation !== motDePasse) {
      setErreurConfirmation('Les deux mots de passe ne sont pas identiques.')
      return
    }
    setEnCours(true)
    try {
      await changerMotDePasse(apiBaseUrl(), motDePasse)
      router.push('/')
      router.refresh()
    } catch (e) {
      if (e instanceof ChangerMotDePasseError && e.status === 409) {
        // Already chosen (another tab): nothing left to do here.
        router.push('/')
        router.refresh()
        return
      }
      setErreur(
        e instanceof ChangerMotDePasseError
          ? e.message
          : 'Le changement a échoué. Vérifie ta connexion et réessaie.'
      )
      setEnCours(false)
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
      <TextInput
        id={CHAMP}
        label="Ton nouveau mot de passe"
        type="password"
        name="nouveau_mot_de_passe"
        // The hint is read with the field, and so is the error when there is one.
        aria-describedby={erreur ? `${AIDE} ${CHAMP}-error` : AIDE}
        autoComplete="new-password"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        error={erreur ?? undefined}
        required
        autoFocus
      />
      <p id={AIDE} className="-mt-2 font-prose text-xs text-ink-muted">
        Au moins {MOT_DE_PASSE_MIN} caractères. Une phrase courte que toi seul connais, c’est
        parfait.
      </p>
      <TextInput
        label="Retape-le pour vérifier"
        type="password"
        name="confirmation_mot_de_passe"
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        error={erreurConfirmation ?? undefined}
        required
      />

      <Button type="submit" size="lg" loading={enCours} className="mt-1 w-full">
        Enregistrer mon mot de passe
        <Icon name="arrow-right" weight="bold" size={20} aria-hidden="true" />
      </Button>

      {/* A shared computer: leaving must stay possible, but it costs the provisional password. */}
      <div className="flex flex-col items-center gap-1 border-t border-line pt-4">
        <LogoutButton />
        <p className="text-center font-prose text-xs text-ink-muted">
          Si tu te déconnectes maintenant, il faudra redemander un mot de passe provisoire à ton
          prof.
        </p>
      </div>
    </form>
  )
}
