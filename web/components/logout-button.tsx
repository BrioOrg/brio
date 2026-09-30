'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logout } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

/**
 * Ends the session in one click, with no confirmation (PRINCIPLES.md: no
 * guilt-tripping on logout), then lands on /connexion — the next person on a
 * shared computer logs in from there. On failure the session is still open on
 * the server, and the message says so rather than pretending otherwise.
 */
export function LogoutButton() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleClick() {
    if (submitting) return
    setFailed(false)
    setSubmitting(true)
    try {
      await logout()
      router.push('/connexion')
      // Drop everything rendered for the previous session (XP, streak, class courses).
      router.refresh()
    } catch {
      setFailed(true)
      setSubmitting(false)
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={submitting}
        onClick={handleClick}
        className="px-2 sm:px-4"
      >
        <span className="flex items-center gap-2">
          <Icon name="sign-out" weight="bold" size={18} />
          {/* Narrow screens keep the icon only; the label stays for screen readers. */}
          <span className="sr-only sm:not-sr-only">Se déconnecter</span>
        </span>
      </Button>
      {failed && (
        <p
          role="alert"
          className="absolute right-0 top-full z-40 mt-2 w-max max-w-xs rounded-md border-2 border-feedback-incorrect bg-surface-raised px-3 py-2.5 font-prose text-sm text-feedback-incorrect"
        >
          La déconnexion a échoué : la session est toujours ouverte.
        </p>
      )}
    </div>
  )
}
