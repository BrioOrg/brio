'use client'

import { useCallback, useEffect, useId, useMemo, useRef } from 'react'
import {
  buildSolidGeometry,
  coastView,
  dragVelocity,
  dragView,
  interpolateView,
  projectSolid,
  sameView,
  stepView,
  SOLID_INITIAL_VIEW,
  SOLID_SIZE,
  SOLID_VIEWBOX,
  type SolidFrame,
  type SolidKey,
  type SolidSpec,
  type SolidView,
} from '@brio/content'

import { HALO_CLASS } from '@/components/figure/halo'
import { Icon } from '@/components/ui/icon'
import { bezierAt } from '@/lib/courbe-bezier'
import { duration, ease } from '@/lib/motion-tokens'

// Hidden edges dashed exactly like the cavalière solids of a figure (ADR 0013, #215).
const DASH = '5 4'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
/** A release later than this after the last move is a stop, not a flick: no coasting. */
const FLICK_WINDOW_MS = 80

const PATHS = [
  'side',
  'front',
  'top',
  'sectionFill',
  'hidden',
  'sectionHidden',
  'sectionVisible',
  'visible',
  'dots',
  'hiddenDots',
] as const
type PathKey = (typeof PATHS)[number]

function pathData(frame: SolidFrame, key: PathKey): string {
  if (key === 'side' || key === 'front' || key === 'top') return frame.fills[key]
  return frame[key]
}

// Faint flat fills, one shade per orientation (the assemblage shades, ADR 0039 §3); the section
// is the one coloured object (maths tone 1, ADR 0037).
const PATH_PROPS: Record<PathKey, React.SVGProps<SVGPathElement>> = {
  side: { className: 'fill-cube-side/40' },
  front: { className: 'fill-cube-front/40' },
  top: { className: 'fill-cube-top/40' },
  sectionFill: { className: 'fill-tone-1-soft/80' },
  hidden: {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeDasharray: DASH,
    strokeLinejoin: 'round',
  },
  sectionHidden: {
    fill: 'none',
    className: 'stroke-tone-1',
    strokeWidth: 1.5,
    strokeDasharray: DASH,
    strokeLinejoin: 'round',
  },
  sectionVisible: {
    fill: 'none',
    className: 'stroke-tone-1',
    strokeWidth: 1.5,
    strokeLinejoin: 'round',
  },
  visible: { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' },
  dots: { fill: 'currentColor' },
  hiddenDots: { className: 'fill-ink-muted' },
}

const KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches
}

type Motion =
  | { kind: 'coast'; velocity: SolidView; last: number }
  | { kind: 'reset'; from: SolidView; start: number }

/**
 * A solid the student turns (ADR 0039). React renders the starting view once; while the solid
 * turns, each frame writes the path data and label positions straight to the SVG elements, so a
 * pointer move never re-renders the component.
 */
