import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@brio/api-client', () => ({ createApiClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ soumettre: vi.fn() }))

import { ChapterView, type ChapitreResponse } from '../chapter-view'

// ADR 0019 §8.6: a teacher course served by the API must produce EXACTLY the same HTML as
// an equivalent catalogue chapter. Both origins reach the same <ChapterView/> with the same
// client-facing document shape, so identical content must render byte-for-byte identically.
// Origin lives only in the URL a page fetched from — never in the document handed to the view.

const CONTENT_SECTIONS: ChapitreResponse['sections'] = [
  {
    id: 'lecon',
    title: 'Le théorème de Pythagore',
    kind: 'lesson',
    blocks: [
      { id: 'p1', type: 'prose', text: 'Dans un **triangle rectangle**, on a une relation.' },
      { id: 'f1', type: 'formula', latex: 'BC^2 = AB^2 + AC^2', display: 'block' },
      {
        id: 'c1',
        type: 'callout',
        variant: 'definition',
        text: "L'hypoténuse est le plus grand côté.",
      },
      {
        id: 'ex1',
        type: 'exercise',
        exerciceId: '11111111-1111-1111-1111-111111111111',
        exerciseType: 'numeric',
        prompt: 'Calcule BC si AB = 3 et AC = 4.',
        unit: 'cm',
      },
    ] as never,
  },
]

// Same content, same document id/title — the two origins are indistinguishable at render.
const catalogueChapter: ChapitreResponse = {
  id: 'doc',
  title: 'Théorème de Pythagore',
  sections: CONTENT_SECTIONS,
}
const teacherCourse: ChapitreResponse = {
  id: 'doc',
  title: 'Théorème de Pythagore',
  sections: CONTENT_SECTIONS,
}

// React's useId() emits a per-render auto-incrementing id (e.g. "_r_0_" then "_r_1_") into
// the exercise widget's label/input. It differs between two renders in the same test but has
// nothing to do with the content's origin — neutralise it before the byte comparison.
function normalizeReactIds(html: string): string {
  return html.replace(/_r_[0-9a-z]+_/g, '_r_ID_')
}

describe('ChapterView — catalogue/course rendering parity (ADR 0019 §8.6)', () => {
  it('renders identical HTML for an equivalent catalogue chapter and teacher course', () => {
    const fromCatalogue = render(<ChapterView chapitre={catalogueChapter} />)
    const fromCourse = render(<ChapterView chapitre={teacherCourse} />)

    expect(normalizeReactIds(fromCourse.container.innerHTML)).toEqual(
      normalizeReactIds(fromCatalogue.container.innerHTML)
    )
  })
})
