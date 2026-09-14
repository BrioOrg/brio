'use client'

import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export function RevokeButton({ token }: { token: string }) {
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRevoke() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(
        `${API_URL}/api/consentements/revocation/${encodeURIComponent(token)}`,
        { method: 'POST', credentials: 'include' }
      )
      if (res.ok) {
        setDone(true)
      } else if (res.status === 409) {
        setError("L'autorisation a déjà été retirée.")
      } else if (res.status === 400) {
        setError("Ce lien est invalide. Contactez l'établissement si vous avez besoin d'aide.")
      } else {
        setError("Une erreur inattendue s'est produite. Réessayez dans un instant.")
      }
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-md border border-line bg-surface-raised px-4 py-4 font-prose text-sm text-ink">
        <p className="font-bold">Autorisation retirée.</p>
        <p className="mt-1 text-ink-muted">
          Le compte de votre enfant a été suspendu. Contactez l&apos;établissement pour le réactiver
          si vous le souhaitez.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 font-prose text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <button
        onClick={handleRevoke}
        disabled={pending}
        className="w-full rounded-lg border-2 border-red-400 bg-white px-6 py-3 font-display text-base font-extrabold text-red-600 transition-opacity disabled:opacity-60"
      >
        {pending ? 'Traitement en cours…' : 'Retirer mon autorisation'}
      </button>
    </div>
  )
}
