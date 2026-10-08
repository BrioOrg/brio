import { formatNumber, type DrawingDot, type DrawingSegment } from './figure'

// --- Spec types (mirror the JSON schema, ADR 0030) ---

export type ChartKind = 'bar' | 'pie' | 'line'
export type ChartDatum = { label: string; value: number }
export type ChartSeries = { label: string; data: ChartDatum[] }

export type ChartSpec = {
  kind: ChartKind
  /** Exactly one series for now (ADR 0030 §2). */
  series: ChartSeries[]
  xLabel?: string
  yLabel?: string
  yMax?: number
  yStep?: number
  showValues?: boolean
}

// --- Drawing model types (resolved SVG coordinates) ---

/** A positioned text, split into lines when a category name is too wide for its slot. */
export type ChartText = {
  lines: string[]
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  baseline: 'auto' | 'hanging' | 'middle'
}

export type ChartValueAxis = {
  line: DrawingSegment
  ticks: Array<DrawingSegment & { label: ChartText }>
  /** Horizontal guides at each graduation, drawn behind the bars. */
  grid: DrawingSegment[]
  title?: ChartText
}

export type ChartBar = { x: number; y: number; width: number; height: number }

/** A pie sector; `slot` (1-6) picks its colour token, --color-chart-<slot>. */
export type ChartSector = { d: string; slot: number }

export type ChartModel = {
  viewBox: string
  /** bar and line only: the graduated value axis. */
  valueAxis: ChartValueAxis | null
  /** bar and line only: the category axis, at value 0. */
  baseline: DrawingSegment | null
  bars: ChartBar[]
  line: { points: string; dots: DrawingDot[] } | null
  sectors: ChartSector[]
  /** pie only: the short lines joining a sector to its category name. */
  leaders: DrawingSegment[]
  categoryLabels: ChartText[]
  /** Written only when showValues is set (never on a pie). */
  valueLabels: ChartText[]
  categoryAxisTitle: ChartText | null
}

// SVG canvas constants (pixels)
const WIDTH = 320
const HEIGHT = 240
const PAD_LEFT = 40
const PAD_RIGHT = 12
const PAD_TOP = 14
const AXIS_TITLE_ROOM = 16
const VALUE_LABEL_ROOM = 12
const CATEGORY_LINE_HEIGHT = 13
const CATEGORY_GAP = 6
const TICK_LEN = 4
const TICK_LABEL_GAP = 6
const BAR_RATIO = 0.6
const DOT_RADIUS = 3
/** Average advance of an 11px glyph, to decide when a category name must wrap. */
const CHAR_WIDTH = 6
const TARGET_INTERVALS = 5

const PIE_CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }
const PIE_RADIUS = 72
const LEADER_FROM = 2
const LEADER_TO = 10
const PIE_LABEL_OFFSET = 14
const PIE_LABEL_CHARS = 12

function fmt(n: number): string {
  return n.toFixed(2)
}

/** 1, 2 or 5 × 10ⁿ: the smallest such step cutting `range` into at most TARGET_INTERVALS. */
export function niceStep(range: number): number {
  if (!(range > 0)) return 1
  const raw = range / TARGET_INTERVALS
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 5, 10]) {
    if (m * magnitude >= raw - 1e-12) return Number((m * magnitude).toPrecision(12))
  }
  return 10 * magnitude
}

/**
 * The value scale of a bar or line chart: it starts at 0 (or below, for a line with negative
 * values, on the same step) and ends at yMax, or at the largest value rounded up to the step.
 */
export function valueScale(spec: ChartSpec): { min: number; max: number; step: number } {
  const values = spec.series[0]?.data.map((d) => d.value) ?? []
  const largest = Math.max(0, ...values)
  const smallest = Math.min(0, ...values)
  const step = spec.yStep ?? niceStep((spec.yMax ?? largest) - smallest)
  const min = smallest < 0 ? Math.floor(smallest / step - 1e-9) * step : 0
  const max = spec.yMax ?? Math.max(step, Math.ceil(largest / step - 1e-9) * step)
  return { min, max, step }
}

