// The rules a chart block must follow beyond its JSON schema (ADR 0030 §9), in one place:
// scripts/check-content.mjs reports them in English for the catalogue, the teacher editor in
// French before publication (#229). Each issue is a code plus the facts its message needs, so
// every caller words it its own way.
//
// No imports: check-content loads this file with Node's type stripping, which does not resolve
// extensionless relative imports.

export const CHART_MIN_CATEGORIES = 2
export const CHART_MAX_CATEGORIES = 12
export const PIE_MAX_CATEGORIES = 6
export const CHART_MAX_GRADUATIONS = 20

/** Fields that only make sense with axes: a pie must not carry them. */
export const CHART_AXIS_FIELDS = ['xLabel', 'yLabel', 'yMax', 'yStep', 'showValues'] as const

export type ChartIssue =
  | { code: 'SERIES_COUNT'; path: 'series'; count: number }
  | { code: 'CATEGORY_COUNT'; path: string; kind: string; count: number; max: number }
  | { code: 'BLANK_LABEL'; path: string; index: number }
  | { code: 'DUPLICATE_LABEL'; path: string; index: number; label: string }
  | { code: 'NON_FINITE_VALUE'; path: string; index: number }
  | { code: 'NEGATIVE_BAR'; path: string; index: number }
  | { code: 'NON_POSITIVE_PIE'; path: string; index: number }
  | { code: 'PIE_AXIS_FIELD'; path: string; field: string }
  | { code: 'YMAX_BELOW_LARGEST'; path: 'yMax'; yMax: number; largest: number }
  | { code: 'YSTEP_NOT_POSITIVE'; path: 'yStep' }
  | { code: 'TOO_MANY_GRADUATIONS'; path: 'yStep'; graduations: number; max: number }

export type ChartIssueCode = ChartIssue['code']

/** The most categories a chart of this kind may have: 6 for a pie, 12 otherwise. */
export function maxCategories(kind: unknown): number {
  return kind === 'pie' ? PIE_MAX_CATEGORIES : CHART_MAX_CATEGORIES
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/**
 * Every rule a chart block breaks, in reading order. Paths are relative to the block:
 * `series[0].data[2].value`. An empty list means the chart is fine.
 */
export function checkChart(block: Record<string, unknown>): ChartIssue[] {
  const issues: ChartIssue[] = []
  const series = Array.isArray(block.series) ? block.series : []
  if (series.length !== 1) {
    issues.push({ code: 'SERIES_COUNT', path: 'series', count: series.length })
    return issues
  }
  const first: unknown = series[0]
  const data: unknown[] = isRecord(first) && Array.isArray(first.data) ? first.data : []
  const kind = block.kind
  const isPie = kind === 'pie'
  const max = maxCategories(kind)
  if (data.length < CHART_MIN_CATEGORIES || data.length > max) {
    issues.push({
      code: 'CATEGORY_COUNT',
      path: 'series[0].data',
      kind: String(kind),
      count: data.length,
      max,
    })
  }

  const seen = new Set<string>()
  data.forEach((d, index) => {
    const at = `series[0].data[${index}]`
    const datum = isRecord(d) ? d : {}
    const label = typeof datum.label === 'string' ? datum.label.trim() : ''
    if (label === '') issues.push({ code: 'BLANK_LABEL', path: at + '.label', index })
    else if (seen.has(label)) {
      issues.push({ code: 'DUPLICATE_LABEL', path: at + '.label', index, label })
    }
    seen.add(label)
    const value = datum.value
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ code: 'NON_FINITE_VALUE', path: at + '.value', index })
    } else if (isPie && value <= 0) {
      issues.push({ code: 'NON_POSITIVE_PIE', path: at + '.value', index })
    } else if (kind === 'bar' && value < 0) {
      issues.push({ code: 'NEGATIVE_BAR', path: at + '.value', index })
    }
  })

  if (isPie) {
    for (const field of CHART_AXIS_FIELDS) {
      if (block[field] !== undefined) issues.push({ code: 'PIE_AXIS_FIELD', path: field, field })
    }
    return issues
  }

  const values = data
    .map((d) => (isRecord(d) ? d.value : undefined))
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const largest = Math.max(0, ...values)
  const smallest = Math.min(0, ...values)
  const yMax = block.yMax
  const yStep = block.yStep
  if (typeof yMax === 'number' && yMax < largest) {
    issues.push({ code: 'YMAX_BELOW_LARGEST', path: 'yMax', yMax, largest })
  }
  if (yStep !== undefined) {
    if (!(typeof yStep === 'number' && yStep > 0)) {
      issues.push({ code: 'YSTEP_NOT_POSITIVE', path: 'yStep' })
    } else {
      const top = typeof yMax === 'number' ? yMax : largest
      const bottom = smallest < 0 ? Math.floor(smallest / yStep) * yStep : 0
      const graduations = (top - bottom) / yStep
      if (graduations > CHART_MAX_GRADUATIONS) {
        issues.push({
          code: 'TOO_MANY_GRADUATIONS',
          path: 'yStep',
          graduations: Math.ceil(graduations),
          max: CHART_MAX_GRADUATIONS,
        })
      }
    }
  }
  return issues
}
