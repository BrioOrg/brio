import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseScratch } from '@brio/content'
import { ScratchBlocks } from '../scratch-blocks'

const code = [
  'quand le drapeau vert est cliqué',
  'mettre résultat à ((x * 3) + 4)',
  'répéter 4 fois',
  '    avancer de 50 pas',
  'fin',
].join('\n')

function renderProgramme() {
  const parsed = parseScratch(code)
  if (!parsed.ok) throw new Error('fixture does not parse')
  return render(<ScratchBlocks id="code-1" code={code} script={parsed.script} />)
}

describe('ScratchBlocks', () => {
  it('should give screen readers the source text, with its parentheses and fin', () => {
    renderProgramme()
    const figure = screen.getByRole('figure', { name: 'Programme Scratch' })
    expect(figure.id).toBe('code-1')
    expect(figure.querySelector('pre')?.textContent).toBe(code)
  })

  it('should hide the drawn blocks from assistive technology', () => {
    const { container } = renderProgramme()
    const drawing = container.querySelector('[aria-hidden]')
    expect(drawing?.textContent).toContain('répéter')
    expect(drawing?.querySelector('pre')).toBeNull()
  })

  it('should write the real * of Scratch and the block wording', () => {
    const { container } = renderProgramme()
    const drawing = container.querySelector('[aria-hidden]')
    const text = drawing?.textContent ?? ''
    expect(text).toContain('*')
    expect(text).toContain('mettre')
    expect(text).toContain('avancer de')
    expect(text).toContain('fois')
  })

  it('should colour each block with its category token', () => {
    const { container } = renderProgramme()
    expect(container.querySelector('.bg-scratch-events')).not.toBeNull()
    expect(container.querySelector('.bg-scratch-variables')).not.toBeNull()
    expect(container.querySelector('.bg-scratch-operators')).not.toBeNull()
    expect(container.querySelector('.bg-scratch-control')).not.toBeNull()
    expect(container.querySelector('.bg-scratch-motion')).not.toBeNull()
  })
})

// --- 4e: conditions, comparisons, logical operators, répéter jusqu'à, pen (#234) ---

function renderCode(source: string) {
  const parsed = parseScratch(source)
  if (!parsed.ok) throw new Error('fixture does not parse: ' + JSON.stringify(parsed.errors))
  return render(<ScratchBlocks code={source} script={parsed.script} />)
}

describe('ScratchBlocks — 4e blocks', () => {
  it('should draw a comparison condition as a hexagon (clip-path), not a pill', () => {
    const { container } = renderCode('si (x > 10) alors\n    dire « grand »\nfin')
    const hexagon = container.querySelector('[class*="clip-path"]')
    expect(hexagon).not.toBeNull()
    expect(hexagon?.textContent).toContain('>')
    // The boolean keeps the operators colour, like the arithmetic reporters.
    expect(hexagon?.className).toContain('bg-scratch-operators')
    const drawing = container.querySelector('[aria-hidden]')
    expect(drawing?.textContent).toContain('si')
    expect(drawing?.textContent).toContain('alors')
  })

  it('should nest a logical boolean around two comparison hexagons', () => {
    const { container } = renderCode('si ((x > 0) et (x < 10)) alors\n    dire 1\nfin')
    const hexagons = container.querySelectorAll('[class*="clip-path"]')
    // One outer logical hexagon and two inner comparison hexagons.
    expect(hexagons.length).toBe(3)
    expect(container.querySelector('[aria-hidden]')?.textContent).toContain('et')
  })

  it('should draw a si … sinon with its sinon separator row', () => {
    const { container } = renderCode(
      'si (n = 0) alors\n    dire « a »\nsinon\n    dire « b »\nfin'
    )
    const drawing = container.querySelector('[aria-hidden]')
    expect(drawing?.textContent).toContain('sinon')
    expect(drawing?.textContent).toContain('alors')
    // The if block carries the control colour, like répéter.
    expect(container.querySelector('.bg-scratch-control')).not.toBeNull()
  })

  it('should draw répéter jusqu’à ce que with a boolean condition', () => {
    const { container } = renderCode("répéter jusqu'à ce que (n = 0)\n    dire 1\nfin")
    const drawing = container.querySelector('[aria-hidden]')
    expect(drawing?.textContent).toContain("répéter jusqu'à ce que")
    expect(container.querySelector('[class*="clip-path"]')).not.toBeNull()
  })

  it('should draw the pen blocks with the pen category token', () => {
    const { container } = renderCode(
      "stylo en position d'écriture\neffacer tout\nrelever le stylo"
    )
    expect(container.querySelectorAll('.bg-scratch-pen').length).toBe(3)
    const drawing = container.querySelector('[aria-hidden]')
    expect(drawing?.textContent).toContain("stylo en position d'écriture")
    expect(drawing?.textContent).toContain('effacer tout')
    expect(drawing?.textContent).toContain('relever le stylo')
  })
})
