import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ChartSpec } from '@brio/content'
import { ChartRenderer } from '../chart-renderer'

const data = [
  { label: 'Football', value: 8 },
  { label: 'Basket', value: 5 },
  { label: 'Natation', value: 4 },
]
const bar: ChartSpec = { kind: 'bar', xLabel: 'Sport', series: [{ label: 'Effectif', data }] }
const pie: ChartSpec = { kind: 'pie', series: [{ label: 'Effectif', data }] }
const line: ChartSpec = {
  kind: 'line',
  series: [
    {
      label: 'Température (°C)',
      data: [
        { label: '6 h', value: -2.5 },
        { label: '12 h', value: 9 },
      ],
    },
  ],
}

describe('ChartRenderer', () => {
  it('should expose the alt text as the accessible name of the image', () => {
    render(<ChartRenderer spec={bar} alt="Diagramme en barres du sport préféré" />)
    expect(screen.getByRole('img', { name: 'Diagramme en barres du sport préféré' })).toBeDefined()
  })

  it('should give screen readers the exact data as a table', () => {
    render(<ChartRenderer spec={bar} alt="Sport préféré" title="Sport préféré des 5e B" />)
    const table = screen.getByRole('table', { name: 'Sport préféré des 5e B' })
    expect(within(table).getByRole('columnheader', { name: 'Sport' })).toBeDefined()
    expect(within(table).getByRole('columnheader', { name: 'Effectif' })).toBeDefined()
    const football = within(table).getByRole('row', { name: /Football/ })
    expect(within(football).getByRole('cell').textContent).toBe('8')
  })

  it('should write table values in French notation', () => {
    render(<ChartRenderer spec={line} alt="Températures" />)
    const row = screen.getByRole('row', { name: /6 h/ })
    expect(within(row).getByRole('cell').textContent).toBe('−2,5')
  })

  it('should draw one bar per category and no sector', () => {
    const { container } = render(<ChartRenderer spec={bar} alt="Barres" />)
    expect(container.querySelectorAll('rect')).toHaveLength(3)
    expect(container.querySelectorAll('path')).toHaveLength(0)
  })

  it('should not write the values on the chart unless asked', () => {
    const { container, rerender } = render(<ChartRenderer spec={bar} alt="Barres" />)
    const texts = () => Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent)
    // 0, 2, 4, 6, 8 on the axis, the three names and the axis title: never a bar's own value
    expect(texts().filter((t) => t === '5')).toHaveLength(0)
    rerender(<ChartRenderer spec={{ ...bar, showValues: true }} alt="Barres" />)
    expect(texts().filter((t) => t === '5')).toHaveLength(1)
  })

  it('should colour the sectors of a pie with the chart tokens, in order', () => {
    const { container } = render(<ChartRenderer spec={pie} alt="Secteurs" />)
    const classes = Array.from(container.querySelectorAll('path')).map((p) =>
      p.getAttribute('class')
    )
    expect(classes[0]).toContain('fill-chart-1')
    expect(classes[1]).toContain('fill-chart-2')
    expect(classes[2]).toContain('fill-chart-3')
  })

  it('should name every sector of a pie on the chart', () => {
    const { container } = render(<ChartRenderer spec={pie} alt="Secteurs" />)
    const texts = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent)
    expect(texts).toEqual(['Football', 'Basket', 'Natation'])
  })

  it('should draw a line chart as a polyline through one dot per category', () => {
    const { container } = render(<ChartRenderer spec={line} alt="Courbe" />)
    expect(container.querySelectorAll('polyline')).toHaveLength(1)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })

  it('should show the title above the chart and the caption below it', () => {
    render(
      <ChartRenderer spec={bar} alt="Barres" title="Sport préféré" caption="Enquête de septembre" />
    )
    expect(screen.getAllByText('Sport préféré')[0]).toBeDefined()
    expect(screen.getByText('Enquête de septembre', { selector: 'figcaption' })).toBeDefined()
  })
})