/** Splits a name at the space nearest its middle when it is wider than `maxChars`. */
export function wrapLabel(label: string, maxChars: number): string[] {
  if (label.length <= maxChars) return [label]
  const middle = label.length / 2
  let best = -1
  for (let i = 0; i < label.length; i++) {
    if (label[i] === ' ' && (best < 0 || Math.abs(i - middle) < Math.abs(best - middle))) best = i
  }
  return best < 0 ? [label] : [label.slice(0, best), label.slice(best + 1)]
}

export function buildChartModel(spec: ChartSpec): ChartModel {
  return spec.kind === 'pie' ? buildPie(spec) : buildAxes(spec)
}

function buildAxes(spec: ChartSpec): ChartModel {
  const data = spec.series[0]?.data ?? []
  const { min, max, step } = valueScale(spec)

  const top =
    PAD_TOP + (spec.yLabel ? AXIS_TITLE_ROOM : 0) + (spec.showValues ? VALUE_LABEL_ROOM : 0)
  const bottom =
    HEIGHT - CATEGORY_GAP - 2 * CATEGORY_LINE_HEIGHT - (spec.xLabel ? AXIS_TITLE_ROOM : 0) - 4
  const left = PAD_LEFT
  const right = WIDTH - PAD_RIGHT
  const toY = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top)
  const slot = (right - left) / Math.max(1, data.length)
  const center = (i: number) => left + slot * (i + 0.5)
  const zeroY = toY(0)

  const ticks: ChartValueAxis['ticks'] = []
  const grid: DrawingSegment[] = []
  const count = Math.floor((max - min) / step + 1e-9)
  for (let k = 0; k <= count; k++) {
    const value = min + k * step
    const y = toY(value)
    ticks.push({
      x1: left - TICK_LEN,
      y1: y,
      x2: left,
      y2: y,
      label: {
        lines: [formatNumber(value)],
        x: left - TICK_LABEL_GAP,
        y,
        anchor: 'end',
        baseline: 'middle',
      },
    })
    if (Math.abs(value) > 1e-9) grid.push({ x1: left, y1: y, x2: right, y2: y })
  }

  const valueAxis: ChartValueAxis = {
    line: { x1: left, y1: toY(min), x2: left, y2: toY(max) },
    ticks,
    grid,
    title: spec.yLabel
      ? {
          lines: [spec.yLabel],
          x: left - TICK_LABEL_GAP,
          y: PAD_TOP,
          anchor: 'start',
          baseline: 'hanging',
        }
      : undefined,
  }

  const maxChars = Math.max(1, Math.floor(slot / CHAR_WIDTH))
  const labelTop = toY(min) + CATEGORY_GAP
  const categoryLabels: ChartText[] = data.map((d, i) => ({
    lines: wrapLabel(d.label, maxChars),
    x: center(i),
    y: labelTop,
    anchor: 'middle',
    baseline: 'hanging',
  }))

  const bars: ChartBar[] =
    spec.kind === 'bar'
      ? data.map((d, i) => {
          const width = slot * BAR_RATIO
          const y = toY(Math.max(d.value, 0))
          return { x: center(i) - width / 2, y, width, height: Math.abs(toY(d.value) - zeroY) }
        })
      : []

  const line =
    spec.kind === 'line'
      ? {
          points: data.map((d, i) => `${fmt(center(i))},${fmt(toY(d.value))}`).join(' '),
          dots: data.map((d, i) => ({ cx: center(i), cy: toY(d.value) })),
        }
      : null

  const valueLabels: ChartText[] = spec.showValues
    ? data.map((d, i) => ({
        lines: [formatNumber(d.value)],
        x: center(i),
        y: toY(Math.max(d.value, 0)) - (spec.kind === 'line' ? DOT_RADIUS + 4 : 4),
        anchor: 'middle',
        baseline: 'auto',
      }))
    : []

  return {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    valueAxis,
    baseline: { x1: left, y1: zeroY, x2: right, y2: zeroY },
    bars,
    line,
    sectors: [],
    leaders: [],
    categoryLabels,
    valueLabels,
    categoryAxisTitle: spec.xLabel
      ? {
          lines: [spec.xLabel],
          x: (left + right) / 2,
          y: HEIGHT - 4,
          anchor: 'middle',
          baseline: 'auto',
        }
      : null,
  }
}

