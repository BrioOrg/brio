'use client'

import { svgAffineAt, svgMatrix, type DrawingTransformation } from '@brio/content'
import { useLayoutEffect, useRef, useState } from 'react'

import { bezier, moteur, suivre } from '@/components/chapitre-interactif/animation'
import { useModeChapitre } from '@/components/chapitre-interactif/mode-context'
import { FigureLayer } from '@/components/figure/figure-layer'
import { ease, motionS } from '@/lib/motion-tokens'

type Props = {
  layers: DrawingTransformation[]
  /** The figure block's id: the interactive mode reveals its images as steps. */
  blockId?: string
}

/**
 * The images of a figure's transformations (ADR 0041), each over its construction marks.
 *
 * In the interactive mode, a figure entered forward shows its source alone; each step (→, « Étape
 * suivante ») reveals the next image: a copy of the source moves onto it (slides, turns, scales,
 * folds over the axis), then the image takes its place with its names and construction marks.
 * Under reduced motion, or anywhere else, the images are simply there.
 */
export function TransformationLayers({ layers, blockId }: Props) {
  const ctx = useModeChapitre()
  const visibles =
    blockId !== undefined && ctx?.mode === 'interactif' ? ctx.etapesVisibles[blockId] : undefined
  // Step 1 is the source alone; step k + 1 adds the k-th image.
  const revealed = visibles === undefined ? layers.length : Math.max(0, visibles - 1)
  const reducedMotion = ctx?.reducedMotion ?? true

  const previous = useRef(revealed)
  const [moving, setMoving] = useState<number | null>(null)
  const ghost = useRef<SVGGElement>(null)
  const landed = useRef<SVGGElement>(null)

  useLayoutEffect(() => {
    const before = previous.current
    previous.current = revealed
    // Only the image revealed by this step moves; arriving on the slide is the slide's own beats.
    if (revealed !== before + 1) {
      setMoving(null)
      return
    }
    const m = moteur()
    if (m === null || reducedMotion) return
    setMoving(revealed - 1)
  }, [revealed, reducedMotion])

  useLayoutEffect(() => {
    if (moving === null) return
    const m = moteur()
    const layer = layers[moving]
    if (m === null || !layer) return
    const at = (t: number) =>
      ghost.current?.setAttribute('transform', svgMatrix(svgAffineAt(layer.motion, t, layer.frame)))
    at(0)
    const controls = suivre(
      m.animate(0, 1, {
        duration: motionS('finale', false),
        ease: bezier(ease.standard.bezier),
        onUpdate: at,
      })
    )
    let cancelled = false
    void controls.finished.then(() => {
      if (cancelled) return
      setMoving(null)
      // The names and construction marks settle in once the image is in place.
      requestAnimationFrame(() => {
        if (landed.current) {
          suivre(
            m.animate(
              landed.current,
              { opacity: [0, 1] },
              { duration: motionS('beat', false), ease: bezier(ease.standard.bezier) }
            )
          )
        }
      })
    })
    return () => {
      cancelled = true
    }
  }, [moving, layers])

  return (
    <>
      {layers.map((layer, i) => {
        if (i >= revealed) return null
        if (i === moving) {
          return (
            <g key={`mouvement-${i}`} ref={ghost} className="text-accent-ink" data-transformation="mouvement">
              <FigureLayer model={layer.ghost} fixedStroke />
            </g>
          )
        }
        const justLanded = i === revealed - 1 && moving === null
        return (
          <g key={`image-${i}`} data-transformation="image" ref={justLanded ? landed : undefined}>
            <g className="text-ink-muted">
              <FigureLayer model={layer.construction} />
            </g>
            <g className="text-accent-ink">
              <FigureLayer model={layer.image} />
            </g>
          </g>
        )
      })}
    </>
  )
}
