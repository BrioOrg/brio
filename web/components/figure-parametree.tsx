'use client'

import { useId, useState } from 'react'

import { formatNumber, type FigureParameter, type FigureSpec } from '@brio/content'

import { FigureRenderer } from '@/components/figure-renderer'

// A figure whose expressions use parameters (ADR 0038 §6): one slider per letter, under the
// drawing, that moves the curves and their readings as it moves. The first render, and print,
// use each parameter's `value`; the sliders are not printed.

export function FigureParametree({
  spec,
  alt,
  caption,
}: {
  spec: FigureSpec
  alt: string
  caption?: string
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
      controls={
        <div className="mx-auto mt-2 flex max-w-80 flex-col gap-2 px-1 print:hidden">
          {parameters.map((p) => (
            <Curseur
              key={p.name}
              parameter={p}
              value={values[p.name] ?? p.value}
              onChange={(v) => setValues((old) => ({ ...old, [p.name]: v }))}
            />
          ))}
        </div>
      }
    />
  )
}

function Curseur({
  parameter,
  value,
  onChange,
}: {
  parameter: FigureParameter
  value: number
  onChange: (value: number) => void
}) {
  const id = useId()
  const { name, min, max, step } = parameter
  const texte = `${name} = ${formatNumber(value)}`
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 font-prose text-sm text-ink">
      {/* The value, written as on the board; the slider carries the same text for screen readers. */}
      <output htmlFor={id} aria-hidden="true" className="min-w-[6ch] tabular-nums">
        <i>{name}</i> = {formatNumber(value)}
      </output>
      <div className="flex flex-col">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={`Paramètre ${name}`}
          aria-valuetext={texte}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-pointer accent-accent"
        />
        <div
          aria-hidden="true"
          className="flex justify-between text-xs tabular-nums text-ink-muted"
        >
          <span>{formatNumber(min)}</span>
          <span>{formatNumber(max)}</span>
        </div>
      </div>
    </div>
  )
}
