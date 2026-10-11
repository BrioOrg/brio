'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { distance, duration, ease, type DurationName, type EaseName } from '@/lib/motion-tokens'

/* ── Motion tokens demo (#243) ───────────────────────────────────────────────
   Plain CSS transitions on `transform`, read from the tokens — no `motion`
   here. Under prefers-reduced-motion the tokens.css override makes every puck
   jump, which is the point: that is what the interactive mode does too. */

const DURATIONS: readonly (readonly [DurationName, string])[] = [
  ['fast', 'Micro-interaction'],
  ['base', 'Transition standard'],
  ['slow', 'Entrée / sortie'],
  ['press', 'Bouton enfoncé'],
  ['stagger', 'Délai entre deux temps'],
  ['slide-out', 'Sortie de diapo'],
  ['select', 'Sélection d’une option'],
  ['count', 'Compteur qui grimpe'],
  ['beat', 'Apparition d’un temps'],
  ['slide-in', 'Entrée de diapo'],
  ['sheet', 'Feuille de résultat'],
  ['check', 'Coche de réussite'],
  ['xp-flight', 'Envol des XP'],
  ['xp-delay', 'Pause avant l’envol des XP'],
  ['finale', 'Bilan de fin'],
  ['particles', 'Particules'],
]

const CURVES: readonly (readonly [EaseName, string])[] = [
  ['in', 'Diapos, feuille de résultat, envol des XP'],
  ['standard', 'Temps d’une diapo, étiquettes'],
  ['out-quint', 'Récompenses, sans dépassement'],
  ['out', 'Micro-interactions'],
  ['spring', 'Mode lecture seulement : dépasse sa cible'],
]

const DISTANCES: readonly (readonly [keyof typeof distance, string])[] = [
  ['beat-rise', 'Montée d’un temps'],
  ['slide-shift', 'Décalage d’une diapo'],
  ['particle-spread', 'Rayon des particules'],
]

/** A puck crossing its track: the whole track width, minus the puck itself. */
function Track({ moved, transition }: { moved: boolean; transition: string }) {
  return (
    <div className="h-6 flex-1 rounded-pill bg-surface-raised">
      <div
        className="h-6 w-full"
        style={{
          transform: moved ? 'translateX(calc(100% - var(--spacing) * 6))' : 'none',
          transition: `transform ${transition}`,
        }}
      >
        <span className="block size-6 rounded-pill bg-accent" />
      </div>
    </div>
  )
}

function Group({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: (moved: boolean) => React.ReactNode
}) {
  const [moved, setMoved] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
          <p className="text-sm text-ink-muted">{hint}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setMoved((m) => !m)}>
          Rejouer
        </Button>
      </div>
      {children(moved)}
    </div>
  )
}

function Row({
  label,
  detail,
  children,
}: {
  label: string
  detail: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <span className="font-prose text-sm text-ink sm:w-64 sm:shrink-0">
        <strong>{label}</strong>
        <br />
        <code className="text-xs text-ink-muted">{detail}</code>
      </span>
      {children}
    </div>
  )
}

export function MotionDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Group
        title="Durées"
        hint="Toutes sur la courbe standard, pour ne comparer que la durée. « Rejouer » fait l’aller puis le retour."
      >
        {(moved) =>
          DURATIONS.map(([name, label]) => (
            <Row key={name} label={label} detail={`--duration-${name} · ${duration[name]} ms`}>
              <Track moved={moved} transition={`var(--duration-${name}) var(--ease-standard)`} />
            </Row>
          ))
        }
      </Group>

      <Group
        title="Courbes"
        hint={`Toutes sur la même durée (--duration-particles, ${duration.particles} ms), pour ne comparer que la courbe.`}
      >
        {(moved) =>
          CURVES.map(([name, label]) => (
            <Row key={name} label={label} detail={`--ease-${name} · ${ease[name].css}`}>
              <Track moved={moved} transition={`var(--duration-particles) var(--ease-${name})`} />
            </Row>
          ))
        }
      </Group>

      <div className="flex flex-col gap-3">
        <h3 className="font-display text-base font-bold text-ink">Distances</h3>
        {DISTANCES.map(([name, label]) => (
          <Row key={name} label={label} detail={`--motion-${name} · ${distance[name]} px`}>
            <span
              className="block h-2 rounded-pill bg-accent"
              style={{ width: `var(--motion-${name})` }}
            />
          </Row>
        ))}
      </div>
    </div>
  )
}
