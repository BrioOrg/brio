import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Infobulle, InfobulleProvider } from '../infobulle'

function renderBouton() {
  render(
    <InfobulleProvider>
      <Infobulle label="Monter">
        <button type="button" aria-label="Monter">
          ↑
        </button>
      </Infobulle>
    </InfobulleProvider>
  )
}

describe('Infobulle', () => {
  it('is hidden until the control is focused', () => {
    renderBouton()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('names the operation on keyboard focus', async () => {
    renderBouton()
    await userEvent.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Monter')
  })

  it('closes on Escape', async () => {
    renderBouton()
    await userEvent.tab()
    await screen.findByRole('tooltip')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  })

  it('keeps the control’s own accessible name', async () => {
    renderBouton()
    await userEvent.tab()
    await screen.findByRole('tooltip')
    expect(screen.getByRole('button')).toHaveAccessibleName('Monter')
  })
})
