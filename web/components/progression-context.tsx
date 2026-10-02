'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getProgression, getSerie, type ProgressionInfo, type SerieInfo } from '@/lib/progression'
import { getMoi } from '@/lib/session'

/**
 * Shared XP, level and day-streak state for the app shell. The top-bar badges read it, and the
 * exercise widget calls `refresh()` after a correct answer to pull the new total
 * and drive the "+XP" reward — always from real backend data (issue #80).
 *
 * XP is awarded asynchronously (ADR 0022): the progression listener runs after
 * the submission transaction commits, so a re-read immediately after a correct
 * answer can still see the old total. `refresh()` therefore polls a few times,
 * briefly, until the award lands. If nothing changes — daily cap reached, or the
 * exercise was already rewarded (idempotence) — the delta is 0 and no gain is
 * shown. There is no path that displays a fabricated number.
 *
 * XP and streaks are student rewards: for any other account (teacher, admin) the
 * provider never reads progression, so both badges stay hidden and refresh() is a
 * no-op.
 */

const POLL_ATTEMPTS = 4
const POLL_DELAY_MS = 200

type Gain = { amount: number; id: number }

type ProgressionValue = {
  /** Current XP + level, or null while unknown / logged out. */
  info: ProgressionInfo | null
  /** Current day streak, or null while unknown / logged out / not a student. */
  serie: SerieInfo | null
  /** The last positive XP gain observed, for reward animations. */
  gain: Gain | null
  /**
   * Re-read progression after an action that may have awarded XP.
   * Returns the real delta (0 when nothing was awarded).
   */
  refresh: () => Promise<number>
}

const ProgressionContext = createContext<ProgressionValue>({
  info: null,
  serie: null,
  gain: null,
  refresh: async () => 0,
})

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function ProgressionProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<ProgressionInfo | null>(null)
  const [serie, setSerie] = useState<SerieInfo | null>(null)
  const [gain, setGain] = useState<Gain | null>(null)
  // Latest known info, read inside refresh() without re-creating the callback.
  const infoRef = useRef<ProgressionInfo | null>(null)
  const gainId = useRef(0)
  // Only a confirmed student account gets XP; false until getMoi() says so.
  const estEleve = useRef(false)

  const applyInfo = useCallback((next: ProgressionInfo | null) => {
    infoRef.current = next
    setInfo(next)
  }, [])

  useEffect(() => {
    let alive = true
    getMoi()
      .then((moi) => {
        if (!alive || moi?.role !== 'eleve') return
        estEleve.current = true
        getProgression()
          .then((p) => {
            if (alive && p) applyInfo(p)
          })
          .catch(() => {
            // Leave info null — the badge stays hidden rather than showing a zero.
          })
        getSerie()
          .then((s) => {
            if (alive) setSerie(s)
          })
          .catch(() => {
            // Leave hidden rather than showing a fabricated streak.
          })
      })
      .catch(() => {
        // Unknown session: no XP, no streak.
      })
    return () => {
      alive = false
    }
  }, [applyInfo])

  const refresh = useCallback(async (): Promise<number> => {
    if (!estEleve.current) return 0
    const before = infoRef.current?.xpTotal ?? null
    let latest = infoRef.current
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      try {
        const fresh = await getProgression()
        if (fresh) latest = fresh
        // First read (nothing to diff against) or the award has landed → stop.
        if (fresh && (before === null || fresh.xpTotal > before)) break
      } catch {
        // Transient error — keep the last known total and try again.
      }
      if (attempt < POLL_ATTEMPTS - 1) await wait(POLL_DELAY_MS)
    }
    if (!latest) return 0
    applyInfo(latest)
    const delta = before === null ? 0 : latest.xpTotal - before
    if (delta > 0) {
      gainId.current += 1
      setGain({ amount: delta, id: gainId.current })
      return delta
    }
    return 0
  }, [applyInfo])

  return (
    <ProgressionContext.Provider value={{ info, serie, gain, refresh }}>
      {children}
    </ProgressionContext.Provider>
  )
}

export function useProgression() {
  return useContext(ProgressionContext)
}
