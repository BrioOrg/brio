import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MenuBurger } from '../menu-burger'

function setup() {
  const user = userEvent.setup()
  render(
    <>
      <MenuBurger />
      <p>Ailleurs</p>
    </>
  )
  const bouton = screen.getByRole('button', { name: 'Menu' })
  return { user, bouton }
}

describe('MenuBurger', () => {
  it('starts closed, with aria-expanded false and no menu', () => {
    const { bouton } = setup()
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    expect(bouton).toHaveAttribute('aria-haspopup', 'menu')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens on click, exposes the Paramètres entry and focuses it', async () => {
    const { user, bouton } = setup()
    await user.click(bouton)

    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Menu' })
    expect(bouton).toHaveAttribute('aria-controls', menu.id)
    const parametres = screen.getByRole('menuitem', { name: 'Paramètres' })
    expect(parametres).toHaveAttribute('href', '/parametres')
    expect(parametres).toHaveFocus()
  })

  it('opens from the keyboard', async () => {
    const { user, bouton } = setup()
    bouton.focus()
    await user.keyboard('{Enter}')
    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Paramètres' })).toHaveFocus()
  })

  it('closes on Escape and gives the focus back to the button', async () => {
    const { user, bouton } = setup()
    await user.click(bouton)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    expect(bouton).toHaveFocus()
  })

  it('closes when clicking outside', async () => {
    const { user, bouton } = setup()
    await user.click(bouton)
    await user.click(screen.getByText('Ailleurs'))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes when Tab leaves the menu', async () => {
    const { user, bouton } = setup()
    await user.click(bouton)
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Paramètres' }), { key: 'Tab' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes when the button is pressed again', async () => {
    const { user, bouton } = setup()
    await user.click(bouton)
    await user.click(bouton)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
