import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ConnexionPage from '../page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('ConnexionPage', () => {
  it('confirme la création du compte après une inscription enseignant', async () => {
    render(await ConnexionPage({ searchParams: Promise.resolve({ from: '/prof', inscrit: '1' }) }))
    expect(screen.getByRole('status')).toHaveTextContent(/votre compte est créé/i)
  })

  it('n’affiche aucune confirmation lors d’une connexion ordinaire', async () => {
    render(await ConnexionPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
