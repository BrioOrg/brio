import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/tutor-panel', () => ({ TuteurPanel: () => <p>tuteur</p> }))
vi.mock('@/components/entraide/entraide-panel', () => ({
  EntraidePanel: ({ porteeRef }: { porteeRef: string }) => <p>entraide {porteeRef}</p>,
}))

import { RailContent } from '../chapter-rail'

describe('RailContent', () => {
  it('pairs the tutor with the class entraide on a catalogue chapter', () => {
    render(
      <RailContent
        sections={[]}
        target={{ kind: 'chapitre', niveau: '6e', matiere: 'mathematiques', slug: 'fractions' }}
      />
    )
    expect(screen.getByRole('tab', { name: 'Tuteur' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Entraide' })).toBeInTheDocument()
    expect(screen.getByText('entraide fractions', { exact: true })).toBeInTheDocument()
  })

  it('keeps the tutor alone on a teacher course', () => {
    render(<RailContent sections={[]} target={{ kind: 'cours', coursId: 'c1' }} />)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByText('tuteur')).toBeInTheDocument()
  })
})
