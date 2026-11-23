'use client'

import { useState } from 'react'

import type { FigureSpec } from '@brio/content'

import { Curseur } from '@/components/curseur'
import { FigureRenderer } from '@/components/figure-renderer'

// A figure whose expressions use parameters (ADR 0038 §6): one slider per letter, under the
// drawing, that moves the curves and their readings as it moves. The first render, and print,
// use each parameter's `value`; the sliders are not printed.

export function FigureParametree({
  spec,
  alt,
  caption,
  sansLienCalculatrice,
}: {
  spec: FigureSpec
  alt: string
  caption?: string
  sansLienCalculatrice?: boolean
}) {
  const parameters = spec.parameters ?? []
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(parameters.map((p) => [p.name, p.value]))
  )

  return (
    <FigureRenderer
      spec={spec}
      alt={alt}
      caption={caption}
      parameterValues={values}
      sansLienCalculatrice={sansLienCalculatrice}
      controls={
        <div className="mx-auto mt-2 flex max-w-80 flex-col gap-2 px-1 print:hidden">
          {parameters.map((p) => (
            <Curseur
              key={p.name}
              nom={p.name}
              min={p.min}
              max={p.max}
              pas={p.step}
              label={`Paramètre ${p.name}`}
              valeur={values[p.name] ?? p.value}
              onChange={(v) => setValues((old) => ({ ...old, [p.name]: v }))}
            />
          ))}
        </div>
      }
    />
  )
}
