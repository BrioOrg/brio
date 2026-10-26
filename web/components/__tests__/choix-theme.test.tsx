import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { ChoixTheme } from '../parametres/choix-theme'
import { applyTheme } from '@/lib/theme'

describe('ChoixTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('offers the three themes in a named group, Système checked without a stored choice', () => {
    render(<ChoixTheme />)
    expect(screen.getByRole('group', { name: 'Thème' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Clair/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Sombre/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Système/ })).toBeChecked()
  })

  it('reflects the stored choice', () => {
    localStorage.setItem('brio-theme', 'dark')
    render(<ChoixTheme />)
    expect(screen.getByRole('radio', { name: /Sombre/ })).toBeChecked()
  })

  it('applies and stores a choice at once', async () => {
    const user = userEvent.setup()
    render(<ChoixTheme />)

    await user.click(screen.getByRole('radio', { name: /Clair/ }))
    expect(screen.getByRole('radio', { name: /Clair/ })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('brio-theme')).toBe('light')

    await user.click(screen.getByRole('radio', { name: /Système/ }))
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('brio-theme')).toBeNull()
  })

  it('follows a change made by another control on the page', () => {
    render(<ChoixTheme />)
    act(() => applyTheme('dark'))
    expect(screen.getByRole('radio', { name: /Sombre/ })).toBeChecked()
  })
})
