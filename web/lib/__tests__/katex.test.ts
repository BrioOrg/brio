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
