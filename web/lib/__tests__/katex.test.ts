import { describe, expect, it, vi } from 'vitest'

import { LATEX_MAX_LENGTH, renderKatex } from '../katex'

describe('renderKatex', () => {
  it('renders a formula', () => {
    expect(renderKatex('x^2', false)).toContain('class="katex"')
  })

  // KaTeX keeps the source in an <annotation>, as escaped text: only real elements count.
  function rendered(latex: string): HTMLElement {
    const root = document.createElement('div')
    root.innerHTML = renderKatex(latex, false)
    root.querySelectorAll('annotation').forEach((annotation) => annotation.remove())
    return root
  }

  it.each([
    ['\\href{javascript:alert(1)}{x}', 'javascript:'],
    ['\\url{https://exemple.fr}', 'exemple.fr'],
    ['\\includegraphics{https://exemple.fr/a.png}', 'exemple.fr'],
    ['\\htmlClass{evil}{x}', 'evil'],
    ['\\htmlStyle{position:fixed}{x}', 'position:fixed'],
    ['\\htmlId{evil}{x}', 'evil'],
    ['\\htmlData{foo=bar}{x}', 'foo'],
  ])('refuses %s', (latex, forbidden) => {
    const root = rendered(latex)
    expect(root.querySelector('a, img, [id], [data-foo], .evil')).toBeNull()
    expect(root.innerHTML).not.toContain(forbidden)
  })

  describe('\\tone (ADR 0037)', () => {
    it('writes its argument in the class of the tone, never in a colour', () => {
      const root = rendered('\\tone{1}{a}^2 + \\tone{2}{b}^2 = \\tone{3}{c}^2')
      expect(root.querySelector('.text-tone-1')?.textContent).toBe('a')
      expect(root.querySelector('.text-tone-2')?.textContent).toBe('b')
      expect(root.querySelector('.text-tone-3')?.textContent).toBe('c')
      expect(root.innerHTML).not.toMatch(/color:/)
    })

    it('refuses a tone outside 1…4', () => {
      const root = rendered('\\tone{5}{a}')
      expect(root.querySelector('.text-tone-5')).toBeNull()
      expect(root.innerHTML).toContain('var(--color-danger)')
    })

    it.each([
      ['\\htmlClass{text-tone-1 evil}{x}', '.evil'],
      ['\\tone{1 evil}{x}', '.evil'],
      ['\\tone{1" onclick="alert(1)}{x}', '[onclick]'],
      ['\\htmlClass{text-ink}{x}', '.text-ink'],
    ])('trusts no other class: %s', (latex, selector) => {
      expect(rendered(latex).querySelector(selector)).toBeNull()
    })

    it('cannot be redefined for the next formula', () => {
      renderKatex('\\gdef\\tone#1#2{\\htmlStyle{color:red}{#2}}\\tone{1}{a}', false)
      const root = rendered('\\tone{1}{a}')
      expect(root.querySelector('.text-tone-1')?.textContent).toBe('a')
      expect(root.innerHTML).not.toContain('color:red')
    })
  })

  it('does not let markup through a formula', () => {
    const root = rendered('<script>alert(1)</script><img src=x onerror=alert(1)>')
    expect(root.querySelector('script, img')).toBeNull()
  })

  it('caps the sizes an author writes', () => {
    const { innerHTML } = rendered('\\rule{500em}{500em}')
    expect(innerHTML).not.toContain('500em')
    expect(innerHTML).toContain('20em')
  })

  it('shows a refused command in the colour of the theme', () => {
    const { innerHTML } = rendered('\\href{https://exemple.fr}{x}')
    expect(innerHTML).toContain('var(--color-danger)')
    expect(innerHTML).not.toContain('#cc0000')
  })

  it('stops a macro that expands forever without throwing', () => {
    expect(() => renderKatex('\\def\\a{\\a\\a}\\a', true)).not.toThrow()
  })

  it('survives a formula nested as deep as the length limit allows', () => {
    const half = Math.floor(LATEX_MAX_LENGTH / 2)
    expect(() => renderKatex('{'.repeat(half) + '}'.repeat(half), true)).not.toThrow()
  })

  it('shows a formula beyond the length limit as escaped text', () => {
    const html = renderKatex(`<b>${'x'.repeat(LATEX_MAX_LENGTH)}`, true)
    expect(html.startsWith('&lt;b&gt;x')).toBe(true)
    expect(html).not.toContain('katex')
  })

  it('writes nothing to the logs for a formula outside the strict subset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderKatex('\\text{é}\\\\[1em]', false)
    renderKatex('\\begin{aligned}a\\end{aligned} é', false)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
