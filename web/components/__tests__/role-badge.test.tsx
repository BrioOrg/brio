import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoleBadge } from '../role-badge'

describe('RoleBadge', () => {
  it('affiche « Élève » et annonce « Compte élève »', () => {
    render(<RoleBadge role="eleve" />)

    expect(screen.getByText('Compte élève')).toHaveClass('sr-only')
    expect(screen.getByText('Élève')).toHaveAttribute('aria-hidden', 'true')
  })

  it('affiche « Enseignant » et annonce « Compte enseignant »', () => {
    render(<RoleBadge role="enseignant" />)

    expect(screen.getByText('Compte enseignant')).toHaveClass('sr-only')
    expect(screen.getByText('Enseignant')).toHaveAttribute('aria-hidden', 'true')
  })

  it("affiche « Admin » et annonce « Compte administrateur d'établissement »", () => {
    render(<RoleBadge role="admin_etab" />)

    expect(screen.getByText("Compte administrateur d'établissement")).toHaveClass('sr-only')
    expect(screen.getByText('Admin')).toHaveAttribute('aria-hidden', 'true')
  })

  it('affiche « Admin Brio » et annonce « Compte administrateur Brio »', () => {
    render(<RoleBadge role="admin_brio" />)

    expect(screen.getByText('Compte administrateur Brio')).toHaveClass('sr-only')
    expect(screen.getByText('Admin Brio')).toHaveAttribute('aria-hidden', 'true')
  })

  it.each(['inconnu', 'constructor', ''])("n'invente aucun rôle pour %j", (role) => {
    const { container } = render(<RoleBadge role={role} />)
    expect(container).toBeEmptyDOMElement()
  })
})
