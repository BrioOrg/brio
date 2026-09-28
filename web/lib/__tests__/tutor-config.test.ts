import { describe, it, expect, vi, afterEach } from 'vitest'
import { DEFAULT_TUTOR_REQUEST_CAP, tutorRequestCap } from '@/lib/tutor-config'

describe('tutorRequestCap', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads TUTEUR_REQUEST_CAP at call time', () => {
    vi.stubEnv('TUTEUR_REQUEST_CAP', '5')
    expect(tutorRequestCap()).toBe(5)
  })

  it('falls back to the default when unset or not a number', () => {
    vi.stubEnv('TUTEUR_REQUEST_CAP', undefined)
    expect(tutorRequestCap()).toBe(DEFAULT_TUTOR_REQUEST_CAP)
    vi.stubEnv('TUTEUR_REQUEST_CAP', 'beaucoup')
    expect(tutorRequestCap()).toBe(DEFAULT_TUTOR_REQUEST_CAP)
  })
})
