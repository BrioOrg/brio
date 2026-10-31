import katex, { type KatexOptions } from 'katex'

/**
 * Formulas are not all reviewed: a Communauté message holds whatever a student typed (ADR 0035),
 * so every call goes through these limits, courses included. They are far above what a course
 * uses, and they do not change the output of a formula that stays under them.
 *
 * - `trust: false` refuses `\href`, `\url`, `\includegraphics` and the `\html*` commands.
 * - `maxSize` caps every size the author writes (`\rule`, `\kern`, `\raisebox`), in em.
 * - `maxExpand` stops macros that expand forever (`\def\a{\a\a}`).
 * - `strict: 'ignore'` keeps a student's formula from writing to the server logs.
 * - `errorColor` shows what KaTeX refuses in the theme's colour instead of its own red.
 */
export const KATEX_LIMITS = {
  output: 'htmlAndMathml',
  trust: false,
  strict: 'ignore',
  maxSize: 20,
  maxExpand: 200,
  errorColor: 'var(--color-danger)',
} as const satisfies KatexOptions

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
    return katex.renderToString(latex, { ...KATEX_LIMITS, throwOnError: false, displayMode })
  } catch {
    return asPlainText(latex)
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