export function SolidRenderer({
  spec,
  alt,
  caption,
}: {
  spec: SolidSpec
  alt: string
  caption?: string
}) {
  const geometry = useMemo(() => buildSolidGeometry(spec), [spec])
  const initial = useMemo(() => projectSolid(geometry, SOLID_INITIAL_VIEW), [geometry])
  const hintId = useId()

  const surface = useRef<HTMLDivElement>(null)
  const paths = useRef<Partial<Record<PathKey, SVGPathElement | null>>>({})
  const labels = useRef<Array<SVGTextElement | null>>([])
  const view = useRef<SolidView>(SOLID_INITIAL_VIEW)
  const frameRequest = useRef<number | null>(null)
  const motion = useRef<Motion | null>(null)

  const paint = useCallback(
    (v: SolidView) => {
      const frame = projectSolid(geometry, v)
      for (const key of PATHS) paths.current[key]?.setAttribute('d', pathData(frame, key))
      frame.labels.forEach((l, i) => {
        const el = labels.current[i]
        if (!el) return
        el.setAttribute('x', String(l.x))
        el.setAttribute('y', String(l.y))
        el.setAttribute('text-anchor', l.anchor)
        el.setAttribute('dominant-baseline', l.baseline)
      })
    },
    [geometry]
  )

  /** One paint per animation frame, whatever the number of pointer moves in between. */
  const tick = useCallback(
    (now: number) => {
      frameRequest.current = null
      const m = motion.current
      if (m?.kind === 'coast') {
        const next = coastView(view.current, m.velocity, now - m.last, duration.slow)
        view.current = next.view
        motion.current = next.velocity ? { ...m, velocity: next.velocity, last: now } : null
      } else if (m?.kind === 'reset') {
        const t = Math.min(1, (now - m.start) / duration.slow)
        view.current = interpolateView(m.from, SOLID_INITIAL_VIEW, bezierAt(ease.out.bezier, t))
        if (t >= 1) motion.current = null
      }
      paint(view.current)
      if (motion.current) frameRequest.current = requestAnimationFrame(tick)
    },
    [paint]
  )

  const schedule = useCallback(() => {
    if (frameRequest.current === null) frameRequest.current = requestAnimationFrame(tick)
  }, [tick])

  const stop = useCallback(() => {
    motion.current = null
  }, [])

  const reset = useCallback(() => {
    if (sameView(view.current, SOLID_INITIAL_VIEW)) return
    if (reducedMotion()) {
      motion.current = null
      view.current = SOLID_INITIAL_VIEW
      paint(view.current)
      return
    }
    motion.current = { kind: 'reset', from: view.current, start: performance.now() }
    schedule()
  }, [paint, schedule])

  // A new spec (the editor's preview) starts again from the textbook view.
  useEffect(() => {
    motion.current = null
    view.current = SOLID_INITIAL_VIEW
    paint(SOLID_INITIAL_VIEW)
  }, [paint])

  useEffect(
    () => () => {
      if (frameRequest.current !== null) cancelAnimationFrame(frameRequest.current)
    },
    []
  )

  // Printing shows the starting view, as in the book.
  useEffect(() => {
    const onBeforePrint = () => {
      motion.current = null
      view.current = SOLID_INITIAL_VIEW
      paint(SOLID_INITIAL_VIEW)
    }
    window.addEventListener('beforeprint', onBeforePrint)
    return () => window.removeEventListener('beforeprint', onBeforePrint)
  }, [paint])

  // Native listeners: they run before the slide mode's swipe listener on the article, so a drag
  // on the solid turns it instead of changing slide.
  useEffect(() => {
    const el = surface.current
    if (!el) return
    let drag: { id: number; x: number; y: number; t: number; vx: number; vy: number } | null = null

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.stopPropagation()
      stop()
      el.setPointerCapture?.(e.pointerId)
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, vx: 0, vy: 0 }
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      e.stopPropagation()
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      const dt = Math.max(1, e.timeStamp - drag.t)
      // Smoothed pointer velocity, for the flick at release.
      drag = {
        ...drag,
        x: e.clientX,
        y: e.clientY,
        t: e.timeStamp,
        vx: 0.7 * drag.vx + 0.3 * (dx / dt),
        vy: 0.7 * drag.vy + 0.3 * (dy / dt),
      }
      view.current = dragView(view.current, dx, dy)
      schedule()
    }
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      e.stopPropagation()
      const { vx, vy, t } = drag
      drag = null
      if (reducedMotion() || e.timeStamp - t > FLICK_WINDOW_MS) return
      motion.current = { kind: 'coast', velocity: dragVelocity(vx, vy), last: performance.now() }
      schedule()
    }
    const onCancel = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
    }
  }, [schedule, stop])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (KEYS.includes(e.key)) {
      // Handled here: the slide mode's arrows see defaultPrevented and leave the slide alone.
      e.preventDefault()
      stop()
      view.current = stepView(view.current, e.key as SolidKey)
      paint(view.current)
    } else if (e.key === 'Home') {
      e.preventDefault()
      reset()
    }
  }

  return (
    <figure className="my-1 text-ink">
      <div
        ref={surface}
        tabIndex={0}
        role="group"
        aria-roledescription="solide à faire tourner"
        aria-label={alt}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        className="mx-auto block cursor-grab touch-pan-y select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
        style={{ maxWidth: SOLID_SIZE }}
      >
        <svg viewBox={SOLID_VIEWBOX} role="img" className="block w-full">
          <title>{alt}</title>
          {caption && <desc>{caption}</desc>}
          {PATHS.map((key) => (
            <path
              key={key}
              ref={(el) => {
                paths.current[key] = el
              }}
              d={pathData(initial, key)}
              {...PATH_PROPS[key]}
            />
          ))}
          {initial.labels.map((l, i) => (
            <text
              key={`${i}-${l.text}`}
              ref={(el) => {
                labels.current[i] = el
              }}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              dominantBaseline={l.baseline}
              fontSize={13}
              fontFamily="serif"
              fill="currentColor"
              // The figures' halo (ADR 0038): an edge turning under a name stops short of it.
              className={HALO_CLASS}
            >
              {l.text}
            </text>
          ))}
        </svg>
      </div>

      <div
        className="mx-auto mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 print:hidden"
        style={{ maxWidth: SOLID_SIZE }}
      >
        <p id={hintId} className="font-prose text-xs text-ink-muted">
          Fais-le tourner en le faisant glisser, ou avec les flèches du clavier.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 rounded-md font-display text-xs font-bold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="arrow-counter-clockwise" size={14} weight="bold" />
          Revenir à la vue de départ
        </button>
      </div>

      {caption && (
        <figcaption className="mt-1.5 text-center font-prose text-xs text-ink-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
