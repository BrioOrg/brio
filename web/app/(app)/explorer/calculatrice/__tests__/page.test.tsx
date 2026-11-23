import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { encoderEtat } from '@/lib/calculatrice-etat'

vi.mock('next/navigation', () => ({
  usePathname: () => '/explorer/calculatrice',
}))

async function renderPage(e?: string) {
  const { default: Page } = await import('../page')
  render(await Page({ searchParams: Promise.resolve(e === undefined ? {} : { e }) }))
}

describe('CalculatricePage', () => {
  it('a son titre, son fil d’Ariane et une ligne vide sans adresse', async () => {
    await renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Calculatrice graphique' })
    ).toBeInTheDocument()
    const fil = screen.getByRole('navigation', { name: "Fil d'ariane" })
    expect(fil).toHaveTextContent('Explorer')
    expect(fil).toHaveTextContent('Calculatrice graphique')
    expect(screen.getAllByRole('textbox', { name: /^Expression/ })).toHaveLength(1)
  })

  it('rend les lignes de l’adresse dès le serveur', async () => {
    await renderPage(encoderEtat({ v: 1, lignes: [{ texte: 'y = x²' }, { texte: '2/3 + 1/6' }] }))
    expect(screen.getByRole('textbox', { name: 'Expression 1' })).toHaveValue('y = x²')
    expect(screen.getByRole('textbox', { name: 'Expression 2' })).toHaveValue('2/3 + 1/6')
    expect(screen.getByText('Résultat : 5 sur 6')).toBeInTheDocument()
  })

  it('ouvre une calculatrice vide, sans message, pour une adresse illisible', async () => {
    await renderPage('%%%')
    expect(screen.getAllByRole('textbox', { name: /^Expression/ })).toHaveLength(1)
    expect(screen.getByRole('textbox', { name: 'Expression 1' })).toHaveValue('')
  })
})
