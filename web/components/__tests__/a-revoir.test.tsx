import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { hrefLecon } from '@/lib/revoir'

import { ARevoir } from '../a-revoir'

// #371 (PL-2): the « À revoir » card leads straight to the lesson, never back to Explorer.

const LECON = {
  niveauCode: '5e',
  matiereCode: 'mathematiques',
  chapitreId: 'division-decimale-problemes',
  sectionId: 'diviser-par-un-decimal',
  sectionTitre: 'Diviser par un nombre décimal',
}
const INTITULE = 'Diviser un nombre par un décimal'

describe('ARevoir', () => {
  // critère 1
  it('should link the competence to its lesson section', () => {
    render(<ARevoir competence={{ intitule: INTITULE, lecon: LECON }} />)

    expect(screen.getByRole('heading', { level: 2, name: 'À revoir' })).toBeVisible()
    const lien = screen.getByRole('link', { name: new RegExp(INTITULE) })
    expect(lien).toHaveAttribute('href', hrefLecon(LECON))
    expect(lien).toHaveAttribute(
      'href',
      '/5e/mathematiques/division-decimale-problemes?diapo=diviser-par-un-decimal'
    )
  })

  // critère 2
  it('should say which lesson to revisit, naming the section', () => {
    render(<ARevoir competence={{ intitule: INTITULE, lecon: LECON }} />)
    expect(screen.getByRole('link', { name: new RegExp(INTITULE) })).toHaveTextContent(
      'Revois : Diviser par un nombre décimal'
    )
  })

  it('should fall back to « Revois cette leçon » when the section has no title', () => {
    render(<ARevoir competence={{ intitule: INTITULE, lecon: { ...LECON, sectionTitre: '' } }} />)
    const lien = screen.getByRole('link', { name: new RegExp(INTITULE) })
    expect(lien).toHaveTextContent('Revois cette leçon')
    expect(lien).not.toHaveTextContent('Revois :')
  })

  // critère 3
  it('should no longer send the student to Explorer', () => {
    render(<ARevoir competence={{ intitule: INTITULE, lecon: LECON }} />)
    expect(screen.queryByText(/Explorer/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Explorer/ })).not.toBeInTheDocument()
    for (const lien of screen.getAllByRole('link')) {
      expect(lien).not.toHaveAttribute('href', '/explorer')
    }
  })

  it('should not show the competence code', () => {
    render(<ARevoir competence={{ intitule: INTITULE, lecon: LECON }} />)
    expect(screen.queryByText(/c4\./)).not.toBeInTheDocument()
  })
})
