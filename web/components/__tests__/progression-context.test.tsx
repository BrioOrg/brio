import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/progression', () => ({ getProgression: vi.fn() }))

import { getProgression } from '@/lib/progression'
import { ProgressionProvider, useProgression } from '../progression-context'

const mock = vi.mocked(getProgression)

// Small harness exposing the context so tests drive refresh() and read state.
function Harness() {
  const { info, gain, refresh } = useProgression()
  return (
    <div>
      <span data-testid="xp">{info ? info.xpTotal : 'none'}</span>
      <span data-testid="lvl">{info ? info.niveau : 'none'}</span>
      <span data-testid="gain">{gain ? gain.amount : 'none'}</span>
      <span data-testid="delta" />
      <button
        onClick={async () => {
          const d = await refresh()
          screen.getByTestId('delta').textContent = String(d)
        }}
      >
        refresh
      </button>
    </div>
  )
}

function renderProvider() {
  return render(
    <ProgressionProvider>
      <Harness />
    </ProgressionProvider>
  )
}

beforeEach(() => {
  mock.mockReset()
})

describe('ProgressionProvider', () => {
  it('loads the real XP + level on mount', async () => {
    mock.mockResolvedValue({ xpTotal: 320, niveau: 1 })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('xp').textContent).toBe('320'))
    expect(screen.getByTestId('lvl').textContent).toBe('1')
  })

  it('stays hidden (info null) when the read fails', async () => {
    mock.mockRejectedValue(new Error('offline'))
    renderProvider()
    // give the mount effect a tick, then assert it never populated
    await waitFor(() => expect(mock).toHaveBeenCalled())
    expect(screen.getByTestId('xp').textContent).toBe('none')
  })

  it('refresh() surfaces the real gain and updates the total', async () => {
    mock.mockResolvedValueOnce({ xpTotal: 100, niveau: 1 }) // mount
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('xp').textContent).toBe('100'))

    mock.mockResolvedValueOnce({ xpTotal: 110, niveau: 1 }) // after a correct answer
    fireEvent.click(screen.getByText('refresh'))

    await waitFor(() => expect(screen.getByTestId('gain').textContent).toBe('10'))
    expect(screen.getByTestId('xp').textContent).toBe('110')
    expect(screen.getByTestId('delta').textContent).toBe('10')
  })

  it('shows no gain when nothing was awarded (cap reached / already earned)', async () => {
    mock.mockResolvedValue({ xpTotal: 200, niveau: 1 }) // mount + every re-read identical
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('xp').textContent).toBe('200'))

    fireEvent.click(screen.getByText('refresh'))
    await waitFor(() => expect(screen.getByTestId('delta').textContent).toBe('0'), {
      timeout: 2000,
    })
    expect(screen.getByTestId('gain').textContent).toBe('none')
  })

  it('polls past a stale read until the async award lands', async () => {
    mock.mockResolvedValueOnce({ xpTotal: 50, niveau: 0 }) // mount
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('xp').textContent).toBe('50'))

    // First re-read still stale (listener not done yet), second read has the XP.
    mock
      .mockResolvedValueOnce({ xpTotal: 50, niveau: 0 })
      .mockResolvedValueOnce({ xpTotal: 60, niveau: 0 })
    fireEvent.click(screen.getByText('refresh'))

    await waitFor(() => expect(screen.getByTestId('gain').textContent).toBe('10'), {
      timeout: 2000,
    })
    expect(screen.getByTestId('xp').textContent).toBe('60')
  })
})
