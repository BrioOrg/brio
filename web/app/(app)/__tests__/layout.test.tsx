import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/components/examen-banner', () => ({ ExamenBanner: () => null }))
vi.mock('@/components/progression-context', () => ({
  ProgressionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

function reponse(status: number, corps?: unknown) {
  return new Response(corps === undefined ? null : JSON.stringify(corps), { status })
}

async function rendre(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock)
  const { default: AppLayout } = await import('../layout')
  render(await AppLayout({ children: <p>contenu</p> }))
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('links Communauté when the server setting is on', async () => {
    await rendre(vi.fn().mockResolvedValue(reponse(200, { active: true })))
    expect(screen.getAllByRole('link', { name: 'Communauté' })[0]).toHaveAttribute(
      'href',
      '/communaute'
    )
    expect(screen.queryByRole('button', { name: /Communauté/ })).not.toBeInTheDocument()
  })

  it('reads the setting at each request, not from a cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { active: true }))
    await rendre(fetchMock)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/reglages\/communaute$/),
      expect.objectContaining({ cache: 'no-store' })
    )
  })

  it.each([
    ['the setting is off', () => Promise.resolve(reponse(200, { active: false }))],
    ['the backend answers an error', () => Promise.resolve(reponse(500))],
    ['the answer is not the expected one', () => Promise.resolve(reponse(200, { actif: true }))],
    ['the backend cannot be reached', () => Promise.reject(new Error('réseau'))],
  ])('leaves no link to it when %s', async (_cas, appel) => {
    await rendre(vi.fn().mockImplementation(appel))
    expect(screen.queryByRole('link', { name: /Communauté/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Communauté/ })).toBeDisabled()
  })
})
