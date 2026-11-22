import { readFileSync } from 'fs'
import { resolve } from 'path'

// The six curve colours of the graphing calculator (#420, ADR 0049), read straight from tokens.css.

const css = readFileSync(resolve(__dirname, '../tokens.css'), 'utf8')

const LIGHT_START = css.indexOf("[data-theme='light'] {")
const MEDIA_START = css.indexOf('@media (prefers-color-scheme: light)')
const MEDIA_END = css.indexOf('@media (prefers-reduced-motion')

const sections = {
  dark: css.slice(0, LIGHT_START),
  light: css.slice(LIGHT_START, MEDIA_START),
  systemLight: css.slice(MEDIA_START, MEDIA_END),
} as const

type Section = keyof typeof sections
type Theme = 'dark' | 'light'

/** Every `--color-<name>: #hex;` of a section, first occurrence wins. */
function colours(section: Section): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, hex] of sections[section].matchAll(
    /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g
  )) {
    if (!found.has(name)) found.set(name, hex.toLowerCase())
  }
  return found
}

const CURVES = [1, 2, 3, 4, 5, 6] as const
const GROUNDS = ['surface-page', 'surface-panel', 'surface-raised'] as const
const THEMES: Theme[] = ['dark', 'light']
const palette = { dark: colours('dark'), light: colours('light') }

function hex(theme: Theme, name: string): string {
  const value = palette[theme].get(name)
  if (value === undefined) throw new Error(`--color-${name} missing in the ${theme} theme`)
  return value
}

// ── WCAG contrast ───────────────────────────────────────────────────────────

type Rgb = [number, number, number]

function rgb(color: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as Rgb
}

function linear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// ── Colour difference: CIEDE2000, optionally after a colour-vision simulation ──

type Matrix = readonly [Rgb, Rgb, Rgb]
const NORMAL: Matrix = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]
// Machado, Oliveira & Fernandes (2009), severity 1.0, applied to linear RGB.
const PROTAN: Matrix = [
  [0.152286, 1.052583, -0.204868],
  [0.114503, 0.786281, 0.099216],
  [-0.003882, -0.048116, 1.051998],
]
const DEUTAN: Matrix = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
]

type Lab = [number, number, number]

function lab(color: string, matrix: Matrix): Lab {
  const v = rgb(color).map(linear)
  const [r, g, b] = matrix.map((row) =>
    Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))
  )
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

function deltaE2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const rad = Math.PI / 180
  const pow7 = (n: number) => n ** 7
  const cBar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const g = 0.5 * (1 - Math.sqrt(pow7(cBar) / (pow7(cBar) + pow7(25))))
  const ap1 = (1 + g) * a1
  const ap2 = (1 + g) * a2
  const cp1 = Math.hypot(ap1, b1)
  const cp2 = Math.hypot(ap2, b2)
  const hue = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0
    const h = Math.atan2(b, a) / rad
    return h < 0 ? h + 360 : h
  }
  const h1 = hue(b1, ap1)
  const h2 = hue(b2, ap2)
  const chromatic = cp1 * cp2 !== 0
  let dh = 0
  if (chromatic) {
    dh = h2 - h1
    if (dh > 180) dh -= 360
    else if (dh < -180) dh += 360
  }
  const dL = l2 - l1
  const dC = cp2 - cp1
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((dh * rad) / 2)
  const lBar = (l1 + l2) / 2
  const cpBar = (cp1 + cp2) / 2
  let hBar = h1 + h2
  if (chromatic) {
    if (Math.abs(h1 - h2) > 180) hBar += h1 + h2 < 360 ? 360 : -360
    hBar /= 2
  }
  const t =
    1 -
    0.17 * Math.cos((hBar - 30) * rad) +
    0.24 * Math.cos(2 * hBar * rad) +
    0.32 * Math.cos((3 * hBar + 6) * rad) -
    0.2 * Math.cos((4 * hBar - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2))
  const rc = 2 * Math.sqrt(pow7(cpBar) / (pow7(cpBar) + pow7(25)))
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2)
  const sc = 1 + 0.045 * cpBar
  const sh = 1 + 0.015 * cpBar * t
  const rt = -Math.sin(2 * dTheta * rad) * rc
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh))
}

function difference(a: string, b: string, matrix: Matrix): number {
  return deltaE2000(lab(a, matrix), lab(b, matrix))
}

function pairs(): [number, number][] {
  return CURVES.flatMap((i) => CURVES.filter((j) => j > i).map((j): [number, number] => [i, j]))
}

describe('curve colour tokens', () => {
  it.each(THEMES)('should define the six curve colours in the %s theme', (theme) => {
    for (const n of CURVES) expect(hex(theme, `courbe-${n}`)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it.each(THEMES)('should reuse tones 1 to 4 for curves 1 to 4 in the %s theme', (theme) => {
    for (const n of [1, 2, 3, 4]) expect(hex(theme, `courbe-${n}`)).toBe(hex(theme, `tone-${n}`))
  })

  it('should follow the system light preference with the same values as the light theme', () => {
    const system = colours('systemLight')
    for (const n of CURVES) {
      expect(system.get(`courbe-${n}`), `courbe-${n}`).toBe(hex('light', `courbe-${n}`))
    }
  })

  it('should take curves 5 and 6 from the primitives', () => {
    const primitive = (name: string) =>
      new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)?.[1]?.toLowerCase()
    expect(hex('dark', 'courbe-5')).toBe(primitive('p-courbe-violet'))
    expect(hex('dark', 'courbe-6')).toBe(primitive('p-courbe-brique'))
    expect(hex('light', 'courbe-5')).toBe(primitive('p-light-courbe-violet'))
    expect(hex('light', 'courbe-6')).toBe(primitive('p-light-courbe-brique'))
  })

  it.each(THEMES)(
    'should keep every curve colour at 4.5 : 1 or more on page, panel and raised (%s)',
    (theme) => {
      for (const n of CURVES) {
        for (const ground of GROUNDS) {
          const ratio = contrast(hex(theme, `courbe-${n}`), hex(theme, ground))
          if (process.env.CURVE_REPORT)
            console.info(`${theme} courbe-${n} on ${ground} ${ratio.toFixed(2)}`)
          expect(ratio, `courbe-${n} on ${ground}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  )

  it.each(THEMES)('should keep every pair at ΔE2000 20 or more in normal vision (%s)', (theme) => {
    for (const [i, j] of pairs()) {
      const delta = difference(hex(theme, `courbe-${i}`), hex(theme, `courbe-${j}`), NORMAL)
      if (process.env.CURVE_REPORT) console.info(`${theme} normal ${i}-${j} ${delta.toFixed(1)}`)
      expect(delta, `courbe-${i} vs courbe-${j}`).toBeGreaterThanOrEqual(20)
    }
  })

  // Informative, documented in tokens.css: colour is never the only cue, but no two curve colours
  // may collapse into one for a protanope or a deuteranope.
  it.each(THEMES)('should keep every pair distinguishable for protan and deutan (%s)', (theme) => {
    const report: string[] = []
    for (const [name, matrix] of [
      ['protan', PROTAN],
      ['deutan', DEUTAN],
    ] as const) {
      for (const [i, j] of pairs()) {
        const delta = difference(hex(theme, `courbe-${i}`), hex(theme, `courbe-${j}`), matrix)
        report.push(`${theme} ${name} ${i}-${j} ${delta.toFixed(1)}`)
        expect(delta, `${name} courbe-${i} vs courbe-${j}`).toBeGreaterThanOrEqual(5)
      }
    }
    if (process.env.CURVE_REPORT) console.info(report.join('\n'))
  })
})
