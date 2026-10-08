import { describe, expect, it } from 'vitest'
import { buildChartModel, niceStep, valueScale, wrapLabel, type ChartSpec } from '../chart'

const sports: ChartSpec = {
  kind: 'bar',
  series: [
    {
      label: 'Effectif',
      data: [
        { label: 'Football', value: 8 },
        { label: 'Basket', value: 5 },
        { label: 'Natation', value: 4 },
        { label: 'Danse', value: 3 },
      ],
    },
  ],
}

describe('niceStep', () => {
  it('should pick 1, 2 or 5 × 10ⁿ for at most five intervals', () => {
    expect(niceStep(8)).toBe(2)
    expect(niceStep(5)).toBe(1)
    expect(niceStep(18)).toBe(5)
    expect(niceStep(240)).toBe(50)
    expect(niceStep(0.8)).toBe(0.2)
  })

  it('should fall back to 1 for an empty range', () => {
    expect(niceStep(0)).toBe(1)
  })
})

describe('valueScale', () => {
  it('should start at 0 and round the largest value up to the step', () => {
    expect(
      valueScale({
        ...sports,
        series: [
          {
            label: 'n',
            data: [
              { label: 'a', value: 7 },
              { label: 'b', value: 3 },
            ],
          },
        ],
      })
    ).toEqual({
      min: 0,
      max: 8,
      step: 2,
    })
  })

  it('should keep an author yMax and yStep', () => {
    expect(valueScale({ ...sports, yMax: 10, yStep: 1 })).toEqual({ min: 0, max: 10, step: 1 })
  })

  it('should derive the step from an author yMax', () => {
    expect(valueScale({ ...sports, yMax: 20 })).toEqual({ min: 0, max: 20, step: 5 })
  })

  it('should extend a line below 0 on the same step', () => {
    const temps: ChartSpec = {
      kind: 'line',
      series: [
        {
          label: '°C',
          data: [
            { label: 'lun', value: -3 },
            { label: 'mar', value: 6 },
          ],
        },
      ],
    }
    expect(valueScale(temps)).toEqual({ min: -4, max: 6, step: 2 })
  })
})

describe('wrapLabel', () => {
  it('should keep a short name on one line', () => {
    expect(wrapLabel('Basket', 8)).toEqual(['Basket'])
  })

  it('should split a long name at the space nearest its middle', () => {
    expect(wrapLabel('Sciences de la vie', 10)).toEqual(['Sciences', 'de la vie'])
  })

  it('should leave a single long word whole', () => {
    expect(wrapLabel('Anticonstitutionnel', 6)).toEqual(['Anticonstitutionnel'])
  })
})

describe('buildChartModel — bar', () => {
  const model = buildChartModel(sports)

  it('should draw one bar per category, with heights proportional to the values', () => {
    expect(model.bars).toHaveLength(4)
    const [football, basket] = model.bars
    expect(football!.height / basket!.height).toBeCloseTo(8 / 5)
  })

  it('should sit every bar on the baseline at value 0', () => {
    for (const bar of model.bars) expect(bar.y + bar.height).toBeCloseTo(model.baseline!.y1)
  })

  it('should graduate the value axis from 0 to 8 by 2, in French notation', () => {
    expect(model.valueAxis!.ticks.map((t) => t.label.lines[0])).toEqual(['0', '2', '4', '6', '8'])
  })

  it('should name every category under its bar', () => {
    expect(model.categoryLabels.map((l) => l.lines.join(' '))).toEqual([
      'Football',
      'Basket',
      'Natation',
      'Danse',
    ])
    model.categoryLabels.forEach((label, i) => {
      const bar = model.bars[i]!
      expect(label.x).toBeCloseTo(bar.x + bar.width / 2)
    })
  })

  it('should write no value unless showValues is set', () => {
    expect(model.valueLabels).toEqual([])
    const shown = buildChartModel({ ...sports, showValues: true })
    expect(shown.valueLabels.map((l) => l.lines[0])).toEqual(['8', '5', '4', '3'])
  })

  it('should title the axes only when asked', () => {
    expect(model.valueAxis!.title).toBeUndefined()
    expect(model.categoryAxisTitle).toBeNull()
    const titled = buildChartModel({ ...sports, xLabel: 'Sport', yLabel: 'Effectif' })
    expect(titled.valueAxis!.title!.lines).toEqual(['Effectif'])
    expect(titled.categoryAxisTitle!.lines).toEqual(['Sport'])
  })
})

