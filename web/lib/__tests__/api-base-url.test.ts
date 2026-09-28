import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiBaseUrl } from '@/lib/api-base-url'

describe('apiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('is the same origin in the browser, whatever the server variable says', () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://backend:8080')
    expect(apiBaseUrl()).toBe(window.location.origin)
  })

  it('reads API_INTERNAL_URL on the server at call time', () => {
    vi.stubGlobal('window', undefined)
    vi.stubEnv('API_INTERNAL_URL', 'http://backend:8080')
    expect(apiBaseUrl()).toBe('http://backend:8080')
  })

  it('falls back to the local backend on the server when unset', () => {
    vi.stubGlobal('window', undefined)
    vi.stubEnv('API_INTERNAL_URL', undefined)
    expect(apiBaseUrl()).toBe('http://localhost:8080')
  })
})
