import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

describe('HomePage', () => {
  it('redirige vers Explorer', async () => {
    const { default: Page } = await import('../page')
    expect(() => Page()).toThrow('NEXT_REDIRECT /explorer')
  })
})
