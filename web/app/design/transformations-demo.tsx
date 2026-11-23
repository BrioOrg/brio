import type { FigureSpec } from '@brio/content'

import { FigureRenderer } from '@/components/figure-renderer'

// The figures of ADR 0041 as a chapter would write them: the images, their names and the
// construction marks are computed; only the source, the centre, the axis or the vector are given.

const symetrieAxiale: FigureSpec = {
  points: [
    { name: 'A', x: -4, y: 0.5, label: { placement: 'below-left' } },
    { name: 'B', x: -1.5, y: 1, label: { placement: 'above-right' } },
    { name: 'C', x: -3, y: 3.5, label: { placement: 'above-left' } },
    { name: 'P', x: 0, y: -1, dot: false, showName: false },
    { name: 'Q', x: 0.6, y: 4, dot: false, showName: false },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
  lines: [{ through: ['P', 'Q'], label: '(d)' }],
  transformations: [
    {
      kind: 'symetrie-axiale',
      axis: ['P', 'Q'],
      source: ['A', 'B', 'C'],
      show: { construction: ['A', 'C'] },
    },
  ],
}

const symetrieCentrale: FigureSpec = {
  points: [
    { name: 'A', x: 1, y: 1, label: { placement: 'below-left' } },
    { name: 'B', x: 3, y: 0.5, label: { placement: 'below' } },
    { name: 'C', x: 2, y: 3, label: { placement: 'above' } },
    { name: 'O', x: 4, y: 2, label: { placement: 'below' } },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
  transformations: [
    {
      kind: 'symetrie-centrale',
      center: 'O',
      source: ['A', 'B', 'C'],
      show: { construction: ['A'] },
    },
  ],
}

const translation: FigureSpec = {
  points: [
    { name: 'A', x: 0, y: 0, label: { placement: 'below-left' } },
    { name: 'B', x: 2, y: 0, label: { placement: 'below-right' } },
    { name: 'C', x: 0.5, y: 2, label: { placement: 'above' } },
    { name: 'E', x: 1, y: -2.5, dot: false, showName: false },
    { name: 'F', x: 4.5, y: -1.5, dot: false, showName: false },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
  vectors: [{ from: 'E', to: 'F', label: '\\vec{u}' }],
  transformations: [
    {
      kind: 'translation',
      from: 'E',
      to: 'F',
      source: ['A', 'B', 'C'],
      show: { construction: ['C'] },
    },
  ],
}

const rotation: FigureSpec = {
  points: [
    { name: 'O', x: 0, y: 0, label: { placement: 'below-left' } },
    { name: 'A', x: 2, y: 0.5, label: { placement: 'below' } },
    { name: 'B', x: 4, y: 0.5, label: { placement: 'below-right' } },
    { name: 'C', x: 3, y: 2, label: { placement: 'right' } },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
  transformations: [
    {
      kind: 'rotation',
      center: 'O',
      angle: 90,
      source: ['A', 'B', 'C'],
      show: { construction: ['A'] },
    },
  ],
}

const homothetie: FigureSpec = {
  points: [
    { name: 'O', x: 0, y: 0, label: { placement: 'below' } },
    { name: 'A', x: 2, y: 0.5, label: { placement: 'below' } },
    { name: 'B', x: 4, y: 1, label: { placement: 'below-right' } },
    { name: 'C', x: 3, y: 3, label: { placement: 'above' } },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
  transformations: [
    {
      kind: 'homothetie',
      center: 'O',
      ratio: -0.5,
      source: ['A', 'B', 'C'],
      show: { construction: true },
    },
  ],
}

// Thalès: (MN) ∥ (BC), in the triangle and in the butterfly.
const thalesTriangle: FigureSpec = {
  points: [
    { name: 'A', x: 0, y: 4, label: { placement: 'above' } },
    { name: 'B', x: -2, y: 0, label: { placement: 'above-left' } },
    { name: 'C', x: 4, y: 0, label: { placement: 'above-right' } },
    { name: 'M', x: -1, y: 2, label: { placement: 'left' } },
    { name: 'N', x: 2, y: 2, label: { placement: 'right' } },
  ],
  rays: [
    { from: 'A', through: 'B' },
    { from: 'A', through: 'C' },
  ],
  segments: [
    { from: 'B', to: 'C' },
    { from: 'M', to: 'N' },
  ],
}

const thalesPapillon: FigureSpec = {
  points: [
    { name: 'A', x: 0, y: 0, label: { placement: 'below' } },
    { name: 'B', x: -3, y: 2, label: { placement: 'above-right' } },
    { name: 'C', x: -3, y: -1.5, label: { placement: 'below-right' } },
    { name: 'M', x: 2, y: -4 / 3, label: { placement: 'right' } },
    { name: 'N', x: 2, y: 1, label: { placement: 'above-left' } },
  ],
  lines: [{ through: ['B', 'M'] }, { through: ['C', 'N'] }],
  segments: [
    { from: 'B', to: 'C' },
    { from: 'M', to: 'N' },
  ],
}

const demos: { titre: string; spec: FigureSpec; alt: string }[] = [
  {
    titre: 'Symétrie axiale',
    spec: symetrieAxiale,
    alt: 'Le triangle ABC et son symétrique A′B′C′ par rapport à la droite (d), avec les perpendiculaires codées issues de A et de C.',
  },
  {
    titre: 'Symétrie centrale',
    spec: symetrieCentrale,
    alt: 'Le triangle ABC et son symétrique A′B′C′ par rapport au point O ; O est le milieu de [AA′].',
  },
  {
    titre: 'Translation',
    spec: translation,
    alt: 'Le triangle ABC et son image A′B′C′ par la translation de vecteur u.',
  },
  {
    titre: 'Rotation',
    spec: rotation,
    alt: 'Le triangle ABC et son image A′B′C′ par la rotation de centre O et d’angle 90° dans le sens direct.',
  },
  {
    titre: 'Homothétie',
    spec: homothetie,
    alt: 'Le triangle ABC et son image A′B′C′ par l’homothétie de centre O et de rapport −0,5.',
  },
  {
    titre: 'Thalès, triangle',
    spec: thalesTriangle,
    alt: 'Deux demi-droites issues de A ; M sur [AB], N sur [AC], les droites (MN) et (BC) sont parallèles.',
  },
  {
    titre: 'Thalès, papillon',
    spec: thalesPapillon,
    alt: 'Les droites (BM) et (CN) se coupent en A ; les droites (BC) et (MN) sont parallèles.',
  },
]

export function TransformationsDemo() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {demos.map((d) => (
        <div key={d.titre}>
          <p className="mb-2 font-prose text-xs text-ink-muted">{d.titre}</p>
          <FigureRenderer spec={d.spec} alt={d.alt} />
        </div>
      ))}
    </div>
  )
}
