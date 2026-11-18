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
    // Each hexagon is two clipped layers (edge behind fill, #354): count the outlines.
    const hexagons = container.querySelectorAll('[class*="clip-path"].bg-scratch-operators-edge')
    // One outer logical hexagon and two inner comparison hexagons.
    expect(hexagons.length).toBe(3)
    expect(container.querySelectorAll('[class*="clip-path"].bg-scratch-operators').length).toBe(3)
    expect(container.querySelector('[aria-hidden]')?.textContent).toContain('et')
  })

  it('should draw a si … sinon with its sinon separator row', () => {
    const { container } = renderCode('si (n = 0) alors\n    dire « a »\nsinon\n    dire « b »\nfin')
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
    const { container } = renderCode("stylo en position d'écriture\neffacer tout\nrelever le stylo")
    expect(container.querySelectorAll('.bg-scratch-pen').length).toBe(3)
    const drawing = container.querySelector('[aria-hidden]')
    expect(drawing?.textContent).toContain("stylo en position d'écriture")
    expect(drawing?.textContent).toContain('effacer tout')
    expect(drawing?.textContent).toContain('relever le stylo')
  })
})

describe('ScratchBlocks — porte 5/6 (#354)', () => {
  it('should outline a hexagon: a clipped edge layer around a clipped fill, both pointed', () => {
    const { container } = renderCode('si (x > 10) alors\n    dire 1\nfin')
    const edge = container.querySelector('[class*="clip-path"].bg-scratch-operators-edge')
    const fill = edge?.firstElementChild
    expect(edge?.className).toContain('p-px')
    expect(fill?.className).toContain('bg-scratch-operators')
    expect(fill?.className).toContain('clip-path')
    // The points of the hexagon, not a rectangle.
    expect(edge?.className).toContain('100%_50%')
    expect(edge?.className).toContain('0_50%')
    expect(fill?.textContent).toContain('>')
  })

  it('should draw the alors branch before sinon and the sinon branch after it', () => {
    const { container } = renderCode(
      'si (n = 0) alors\n    dire « oui »\nsinon\n    dire « non »\nfin'
    )
    const t = container.querySelector('[aria-hidden]')?.textContent ?? ''
    expect(t.indexOf('oui')).toBeGreaterThan(-1)
    expect(t.indexOf('oui')).toBeLessThan(t.indexOf('sinon'))
    expect(t.indexOf('sinon')).toBeLessThan(t.lastIndexOf('non'))
    expect(t.lastIndexOf('non')).toBeGreaterThan(t.indexOf('sinon') + 'sinon'.length)
  })

  it('should draw non as a hexagon around its boolean', () => {
    const { container } = renderCode('si (non (x = 3)) alors\n    dire 1\nfin')
    const outer = container.querySelector('[class*="clip-path"].bg-scratch-operators-edge')
    expect(outer?.textContent).toMatch(/^non/)
    expect(outer?.querySelectorAll('[class*="clip-path"].bg-scratch-operators-edge').length).toBe(1)
  })

  it('should let the keyboard reach a programme that scrolls sideways', () => {
    renderCode('dire 1')
    expect(screen.getByRole('figure', { name: 'Programme Scratch' }).tabIndex).toBe(0)
  })
})
