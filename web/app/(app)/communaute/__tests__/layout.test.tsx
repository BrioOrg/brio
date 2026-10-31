import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

vi.mock('next/navigation', () => ({ notFound: () => notFound() }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: (): string => 'JSESSIONID=abc' })),
}))
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }))
vi.mock('@/lib/espace-eleve', () => ({ lireMoi: vi.fn() }))

async function rendre(active: boolean, role: string | null = 'eleve') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ active }), { status: 200 }))
  )
  const { lireMoi } = await import('@/lib/espace-eleve')
  vi.mocked(lireMoi).mockResolvedValue((role ? { role } : null) as never)
  const { default: Layout } = await import('../layout')
  render(await Layout({ children: <p>contenu</p> }))
}

describe('CommunauteLayout', () => {
  beforeEach(() => {
    vi.resetModules()
    notFound.mockClear()
  })

  it('makes every page not found when the setting is off', async () => {
    await expect(rendre(false)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('shows the page to a student when the setting is on', async () => {
    await rendre(true)
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })

  it('tells a teacher the space is for students', async () => {
    await rendre(true, 'enseignant')
    expect(screen.queryByText('contenu')).not.toBeInTheDocument()
    expect(screen.getByText('La Communauté est réservée aux élèves')).toBeInTheDocument()
  })

  it('leaves a failed account read to the page', async () => {
    await rendre(true, null)
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })
})
