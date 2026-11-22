// Meaningful colour in maths content (ADR 0037): the same object wears the same tone in a figure
// and in its formula. A formula asks for one with the author macro `\tone{n}{…}`, a figure element
// with `tone: n`. The rules live here, read by scripts/check-content.mjs (English) and the teacher
// editor (French), like chart-rules.ts.
//
// No imports: check-content loads this file with Node's type stripping, which does not resolve
// extensionless relative imports.

export const TONES = [1, 2, 3, 4] as const
export type Tone = (typeof TONES)[number]

/** More tones than this in one block stops being a correspondence and becomes decoration. */
export const MAX_TONES_PER_BLOCK = 3

export function isTone(value: unknown): value is Tone {
  return TONES.some((tone) => tone === value)
}

// `\tone` not followed by a letter (so `\tones` is another command), then its first argument:
// a braced group, or a single character as TeX allows (`\tone1{a}`). Spaces may come between.
const TONE_ARGUMENT = /\\tone(?![A-Za-z])\s*(?:\{([^{}]*)\}|([^\s{}\\]))/g

/** The first argument of every `\tone{…}{…}` in a string, as written: `"1"`, `"5"`, `"a"`. */
export function toneArguments(text: string): string[] {
  return [...text.matchAll(TONE_ARGUMENT)].map((match) => (match[1] ?? match[2]).trim())
}

export type ToneIssue =
  | { code: 'UNKNOWN_TONE'; path: string; value: string }
  | { code: 'TOO_MANY_TONES'; path: ''; tones: Tone[]; max: number }

export type ToneIssueCode = ToneIssue['code']

/**
 * Every tone a block uses, and every rule it breaks. A tone may appear in a figure and nowhere in
 * a formula (the object is only named in the figure), and the other way round: only the number of
 * distinct tones in one block is limited. The block is walked whole, so a tone written in an
 * exercise prompt, a step or a callout counts too. Paths are relative to the block.
 */
export function checkTones(block: unknown): { tones: Tone[]; issues: ToneIssue[] } {
  const used = new Set<Tone>()
  const issues: ToneIssue[] = []

  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      for (const value of toneArguments(node)) {
        const n = Number(value)
        if (/^[1-9]\d*$/.test(value) && isTone(n)) used.add(n)
        else issues.push({ code: 'UNKNOWN_TONE', path, value })
      }
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`))
    } else if (typeof node === 'object' && node !== null) {
      for (const [key, value] of Object.entries(node)) {
        const child = path ? `${path}.${key}` : key
        // A figure element's `tone` (the schema already limits it to 1…4).
        if (key === 'tone' && typeof value === 'number') {
          if (isTone(value)) used.add(value)
          else issues.push({ code: 'UNKNOWN_TONE', path: child, value: String(value) })
        } else {
          walk(value, child)
        }
      }
    }
  }
  walk(block, '')

  const tones = TONES.filter((tone) => used.has(tone))
  if (tones.length > MAX_TONES_PER_BLOCK) {
    issues.push({ code: 'TOO_MANY_TONES', path: '', tones, max: MAX_TONES_PER_BLOCK })
  }
  return { tones, issues }
}
