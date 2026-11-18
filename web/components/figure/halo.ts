// The knockout of a textbook figure: a text gets a stroke in the page colour painted under its
// fill, so a curve, a guide or an edge passing behind it stops short of the letters (ADR 0038).
// A figure set on another surface than the page can say so with --figure-halo.

/** For SVG <text>. */
export const HALO_CLASS =
  '[paint-order:stroke] [stroke:var(--figure-halo,var(--color-surface-page))] [stroke-width:3px] [stroke-linejoin:round]'

/** For HTML set in a figure (a vector's KaTeX name): the same knockout, as a text shadow. */
export const HTML_HALO_CLASS =
  '[text-shadow:0_0_2px_var(--figure-halo,var(--color-surface-page)),0_0_2px_var(--figure-halo,var(--color-surface-page)),0_0_3px_var(--figure-halo,var(--color-surface-page))]'
