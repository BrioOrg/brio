import katex, { type KatexOptions, type TrustContext } from 'katex'

import { TONE_TEXT } from '@/lib/math-tones'

/**
 * Formulas are not all reviewed: a Communauté message holds whatever a student typed (ADR 0035),
 * so every call goes through these limits, courses included. They are far above what a course
 * uses, and they do not change the output of a formula that stays under them.
 *
 * - `trust` refuses `\href`, `\url`, `\includegraphics` and the `\html*` commands, except
 *   `\htmlClass` with exactly one of the four maths-tone classes: what `\tone` expands to.
 * - `maxSize` caps every size the author writes (`\rule`, `\kern`, `\raisebox`), in em.
 * - `maxExpand` stops macros that expand forever (`\def\a{\a\a}`).
 * - `strict: 'ignore'` keeps a student's formula from writing to the server logs.
 * - `errorColor` shows what KaTeX refuses in the theme's colour instead of its own red.
 */
export const KATEX_LIMITS = {
  output: 'htmlAndMathml',
  trust: isToneClass,
  strict: 'ignore',
  maxSize: 20,
  maxExpand: 200,
  errorColor: 'var(--color-danger)',
} as const satisfies KatexOptions

const TONE_CLASSES: ReadonlySet<string> = new Set(Object.values(TONE_TEXT))

/** The one HTML extension trusted: a class of a maths tone, and nothing else (ADR 0037). */
function isToneClass(context: TrustContext): boolean {
  return context.command === '\\htmlClass' && TONE_CLASSES.has(context.class.trim())
}

/**
 * The author macro of a meaningful colour (ADR 0037): `\tone{1}{a}` writes `a` in the first maths
 * tone. A class, never a colour, so the token gives the colour in each theme. KaTeX writes a
 * `\gdef` into the macros it is given, so every render gets its own copy: a formula can never
 * redefine `\tone` for the next one.
 */
export function katexMacros(): Record<string, string> {
  return { '\\tone': '\\htmlClass{text-tone-#1}{#2}' }
}

/** Beyond this, a formula is shown as text: KaTeX is neither run nor allowed to recurse on it. */
export const LATEX_MAX_LENGTH = 2000

/**
 * The HTML of a formula, safe to inject. `throwOnError: false` only covers parse errors, and a
 * formula nested deeply enough fails with another error: whatever happens, the page still renders
 * and the source is shown as escaped text.
 */
export function renderKatex(latex: string, displayMode: boolean): string {
  try {
    if (latex.length > LATEX_MAX_LENGTH) return asPlainText(latex)
    return katex.renderToString(latex, {
      ...KATEX_LIMITS,
      macros: katexMacros(),
      throwOnError: false,
      displayMode,
    })
  } catch {
    return asPlainText(latex)
  }
}

/**
 * One part of a `calcul` line (ADR 0042), in text style but with display-size fractions, as a
 * textbook sets a calculation. The model wraps the emphasised part in `\tone{1}{…}` (ADR 0037),
 * so the limits and macros are those of every formula.
 *
 * `html` draws the columns (KaTeX already hides them from assistive technology); `mathml` gives
 * each whole line once, for a screen reader.
 */
export function renderCalculKatex(latex: string, output: 'html' | 'mathml'): string {
  if (latex.trim() === '') return ''
  try {
    if (latex.length > LATEX_MAX_LENGTH) return asPlainText(latex)
    return katex.renderToString(`\\displaystyle ${latex}`, {
      ...KATEX_LIMITS,
      output,
      macros: katexMacros(),
      throwOnError: false,
      displayMode: false,
    })
  } catch {
    return asPlainText(latex)
  }
}

/** KaTeX's parse error for `latex`, or null when it parses: what the editor shows under a line. */
export function katexError(latex: string): string | null {
  try {
    katex.renderToString(latex, { ...KATEX_LIMITS, macros: katexMacros(), throwOnError: true })
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

function asPlainText(latex: string): string {
  return String(latex)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
