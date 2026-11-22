import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { remplacerAdresse } from '../adresse'

const ETAT_NEXT = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['', {}] }

const natif = window.history.replaceState.bind(window.history)

beforeEach(() => {
  natif(ETAT_NEXT, '', '/3e/mathematiques/pythagore')
})

afterEach(() => {
  vi.restoreAllMocks()
  natif(null, '', '/')
})

describe('remplacerAdresse (ADR 0046 §2)', () => {
  it('keeps the state Next wrote when it runs on the native method', () => {
    const before = window.history.length
    remplacerAdresse('/3e/mathematiques/pythagore?diapo=ex1')

    expect(window.location.search).toBe('?diapo=ex1')
    expect(window.history.state).toEqual(ETAT_NEXT)
    expect(window.history.length).toBe(before)
  })

  it('calls the method Next patched once, with null, and lets it copy its state', () => {
    // What Next's patch does: copy `__NA` and the tree into the new state.
    const patche = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation((data: unknown, unused: string, url?: string | URL | null) => {
        const copie = { ...(data as object), ...(window.history.state as object) }
        natif(copie, unused, url)
      })

    remplacerAdresse('/3e/mathematiques/pythagore?diapo=ex2')

    expect(patche).toHaveBeenCalledTimes(1)
    expect(patche).toHaveBeenCalledWith(null, '', '/3e/mathematiques/pythagore?diapo=ex2')
    expect(window.location.search).toBe('?diapo=ex2')
    expect(window.history.state).toEqual(ETAT_NEXT)
  })

  it('leaves an entry without state as it is outside Next', () => {
    natif(null, '', '/editeur')
    remplacerAdresse('/editeur?diapo=ex1')

    expect(window.location.search).toBe('?diapo=ex1')
    expect(window.history.state).toBeNull()
  })

  it('never throws when the browser refuses the write', () => {
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new DOMException('Too many calls', 'SecurityError')
    })

    expect(() => remplacerAdresse('/3e/mathematiques/pythagore?diapo=ex1')).not.toThrow()
    expect(window.location.search).toBe('')
  })
})
