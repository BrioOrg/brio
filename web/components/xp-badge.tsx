'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { useProgression } from '@/components/progression-context'

/**
 * XP total + game level, shown at the right of the top bar (issue #80, mockup
 * 1-connexion-matiere-parcours). Values come straight from the progression
 * module. When the student isn't logged in the endpoint 401s and `info` is null:
 * we render nothing rather than a fabricated zero.
 *
 * On a real XP gain the counter gives a springy pop and a "+N XP" pill rises and
 * fades above it. Both are pure-motion CSS, so the global reduced-motion rule
 * disables them automatically.
 */
export function XpBadge() {
  const { info, gain } = useProgression()
  const [flash, setFlash] = useState<{ amount: number; id: number } | null>(null)
  const seenGain = useRef(0)

  useEffect(() => {
    if (!gain || gain.id === seenGain.current) return
    seenGain.current = gain.id
    setFlash(gain)
    const timer = setTimeout(() => setFlash(null), 1000)
    return () => clearTimeout(timer)
  }, [gain])

  if (!info) return null

  return (
    <div className="relative flex items-center gap-2" data-testid="xp-badge">
      <span
        className="rounded-full bg-accent-soft px-2 py-0.5 font-display text-xs font-extrabold text-accent-ink"
        aria-label={`Niveau ${info.niveau}`}
      >
        Nv.&nbsp;{info.niveau}
      </span>

      <span
        key={info.xpTotal}
        className="xp-pop flex items-center gap-1 font-display text-sm font-extrabold text-ink"
      >
        <Icon name="star" weight="bold" size={15} className="text-xp" />
        <span>{info.xpTotal}</span>
        <span className="sr-only">points d&apos;expérience (XP)</span>
      </span>

      {flash && (
        <span
          key={flash.id}
          aria-hidden="true"
          className="xp-rise pointer-events-none absolute -top-2 right-0 rounded-full bg-accent-soft px-2 py-0.5 font-display text-xs font-extrabold text-xp"
        >
          +{flash.amount}&nbsp;XP
        </span>
      )}
    </div>
  )
}
