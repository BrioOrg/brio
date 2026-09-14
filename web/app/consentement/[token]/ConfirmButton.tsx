'use client'

import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export function ConfirmButton({ token }: { token: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/consentements/${encodeURIComponent(token)}/validation`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        window.location.href = '/consentement/succes'
      } else if (res.status === 400) {
        setError('Ce lien est invalide ou a déjà été utilisé. Demandez un nouveau lien à l'établissement.')
      } else {
        setError('Une erreur inattendue s'est produite. Réessayez dans un instant.')
      }
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 font-prose text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        onClick={handleConfirm}
        disabled={pending}
        className="w-full rounded-lg bg-accent px-6 py-3 font-display text-base font-extrabold text-white transition-opacity disabled:opacity-60"
      >
        {pending ? 'Confirmation en cours…' : 'Je confirme mon consentement'}
      </button>
    </div>
  )
}
