'use client'

import { useEffect, useState } from 'react'
import { getMoi } from '@/lib/session'
import { LogoutButton } from '@/components/logout-button'

/**
 * The logout button for pages that are also served to logged-out visitors (the
 * public catalogue). It asks the backend whether a session exists and renders
 * nothing until it knows there is one — never a button for a session we have
 * not confirmed.
 */
export function SessionLogoutButton() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMoi()
      .then((compte) => {
        if (!cancelled) setConnected(compte !== null)
      })
      .catch(() => {
        // Unknown session state: keep the button hidden.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return connected ? <LogoutButton labelFrom="lg" /> : null
}
