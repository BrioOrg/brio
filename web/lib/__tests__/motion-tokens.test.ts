import { readFileSync } from 'fs'
import { resolve } from 'path'
import { distance, duration, ease, motionMs, motionS, particles } from '../motion-tokens'

const css = readFileSync(resolve(__dirname, '../../app/tokens.css'), 'utf8')

/** Every `--<prefix>-name: value;` declaration of tokens.css, first occurrence wins. */
function declarations(prefix: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, value] of css.matchAll(
    new RegExp(`--${prefix}-([a-z0-9-]+):\\s*([^;]+);`, 'g')
  )) {
    if (!found.has(name)) found.set(name, value.trim())
  }
  return found
}

const REM = 16

describe('motion tokens mirror', () => {
  it('should mirror every --duration-* token, and only those', () => {
    const fromCss = declarations('duration')

    expect(Object.keys(duration).sort()).toEqual([...fromCss.keys()].sort())
    for (const [name, ms] of Object.entries(duration)) {
      expect(fromCss.get(name), `--duration-${name}`).toBe(`${ms}ms`)
    }
  })

  it('should mirror every --ease-* token, and only those', () => {
    const fromCss = declarations('ease')

    expect(Object.keys(ease).sort()).toEqual([...fromCss.keys()].sort())
    for (const [name, { css: value, bezier }] of Object.entries(ease)) {
      expect(fromCss.get(name), `--ease-${name}`).toBe(value)
      expect(value).toBe(`cubic-bezier(${bezier.join(', ')})`)
    }
  })

  it('should mirror every --motion-* distance, and only those', () => {
    const fromCss = declarations('motion')

    expect(Object.keys(distance).sort()).toEqual([...fromCss.keys()].sort())
    for (const [name, px] of Object.entries(distance)) {
      expect(fromCss.get(name), `--motion-${name}`).toBe(`${px / REM}rem`)
    }
  })

  it('should keep the interactive mode free of overshooting curves', () => {
    const interactive = [ease.in, ease.standard, ease['out-quint'], ease.out]

    for (const { bezier } of interactive) {
      expect(bezier[1]).toBeGreaterThanOrEqual(0)
      expect(bezier[1]).toBeLessThanOrEqual(1)
      expect(bezier[3]).toBeGreaterThanOrEqual(0)
      expect(bezier[3]).toBeLessThanOrEqual(1)
    }
  })

  it('should keep the controls of a new slide visible within 300 ms', () => {
    // MOTION.md budget rule 3: max(slide-in, stagger × index of the answer beat + beat).
    // On an exercise the answers are the second beat (index 1): 290 ms.
    expect(duration['slide-in']).toBeLessThanOrEqual(300)
    expect(duration.stagger + duration.beat).toBeLessThanOrEqual(300)
  })

  it('should expose the particle counts tuned in the prototype', () => {
    expect(particles).toEqual({ count: 21, finaleCountFactor: 2, finaleSpreadFactor: 1.6 })
  })
})

describe('motionMs', () => {
  it('given motion allowed, when asked for a duration, then returns the token', () => {
    expect(motionMs('slide-in', false)).toBe(280)
    expect(motionMs('slide-in', null)).toBe(280)
  })

  it('given reduced motion, when asked for any duration, then returns 0', () => {
    for (const name of Object.keys(duration) as (keyof typeof duration)[]) {
      expect(motionMs(name, true)).toBe(0)
    }
  })
})

describe('motionS', () => {
  it('should convert to seconds for motion, and to 0 under reduced motion', () => {
    expect(motionS('particles', false)).toBe(1.03)
    expect(motionS('particles', true)).toBe(0)
  })
})
