import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// The six curve colours of the graphing calculator (#420, ADR 0049 (#417)), read from tokens.css.
//
// The measures (contrast on three grounds, CIEDE2000 in normal vision, protan, deutan and tritan)
// live in ONE place: scripts/check-contrast.mjs, the same tool and model as the ADR 0037 tone
// checks. That script keeps its own copy of the token values, so this test (1) checks the
// structure of tokens.css, (2) checks that the script's copy is the real tokens.css, and
// (3) runs the script, so a colour change that breaks a threshold fails here as well as in CI.

const css = readFileSync(resolve(__dirname, '../tokens.css'), 'utf8')
const script = resolve(__dirname, '../../../scripts/check-contrast.mjs')
const scriptSource = readFileSync(script, 'utf8')

const LIGHT_START = css.indexOf("[data-theme='light'] {")
const MEDIA_START = css.indexOf('@media (prefers-color-scheme: light)')
const MEDIA_END = css.indexOf('@media (prefers-reduced-motion')
const SCRIPT_LIGHT_START = scriptSource.indexOf('const light = {')

type Theme = 'dark' | 'light'

const sections = {
  dark: css.slice(0, LIGHT_START),
  light: css.slice(LIGHT_START, MEDIA_START),
  systemLight: css.slice(MEDIA_START, MEDIA_END),
} as const

const scriptSections = {
  dark: scriptSource.slice(0, SCRIPT_LIGHT_START),
  light: scriptSource.slice(SCRIPT_LIGHT_START),
} as const

/** Every `--color-<name>: #hex;` of a tokens.css section, first occurrence wins. */
function colours(section: keyof typeof sections): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, hex] of sections[section].matchAll(
    /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g
  )) {
    if (!found.has(name)) found.set(name, hex.toLowerCase())
  }
  return found
}

/** The `'name': '#hex'` entries of one theme of check-contrast.mjs. */
function scriptColours(theme: Theme): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, hex] of scriptSections[theme].matchAll(
    /'([a-z0-9-]+)':\s*'(#[0-9a-fA-F]{6})'/g
  )) {
    if (!found.has(name)) found.set(name, hex.toLowerCase())
  }
  return found
}

const CURVES = [1, 2, 3, 4, 5, 6] as const
const THEMES: Theme[] = ['dark', 'light']
const palette = { dark: colours('dark'), light: colours('light') }

function hex(theme: Theme, name: string): string {
  const value = palette[theme].get(name)
  if (value === undefined) throw new Error(`--color-${name} missing in the ${theme} theme`)
  return value
}

describe('curve colour tokens', () => {
  it('should find the section anchors it slices on', () => {
    expect(LIGHT_START).toBeGreaterThan(0)
    expect(MEDIA_START).toBeGreaterThan(LIGHT_START)
    expect(MEDIA_END).toBeGreaterThan(MEDIA_START)
    expect(SCRIPT_LIGHT_START).toBeGreaterThan(0)
  })

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
    'should check in check-contrast.mjs the very values of tokens.css (%s)',
    (theme) => {
      const checked = scriptColours(theme)
      for (const n of CURVES) {
        expect(checked.get(`courbe-${n}`), `courbe-${n}`).toBe(hex(theme, `courbe-${n}`))
      }
      for (const ground of ['surface-page', 'surface-panel', 'surface-raised']) {
        expect(checked.get(ground), ground).toBe(hex(theme, ground))
      }
    }
  )

  it('should pass the contrast and colour-vision gate of check-contrast.mjs', () => {
    // execFileSync throws, with the failing pairs on stderr, on a non-zero exit.
    const output = execFileSync(process.execPath, [script], { encoding: 'utf8' })
    expect(output).toContain('curve-colour checks pass')
  })
})
