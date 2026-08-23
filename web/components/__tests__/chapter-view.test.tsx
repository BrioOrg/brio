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
