import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/progression', () => ({ getProgression: vi.fn(), getSerie: vi.fn() }))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))

import { getProgression, getSerie } from '@/lib/progression'
import { getMoi } from '@/lib/session'
import { ProgressionProvider, useProgression } from '../progression-context'

const mock = vi.mocked(getProgression)
const moi = vi.mocked(getMoi)
const serie = vi.mocked(getSerie)

const compte = (role: string) => ({ id: '1', role, statut: 'actif', nom: null, email: null })

// Small harness exposing the context so tests drive refresh() and read state.
function Harness() {
  const { info, gain, serie: jours, serieChange, refresh } = useProgression()
  return (
    <div>
      <span data-testid="xp">{info ? info.xpTotal : 'none'}</span>
      <span data-testid="lvl">{info ? info.niveau : 'none'}</span>
      <span data-testid="gain">{gain ? gain.amount : 'none'}</span>
      <span data-testid="serie">{jours ? jours.joursConsecutifs : 'none'}</span>
      <span data-testid="serie-change">
        {serieChange ? `${serieChange.avant}->${serieChange.apres}` : 'none'}
      </span>
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
  moi.mockReset()
  moi.mockResolvedValue(compte('eleve'))
  serie.mockReset()
  serie.mockResolvedValue({ joursConsecutifs: 3 } as never)
})

describe('ProgressionProvider', () => {
  it.each(['enseignant', 'admin_brio'])('never reads XP for a %s account', async (role) => {
    moi.mockResolvedValue(compte(role))
    mock.mockResolvedValue({ xpTotal: 320, niveau: 1 })
    renderProvider()
    await waitFor(() => expect(moi).toHaveBeenCalled())

    fireEvent.click(screen.getByText('refresh'))
    await waitFor(() => expect(screen.getByTestId('delta').textContent).toBe('0'))
    expect(mock).not.toHaveBeenCalled()
    expect(screen.getByTestId('xp').textContent).toBe('none')
    expect(screen.getByTestId('gain').textContent).toBe('none')
  })

  it('never reads XP for a logged-out visitor', async () => {
    moi.mockResolvedValue(null)
    renderProvider()
    await waitFor(() => expect(moi).toHaveBeenCalled())
    expect(mock).not.toHaveBeenCalled()
    expect(screen.getByTestId('xp').textContent).toBe('none')
  })

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

  it('refresh() re-reads the streak and reports a real change (#248)', async () => {
    mock.mockResolvedValueOnce({ xpTotal: 100, niveau: 1 })
    serie.mockResolvedValueOnce({ joursConsecutifs: 0 } as never) // mount: no streak yet
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('serie').textContent).toBe('0'))

    mock.mockResolvedValueOnce({ xpTotal: 110, niveau: 1 })
    serie.mockResolvedValueOnce({ joursConsecutifs: 1 } as never) // first activity of the day
    fireEvent.click(screen.getByText('refresh'))

    await waitFor(() => expect(screen.getByTestId('serie-change').textContent).toBe('0->1'))
    expect(screen.getByTestId('serie').textContent).toBe('1')
  })

  it('reports no streak change when the re-read finds the same value', async () => {
    mock.mockResolvedValueOnce({ xpTotal: 100, niveau: 1 })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('serie').textContent).toBe('3'))

    mock.mockResolvedValueOnce({ xpTotal: 110, niveau: 1 })
    fireEvent.click(screen.getByText('refresh'))

    await waitFor(() => expect(screen.getByTestId('delta').textContent).toBe('10'))
    expect(serie).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('serie-change').textContent).toBe('none')
  })

  it('keeps the last known streak when its re-read fails', async () => {
    mock.mockResolvedValueOnce({ xpTotal: 100, niveau: 1 })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('serie').textContent).toBe('3'))

    mock.mockResolvedValueOnce({ xpTotal: 110, niveau: 1 })
    serie.mockRejectedValueOnce(new Error('réseau'))
    fireEvent.click(screen.getByText('refresh'))

    await waitFor(() => expect(screen.getByTestId('delta').textContent).toBe('10'))
    expect(screen.getByTestId('serie').textContent).toBe('3')
    expect(screen.getByTestId('serie-change').textContent).toBe('none')
  })
})
