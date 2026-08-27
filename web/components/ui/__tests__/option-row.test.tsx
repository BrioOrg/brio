import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptionRow } from '../option-row'

describe('OptionRow', () => {
  it('idle: renders label and marker, is clickable', async () => {
    const onClick = vi.fn()
    render(<OptionRow label="Réponse A" marker="A" state="idle" onClick={onClick} />)
    const btn = screen.getByRole('button')
    expect(btn).not.toBeDisabled()
    await userEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('selected: aria-pressed is true', () => {
    render(<OptionRow label="Réponse B" marker="B" state="selected" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('correct: not interactive, no aria-pressed', () => {
    const onClick = vi.fn()
    render(<OptionRow label="Réponse C" marker="C" state="correct" onClick={onClick} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).not.toHaveAttribute('aria-pressed')
  })

  it('wrong: not interactive', async () => {
    const onClick = vi.fn()
    render(<OptionRow label="Réponse D" marker="D" state="wrong" onClick={onClick} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('muted: not interactive, reduced opacity class applied', () => {
    render(<OptionRow label="Réponse E" marker="E" state="muted" />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('aria-label encodes state', () => {
    render(<OptionRow label="Réponse A" marker="A" state="correct" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(/correct/)
  })
})
