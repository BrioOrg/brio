import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BlocsCommunaute } from '../blocs-communaute'

describe('BlocsCommunaute', () => {
  it('renders the palette', () => {
    const { container } = render(
      <BlocsCommunaute
        blocs={[
          { id: 'a', type: 'prose', text: '**gras** *italique* ==surligné== $x^2$' },
          { id: 'b', type: 'formula', latex: 'a^2 + b^2' },
          { id: 'c', type: 'list', items: ['un ==point==', 'deux'] },
          { id: 'd', type: 'code', language: 'python', code: 'print(1 ** 2)' },
          { id: 'e', type: 'code', language: 'scratch', code: 'mettre a à 7\ndire (a)' },
        ]}
      />
    )
    expect(screen.getByText('gras').tagName).toBe('STRONG')
    expect(screen.getByText('italique').tagName).toBe('EM')
    expect(screen.getByText('surligné').tagName).toBe('MARK')
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1)
    // Not by role: jsdom's getComputedStyle throws on the MathML KaTeX emits.
    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(screen.getByText('point').tagName).toBe('MARK')
    expect(screen.getByText('print(1 ** 2)').tagName).toBe('CODE')
    expect(container.querySelector('figure[aria-label="Programme Scratch"]')).not.toBeNull()
  })

  it('drops every block outside the palette', () => {
    const { container } = render(
      <BlocsCommunaute
        blocs={[
          { id: 'a', type: 'heading', level: 1, text: 'Titre' },
          { id: 'b', type: 'callout', variant: 'note', text: 'Encadré' },
          { id: 'c', type: 'image', asset: 'a.png', alt: 'Image' },
          { id: 'd', type: 'table', rows: [['Cellule']] },
          { id: 'e', type: 'reference', scope: 'external', title: 'Lien', url: 'https://a.fr' },
          { id: 'f', type: 'exercise', exerciseType: 'paper', prompt: 'Q', solution: 'R' },
          { id: 'g', type: 'blocfutur', text: 'Inconnu' },
        ]}
      />
    )
    expect(container).toHaveTextContent('')
  })

  it('drops a malformed block without breaking the others', () => {
    render(
      <BlocsCommunaute
        blocs={[
          null,
          'texte',
          { type: 'prose' },
          { type: 'prose', text: 42 },
          { type: 'formula', latex: { a: 1 } },
          { type: 'list', items: 'pas un tableau' },
          { type: 'prose', text: 'reste affiché' },
        ]}
      />
    )
    expect(screen.getByText('reste affiché')).toBeInTheDocument()
  })

  it("never puts a block's id in the page", () => {
    const { container } = render(
      <BlocsCommunaute
        blocs={[
          { id: 'contenu-principal', type: 'prose', text: 'a' },
          { id: 'f', type: 'formula', latex: 'x' },
          { id: 'l', type: 'list', items: ['b'] },
          { id: 'c', type: 'code', code: 'c' },
          { id: 's', type: 'code', language: 'scratch', code: 'mettre a à 7\ndire (a)' },
        ]}
      />
    )
    expect(container.querySelectorAll('[id]')).toHaveLength(0)
  })

  it('keeps a hostile formula from breaking the page or injecting anything', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      <BlocsCommunaute
        blocs={[
          { type: 'formula', latex: '\\href{javascript:alert(1)}{clic}' },
          { type: 'formula', latex: '\\includegraphics{https://exemple.fr/a.png}' },
          { type: 'formula', latex: '\\htmlStyle{position:fixed}{x}' },
          { type: 'formula', latex: '\\def\\a{\\a\\a}\\a' },
          { type: 'formula', latex: '\\rule{9999em}{9999em}' },
          { type: 'formula', latex: `<img src=x onerror=alert(1)>${'{'.repeat(5000)}` },
          { type: 'prose', text: '$\\href{javascript:alert(1)}{clic}$ puis ==<b>texte</b>==' },
          { type: 'prose', text: 'reste affiché' },
        ]}
      />
    )
    expect(container.querySelector('a, img, script, b')).toBeNull()
    // KaTeX keeps the source in an <annotation>, as escaped text: only real elements count.
    container.querySelectorAll('annotation').forEach((annotation) => annotation.remove())
    expect(container.innerHTML).not.toContain('position:fixed')
    expect(container.innerHTML).not.toContain('9999em')
    expect(screen.getByText('reste affiché')).toBeInTheDocument()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
