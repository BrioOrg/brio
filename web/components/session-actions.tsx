'use client'

import { useEffect, useState } from 'react'
import { getMoi } from '@/lib/session'
import type { CompteInfo } from '@/lib/session'
import { ConsoleModerationLink } from '@/components/console-moderation-link'
import { EspaceEnseignantLink } from '@/components/espace-enseignant-link'
import { LogoutButton } from '@/components/logout-button'
import { RoleBadge } from '@/components/role-badge'

/**
 * The account-dependent end of the top bar, for pages that are also served to
 * logged-out visitors (the public catalogue): the account's role (#285), the
 * logout button and, for a teacher, the way to the teacher space (for an admin_brio, the
 * moderation console). A teacher
 * browsing the catalogue still reads « Enseignant »: it is the account's role,
 * not a guess from the page. It asks the backend who the caller is
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
      <RoleBadge role={compte.role} />
      {compte.role === 'enseignant' && <EspaceEnseignantLink />}
      {compte.role === 'admin_brio' && <ConsoleModerationLink />}
      <LogoutButton labelFrom="lg" />
    </>
  )
}
