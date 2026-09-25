import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@brio/api-client', () => ({ createApiClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ soumettre: vi.fn() }))

import { ChapterView, type ChapitreResponse } from '../chapter-view'

function makeChapter(blocks: object[]): ChapitreResponse {
  return {
    id: 'test',
    title: 'Test',
    sections: [{ id: 's1', title: 'Section', kind: 'lesson', blocks: blocks as never }],
  }
}

describe('ChapterView — richText rendering', () => {
  it('renders **bold** as <strong>, no asterisks visible', () => {
    const { container } = render(
      <ChapterView
        chapitre={makeChapter([
          { id: 'p1', type: 'prose', text: 'Le **triangle rectangle** est défini.' },
        ])}
      />
    )
    expect(container.querySelector('strong')?.textContent).toBe('triangle rectangle')
    expect(container.textContent).not.toContain('**')
  })

  it('renders *italic* as <em>, no asterisks visible', () => {
    const { container } = render(
      <ChapterView
        chapitre={makeChapter([
          { id: 'p2', type: 'prose', text: "L'*hypoténuse* est le côté le plus long." },
        ])}
      />
    )
    expect(container.querySelector('em')?.textContent).toBe('hypoténuse')
    expect(container.textContent).not.toContain('*hypoténuse*')
  })

  it('renders $...$ as KaTeX in a prose block', () => {
    const { container } = render(
      <ChapterView
        chapitre={makeChapter([{ id: 'p3', type: 'prose', text: 'La formule $a^2 + b^2 = c^2$.' }])}
      />
    )
    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.textContent).not.toContain('$')
  })

  it('renders richText in callout.text', () => {
    const { container } = render(
      <ChapterView
        chapitre={makeChapter([
          { id: 'c1', type: 'callout', variant: 'note', text: 'Un **terme** important.' },
        ])}
      />
    )
    expect(container.querySelector('strong')?.textContent).toBe('terme')
  })

  it('renders richText in callout.title', () => {
    const { container } = render(
      <ChapterView
        chapitre={makeChapter([
          {
            id: 'c2',
            type: 'callout',
            variant: 'definition',
            title: '**Définition** clé',
            text: 'Le corps du callout.',
          },
        ])}
      />
    )
    expect(container.querySelector('strong')?.textContent).toBe('Définition')
  })
})

describe('ChapterView — formula blocks', () => {
  it('renders a block formula via KaTeX, not as raw LaTeX source', () => {
    const { container } = render(
      <ChapterView
        chapitre={makeChapter([
          { id: 'f1', type: 'formula', latex: 'a^2 + b^2 = c^2', display: 'block' },
        ])}
      />
    )
    // KaTeX renders both visual HTML and MathML
    expect(container.querySelector('.katex-html')).not.toBeNull()
    expect(container.querySelector('math')).not.toBeNull()
    // The old <pre> renderer must be gone
    expect(container.querySelector('pre')).toBeNull()
  })

  it('renders an inline formula via KaTeX', () => {
    const { container } = render(
      <ChapterView
        chapitre={makeChapter([{ id: 'f2', type: 'formula', latex: 'x = 5', display: 'inline' }])}
      />
    )
    expect(container.querySelector('.katex')).not.toBeNull()
  })

  it('degrades gracefully for malformed LaTeX — katex-error present, page does not crash', () => {
    const { container } = render(
      <ChapterView
        chapitre={makeChapter([
          { id: 'f3', type: 'formula', latex: '\\invalid{', display: 'block' },
        ])}
      />
    )
    expect(container.querySelector('.katex-error')).not.toBeNull()
  })
})

describe('ChapterView — table block', () => {
  it('renders headers, rows and caption with richText in cells', () => {
    const { container, getByText } = render(
      <ChapterView
        chapitre={makeChapter([
          {
            id: 't1',
            type: 'table',
            headers: ['Grandeur', 'Symbole'],
            rows: [['Longueur', '$L$'], ['Masse', 'm']],
            caption: 'Unités **usuelles**',
          },
        ])}
      />
    )
    expect(container.querySelectorAll('thead th')).toHaveLength(2)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    getByText('Longueur')
    // richText: the caption bold and the math cell both render
    expect(container.querySelector('caption strong')?.textContent).toBe('usuelles')
    expect(container.querySelector('.katex')).not.toBeNull()
  })

  it('renders a headerless table (no thead)', () => {
    const { container } = render(
      <ChapterView
        chapitre={makeChapter([{ id: 't2', type: 'table', rows: [['a', 'b']] }])}
      />
    )
    expect(container.querySelector('thead')).toBeNull()
    expect(container.querySelectorAll('tbody td')).toHaveLength(2)
  })
})

describe('ChapterView — reference block', () => {
  it('renders an external reference as a new-tab https link', () => {
    const { getByRole } = render(
      <ChapterView
        chapitre={makeChapter([
          {
            id: 'r1',
            type: 'reference',
            scope: 'external',
            title: 'Sésamath',
            url: 'https://example.org/cours',
            source: 'Sésamath',
            consultedOn: '2026-09-01',
          },
        ])}
      />
    )
    const link = getByRole('link', { name: /Sésamath/ })
    expect(link).toHaveAttribute('href', 'https://example.org/cours')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders an internal reference as a semantic-URL link with anchor', () => {
    const { getByRole } = render(
      <ChapterView
        chapitre={makeChapter([
          {
            id: 'r2',
            type: 'reference',
            scope: 'internal',
            title: 'Voir Pythagore',
            target: { level: '6e', subject: 'mathematiques', slug: 'pythagore', anchor: 'enonce' },
          },
        ])}
      />
    )
    expect(getByRole('link', { name: /Voir Pythagore/ })).toHaveAttribute(
      'href',
      '/6e/mathematiques/pythagore#enonce'
    )
  })

  it('renders no dead link when an internal target is incomplete', () => {
    const { container, getByText } = render(
      <ChapterView
        chapitre={makeChapter([
          { id: 'r3', type: 'reference', scope: 'internal', title: 'Cible à définir', target: {} },
        ])}
      />
    )
    expect(container.querySelector('a')).toBeNull()
    getByText('Cible à définir')
  })
})
