'use client'

import { useEffect, useRef, useState } from 'react'
import { useProgression } from '@/components/progression-context'
import { getParcours } from '@/lib/progression'
import { getMoi } from '@/lib/session'

/**
 * What the end slide needs from `progression` (#249), gathered while the chapter is open:
 *
 * - the XP of this session: the sum of the real gains `ProgressionProvider` reports from the
 *   chapter's opening on, whatever the mode they were earned in;
 * - this chapter's completion when it opened, then again each time the end slide opens. Sections
 *   read and exercises solved are recorded asynchronously (ADR 0022), the last section only as the
 *   student enters the end slide, so that read polls a little until the value moves.
 *
 * A teacher, a visitor or a failed read leaves everything null: the slide then draws no line.
 */

const POLL_ATTEMPTS = 5
const POLL_DELAY_MS = 300

export type BilanSession = {
  xpSession: number | null
  completion: { avant: number | null; actuelle: number | null }
}

type Props = {
  niveau: string
  matiere: string
  slug: string
  /** The end slide is open: the moment to read the completion again. */
  finOuverte: boolean
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function useBilanSession({
  niveau,
  matiere,
  slug,
  finOuverte,
}: Props): BilanSession {
  const { gain } = useProgression()
  const [eleve, setEleve] = useState(false)
  const [xp, setXp] = useState(0)
  const [avant, setAvant] = useState<number | null>(null)
  const [actuelle, setActuelle] = useState<number | null>(null)

  // Only gains reported after the chapter opened belong to this session.
  const gainVu = useRef(gain?.id ?? 0)
  useEffect(() => {
    if (!gain || gain.id <= gainVu.current) return
    gainVu.current = gain.id
    setXp((x) => x + gain.amount)
  }, [gain])

  const lire = useRef<(() => Promise<{ pourcentage: number | null }>) | null>(null)
  lire.current = async () => {
    const parcours = await getParcours(niveau, matiere)
    const ici = parcours?.find((c) => c.chapitreId === slug)
    return { pourcentage: ici?.pourcentage ?? null }
  }

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const moi = await getMoi()
        if (!alive || moi?.role !== 'eleve') return
        setEleve(true)
        const lu = await lire.current!()
        if (!alive) return
        setAvant(lu.pourcentage)
        setActuelle(lu.pourcentage)
      } catch {
        // No value rather than a fabricated one.
      }
    })()
    return () => {
      alive = false
    }
  }, [niveau, matiere, slug])

  const derniere = useRef<number | null>(null)
  derniere.current = actuelle
  useEffect(() => {
    if (!finOuverte || !eleve) return
    let alive = true
    const depart = derniere.current
    void (async () => {
      for (let attempt = 0; attempt < POLL_ATTEMPTS && alive; attempt++) {
        try {
          const lu = await lire.current!()
          if (!alive) return
          if (lu.pourcentage !== null) setActuelle(lu.pourcentage)
          if (lu.pourcentage !== null && lu.pourcentage !== depart) return
        } catch {
          // Transient: keep the last value read and try again.
        }
        if (attempt < POLL_ATTEMPTS - 1) await wait(POLL_DELAY_MS)
      }
    })()
    return () => {
      alive = false
    }
  }, [finOuverte, eleve])

  return {
    xpSession: eleve ? xp : null,
    completion: { avant, actuelle },
  }
}