describe('buildChartModel — line', () => {
  const temps: ChartSpec = {
    kind: 'line',
    series: [
      {
        label: 'Température (°C)',
        data: [
          { label: '6 h', value: -2 },
          { label: '12 h', value: 9 },
          { label: '18 h', value: 5.5 },
        ],
      },
    ],
  }
  const model = buildChartModel(temps)

  it('should place one point per category and no bar', () => {
    expect(model.bars).toEqual([])
    expect(model.line!.dots).toHaveLength(3)
  })

  it('should draw a negative value below the baseline', () => {
    expect(model.line!.dots[0]!.cy).toBeGreaterThan(model.baseline!.y1)
    expect(model.line!.dots[1]!.cy).toBeLessThan(model.baseline!.y1)
  })

  it('should write a decimal value with a comma', () => {
    const shown = buildChartModel({ ...temps, showValues: true })
    expect(shown.valueLabels.map((l) => l.lines[0])).toEqual(['−2', '9', '5,5'])
  })
})

describe('buildChartModel — pie', () => {
  const pie: ChartSpec = {
    kind: 'pie',
    series: [
      {
        label: 'Effectif',
        data: [
          { label: 'Football', value: 9 },
          { label: 'Basket', value: 6 },
          { label: 'Natation', value: 3 },
        ],
      },
    ],
  }
  const model = buildChartModel(pie)

  it('should draw one sector per category, coloured in order, with no axis', () => {
    expect(model.sectors.map((s) => s.slot)).toEqual([1, 2, 3])
    expect(model.valueAxis).toBeNull()
    expect(model.baseline).toBeNull()
  })

  it('should start at 12 o’clock and turn clockwise', () => {
    // Football is half the disc: from the top to the bottom, on the right-hand side.
    expect(model.sectors[0]!.d).toMatch(
      /^M 160\.00 120\.00 L 160\.00 48\.00 A 72 72 0 0 1 160\.00 192\.00 Z$/
    )
  })

  it('should use the large arc for a sector over half the disc', () => {
    const big = buildChartModel({
      ...pie,
      series: [
        {
          label: 'n',
          data: [
            { label: 'a', value: 3 },
            { label: 'b', value: 1 },
          ],
        },
      ],
    })
    expect(big.sectors[0]!.d).toContain(' 0 1 1 ')
    expect(big.sectors[1]!.d).toContain(' 0 0 1 ')
  })

  it('should name each category outside its sector, never with its value', () => {
    expect(model.categoryLabels.map((l) => l.lines.join(' '))).toEqual([
      'Football',
      'Basket',
      'Natation',
    ])
    expect(model.leaders).toHaveLength(3)
    expect(model.valueLabels).toEqual([])
    // Football's sector is on the right, so its name starts there.
    expect(model.categoryLabels[0]!.anchor).toBe('start')
  })

  it('should keep the names of small neighbouring sectors apart', () => {
    const crowded = buildChartModel({
      ...pie,
      series: [
        {
          label: 'n',
          data: [
            { label: 'A', value: 40 },
            { label: 'B', value: 1 },
            { label: 'C', value: 1 },
            { label: 'D', value: 1 },
            { label: 'E', value: 40 },
          ],
        },
      ],
    })
    const left = crowded.categoryLabels.filter((l) => l.anchor === 'end').map((l) => l.y)
    const sorted = [...left].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++)
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(13)
  })
})
