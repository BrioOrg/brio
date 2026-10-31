'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useTransition } from 'react'

/** Fetches the thread again from the server, the only source of counts and states on the page. */
export function useActualiserFil() {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const actualiser = useCallback(() => demarrer(() => router.refresh()), [router])
  return { actualiser, enCours }
}
