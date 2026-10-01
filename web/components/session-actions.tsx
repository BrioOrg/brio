'use client'

import { useEffect, useState } from 'react'
import { getMoi } from '@/lib/session'
import type { CompteInfo } from '@/lib/session'
import { EspaceEnseignantLink } from '@/components/espace-enseignant-link'
import { LogoutButton } from '@/components/logout-button'

/**
 * The account-dependent end of the top bar, for pages that are also served to
 * logged-out visitors (the public catalogue): the logout button and, for a
 * teacher, the way to the teacher space. It asks the backend who the caller is
 * and renders nothing until it knows — never a button for a session, nor a link
 * for a role, that we have not confirmed.
 */
export function SessionActions() {
  const [compte, setCompte] = useState<CompteInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    getMoi()
      .then((moi) => {
        if (!cancelled) setCompte(moi)
      })
      .catch(() => {
        // Unknown session state: keep everything hidden.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (compte === null) return null

  return (
    <>
      {compte.role === 'enseignant' && <EspaceEnseignantLink />}
      <LogoutButton labelFrom="lg" />
    </>
  )
}