// Angles are measured clockwise from 12 o'clock, as a pie is read.
function polar(angle: number, radius: number): { x: number; y: number } {
  return {
    x: PIE_CENTER.x + radius * Math.sin(angle),
    y: PIE_CENTER.y - radius * Math.cos(angle),
  }
}

function buildPie(spec: ChartSpec): ChartModel {
  const data = spec.series[0]?.data ?? []
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const { x: cx, y: cy } = PIE_CENTER
  const r = PIE_RADIUS

  const sectors: ChartSector[] = []
  const leaders: DrawingSegment[] = []
  const labels: Array<ChartText & { side: number }> = []

  let start = 0
  data.forEach((d, i) => {
    const sweep = total > 0 ? (d.value / total) * 2 * Math.PI : 0
    const end = start + sweep
    const slot = (i % 6) + 1

    if (sweep >= 2 * Math.PI - 1e-9) {
      // A single category fills the disc: an arc cannot start and end on the same point.
      sectors.push({
        d: `M ${fmt(cx)} ${fmt(cy - r)} A ${r} ${r} 0 1 1 ${fmt(cx)} ${fmt(cy + r)} A ${r} ${r} 0 1 1 ${fmt(cx)} ${fmt(cy - r)} Z`,
        slot,
      })
    } else {
      const p0 = polar(start, r)
      const p1 = polar(end, r)
      const large = sweep > Math.PI ? 1 : 0
      sectors.push({
        d: `M ${fmt(cx)} ${fmt(cy)} L ${fmt(p0.x)} ${fmt(p0.y)} A ${r} ${r} 0 ${large} 1 ${fmt(p1.x)} ${fmt(p1.y)} Z`,
        slot,
      })
    }

    const mid = start + sweep / 2
    const from = polar(mid, r + LEADER_FROM)
    const to = polar(mid, r + LEADER_TO)
    leaders.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })
    const at = polar(mid, r + PIE_LABEL_OFFSET)
    const sin = Math.sin(mid)
    const cos = Math.cos(mid)
    labels.push({
      lines: wrapLabel(d.label, PIE_LABEL_CHARS),
      x: at.x,
      y: at.y,
      anchor: sin > 0.15 ? 'start' : sin < -0.15 ? 'end' : 'middle',
      baseline: cos > 0.7 ? 'auto' : cos < -0.7 ? 'hanging' : 'middle',
      side: sin >= 0 ? 1 : -1,
    })
    start = end
  })

  // Small neighbouring sectors put their names on top of each other: on each side, push a name
  // down until it clears the one above.
  for (const side of [1, -1]) {
    const onSide = labels
      .filter((l) => l.side === side && l.anchor !== 'middle')
      .sort((a, b) => a.y - b.y)
    for (let i = 1; i < onSide.length; i++) {
      const prev = onSide[i - 1]
      const cur = onSide[i]
      if (!prev || !cur) continue
      const clear = prev.y + prev.lines.length * CATEGORY_LINE_HEIGHT
      if (cur.y < clear) cur.y = clear
    }
  }

  return {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    valueAxis: null,
    baseline: null,
    bars: [],
    line: null,
    sectors,
    leaders,
    categoryLabels: labels.map(({ side: _side, ...label }) => label),
    valueLabels: [],
    categoryAxisTitle: null,
  }
}
