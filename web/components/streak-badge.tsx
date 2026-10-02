'use client'

import { Icon } from '@/components/ui/icon'
import { useProgression } from '@/components/progression-context'

/**
 * Day-streak flame in the top bar (issue #81, mockup 1-connexion-matiere-parcours).
 * Reads the real streak from the progression module, via ProgressionProvider. The
 * flame is hidden when there is no student session (null — logged out, or a teacher
 * or admin account) OR the streak is 0 — we never show "0 jour" (backlog design
 * rule): a flame only appears once there is a streak to celebrate.
 */
export function StreakBadge() {
  const { serie } = useProgression()

  if (!serie || serie.joursConsecutifs <= 0) return null

  const n = serie.joursConsecutifs
  const jours = `jour${n > 1 ? 's' : ''}`

  return (
    <span
      className="flex items-center gap-1 font-display text-sm font-extrabold text-ink"
      data-testid="streak-badge"
      title={`Série de ${n} ${jours}`}
    >
      <Icon name="flame" weight="bold" size={16} className="text-streak" />
      <span>{n}</span>
      <span className="sr-only">{jours} de série</span>
    </span>
  )
}
