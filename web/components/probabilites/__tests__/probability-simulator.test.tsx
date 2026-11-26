import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProbabilitySimulator } from '../probability-simulator'

const experiment = () => screen.getByRole('combobox', { name: 'Expérience' })
const outcomeRows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('cell').length > 0)

function count(rows: HTMLElement[], value: number) {
  return rows.filter((row) =>
    within(row).queryByRole('cell', { name: (label) => label.replace(/\s/g, '') === String(value) })
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Simulateur de probabilités', () => {
  // Criterion 3
  it('cumule les lots de 10, 100 et 1 000 essais puis remet les résultats à zéro', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<ProbabilitySimulator />)

    expect(
      within(experiment()).getByRole('option', { name: 'Dé à six faces', selected: true })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lancer 10 essais' }))
    expect(screen.getByRole('status')).toHaveTextContent(/\b10 essais/)
    fireEvent.click(screen.getByRole('button', { name: 'Lancer 100 essais' }))
    expect(screen.getByRole('status')).toHaveTextContent(/\b110 essais/)
    fireEvent.click(screen.getByRole('button', { name: /Lancer 1\s000 essais/ }))

    expect(screen.getByRole('status')).toHaveTextContent(/1\s110 essais/)
    expect(outcomeRows()).toHaveLength(6)
    expect(count(outcomeRows(), 1110)).toHaveLength(1)
    expect(count(outcomeRows(), 0)).toHaveLength(5)

    fireEvent.click(screen.getByRole('button', { name: 'Remettre à zéro' }))
    expect(screen.getByRole('status')).toHaveTextContent(/\b0 essais/)
    fireEvent.click(screen.getByRole('button', { name: 'Lancer 10 essais' }))
    expect(count(outcomeRows(), 10)).toHaveLength(1)
    expect(count(outcomeRows(), 0)).toHaveLength(5)
  })

  // Criteria 2 and 3
  it('compare les fréquences observées d’une pièce aux probabilités théoriques', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<ProbabilitySimulator initialExperiment="coin" />)

    expect(
      within(experiment()).getByRole('option', { name: 'Pièce équilibrée', selected: true })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lancer 10 essais' }))
    random.mockReturnValue(0.999)
    fireEvent.click(screen.getByRole('button', { name: 'Lancer 10 essais' }))

    expect(outcomeRows()).toHaveLength(2)
    expect(count(outcomeRows(), 10)).toHaveLength(2)
    for (const row of outcomeRows()) {
      expect(within(row).getAllByRole('cell', { name: /^50\s?%$/ })).toHaveLength(2)
    }
  })

  // Criteria 2 and 3
  it('repart à zéro en passant à l’urne et affiche ses probabilités inégales', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<ProbabilitySimulator />)
    fireEvent.click(screen.getByRole('button', { name: 'Lancer 100 essais' }))

    fireEvent.change(experiment(), { target: { value: 'urn' } })
    expect(
      within(experiment()).getByRole('option', { name: 'Urne avec remise', selected: true })
    ).toBeInTheDocument()
    random.mockReturnValueOnce(0.599).mockReturnValue(0.6)
    fireEvent.click(screen.getByRole('button', { name: 'Lancer 10 essais' }))

    const red = within(screen.getByRole('table')).getByRole('row', { name: /Rouge/ })
    const blue = within(screen.getByRole('table')).getByRole('row', { name: /Bleue/ })
    expect(within(red).getByRole('cell', { name: /^60\s?%$/ })).toBeInTheDocument()
    expect(within(blue).getByRole('cell', { name: /^40\s?%$/ })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/\b10 essais/)
    expect(within(red).getByRole('cell', { name: '1' })).toBeInTheDocument()
    expect(within(blue).getByRole('cell', { name: '9' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('10 essais')
  })
})
