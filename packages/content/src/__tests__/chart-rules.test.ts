import { describe, expect, it } from 'vitest'
import { checkChart } from '../chart-rules'

function chart(
  kind: string,
  data: Array<{ label?: unknown; value?: unknown }>,
  extra: Record<string, unknown> = {}
) {
  return { kind, series: [{ label: 'Effectif', data }], alt: 'Diagramme', ...extra }
}

const two = [
  { label: 'Football', value: 8 },
  { label: 'Basket', value: 5 },
]

describe('checkChart', () => {
  it('should accept a valid chart of each kind', () => {
    expect(checkChart(chart('bar', two))).toEqual([])
    expect(checkChart(chart('line', [...two, { label: 'Hiver', value: -3 }]))).toEqual([])
    expect(checkChart(chart('pie', two))).toEqual([])
  })

  it('should require exactly one series', () => {
    expect(checkChart({ kind: 'bar', series: [] })).toEqual([
      { code: 'SERIES_COUNT', path: 'series', count: 0 },
    ])
  })

  it('should bound the categories: 2 to 12, 6 for a pie', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ label: `C${i}`, value: 1 }))
    expect(checkChart(chart('bar', seven))).toEqual([])
    expect(checkChart(chart('pie', seven))).toEqual([
      { code: 'CATEGORY_COUNT', path: 'series[0].data', kind: 'pie', count: 7, max: 6 },
    ])
    expect(checkChart(chart('bar', two.slice(0, 1))).map((i) => i.code)).toEqual(['CATEGORY_COUNT'])
  })

  it('should reject blank and duplicated category names', () => {
    const issues = checkChart(
      chart('bar', [
        { label: ' ', value: 1 },
        { label: 'A', value: 2 },
        { label: 'A ', value: 3 },
      ])
    )
    expect(issues).toEqual([
      { code: 'BLANK_LABEL', path: 'series[0].data[0].label', index: 0 },
      { code: 'DUPLICATE_LABEL', path: 'series[0].data[2].label', index: 2, label: 'A' },
    ])
  })

  it('should check values by kind', () => {
    expect(checkChart(chart('bar', [...two, { label: 'X', value: -1 }]))[0]?.code).toBe(
      'NEGATIVE_BAR'
    )
    expect(checkChart(chart('pie', [...two, { label: 'X', value: 0 }]))[0]?.code).toBe(
      'NON_POSITIVE_PIE'
    )
    expect(checkChart(chart('line', [...two, { label: 'X' }]))[0]).toEqual({
      code: 'NON_FINITE_VALUE',
      path: 'series[0].data[2].value',
      index: 2,
    })
  })

  it('should forbid axis fields on a pie', () => {
    expect(checkChart(chart('pie', two, { xLabel: 'Sport', showValues: false }))).toEqual([
      { code: 'PIE_AXIS_FIELD', path: 'xLabel', field: 'xLabel' },
      { code: 'PIE_AXIS_FIELD', path: 'showValues', field: 'showValues' },
    ])
  })

  it('should check the graduations of the value axis', () => {
    expect(checkChart(chart('bar', two, { yMax: 6 }))[0]?.code).toBe('YMAX_BELOW_LARGEST')
    expect(checkChart(chart('bar', two, { yStep: 0 }))[0]?.code).toBe('YSTEP_NOT_POSITIVE')
    expect(checkChart(chart('bar', two, { yStep: 0.1 }))[0]).toEqual({
      code: 'TOO_MANY_GRADUATIONS',
      path: 'yStep',
      graduations: 80,
      max: 20,
    })
    expect(checkChart(chart('bar', two, { yMax: 10, yStep: 2 }))).toEqual([])
  })
})
