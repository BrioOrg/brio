import type { CurveColour } from '@/lib/curve-colours'

// Classes shared by the calculator's controls (spec U4 of #421).

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel'

/** A 44 px icon-only button, without a frame until hovered. */
export const BOUTON_ICONE = `grid size-11 shrink-0 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-raised hover:text-ink ${FOCUS}`

/** A 44 px button of a segmented control or a toggle; `aria-pressed` gives it its state. */
export const BOUTON_SEGMENT = `min-h-11 cursor-pointer rounded-md px-3 font-display text-sm font-bold text-ink-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-ink aria-pressed:bg-surface-raised aria-pressed:text-ink ${FOCUS}`

/** A group of buttons on the drawing. */
export const BARRE = 'inline-flex items-center rounded-lg border border-line bg-surface-panel p-0.5'

/** The compact field of a line and the bounds of a slider: TextInput's frame, without its label. */
export const CHAMP =
  'rounded-md border-2 bg-surface-raised text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus:outline-none focus:border-accent focus:[box-shadow:0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]'

export const CHAMP_INVALIDE =
  'border-feedback-incorrect focus:border-feedback-incorrect focus:[box-shadow:0_0_0_3px_color-mix(in_oklab,var(--color-feedback-incorrect)_25%,transparent)]'

/**
 * The maths field of a line (MathLive, #417): the frame of CHAMP on the custom element, its caret,
 * selection and placeholder from the tokens; no menu, and its keyboard toggle on touch screens only
 * (a « Clavier » button stands for it with a mouse).
 */
export const CHAMP_MATH =
  'block min-h-11 w-full min-w-0 rounded-md border-2 bg-surface-raised px-3 py-2 font-prose text-base text-ink transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] outline-none focus-within:border-accent focus-within:[box-shadow:0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)] [--caret-color:var(--color-accent)] [--selection-background-color:var(--color-accent-soft)] [--selection-color:var(--color-ink)] [--contains-highlight-background-color:var(--color-surface-panel)] [--placeholder-color:var(--color-ink-muted)] [--smart-fence-color:var(--color-ink-muted)] [--primary-color:var(--color-accent)] [&::part(menu-toggle)]:hidden pointer-fine:[&::part(virtual-keyboard-toggle)]:hidden'

export const CHAMP_MATH_INVALIDE =
  'border-feedback-incorrect focus-within:border-feedback-incorrect focus-within:[box-shadow:0_0_0_3px_color-mix(in_oklab,var(--color-feedback-incorrect)_25%,transparent)]'

/** Border of a hidden curve's pastille: a ring in the curve's colour. */
export const CURVE_BORDER = {
  1: 'border-courbe-1',
  2: 'border-courbe-2',
  3: 'border-courbe-3',
  4: 'border-courbe-4',
  5: 'border-courbe-5',
  6: 'border-courbe-6',
} as const satisfies Record<CurveColour, string>

export { FOCUS }
