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
