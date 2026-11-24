import { z } from 'zod'

import { encoderEtat, type EtatCalculatrice } from '@/lib/calculatrice-etat'

// The course block `calculatrice` (ADR 0049 §6, #424), read at the boundary: the chapter comes
// from the API as loose JSON, so its fields are checked here before the calculator sees them.
// check-content and the teacher editor apply the content rules (calculatrice-rules.ts); this only
// keeps a malformed block from reaching the screen.

const intervalle = z
  .tuple([z.number().finite(), z.number().finite()])
  .refine(([min, max]) => min < max, 'min < max')

export const BlocCalculatriceSchema = z.object({
  id: z.string(),
  type: z.literal('calculatrice'),
  consigne: z.string().optional(),
  expressions: z.array(z.string()).min(1),
  fenetre: z.object({ x: intervalle, y: intervalle }).optional(),
})

export type BlocCalculatrice = z.infer<typeof BlocCalculatriceSchema>

/** The block, or null when its JSON is not one: nothing is shown rather than a broken tool. */
export function lireBlocCalculatrice(bloc: unknown): BlocCalculatrice | null {
  const lu = BlocCalculatriceSchema.safeParse(bloc)
  return lu.success ? lu.data : null
}

/**
 * The calculator's starting state. The author's window is kept as written: the grid is not made
 * orthonormal over it (that would change its y range); without a window, the default view.
 */
export function etatDepuisBloc(bloc: Pick<BlocCalculatrice, 'expressions' | 'fenetre'>) {
  const etat: EtatCalculatrice = {
    v: 1,
    lignes: bloc.expressions.map((texte) => ({ texte })),
  }
  if (bloc.fenetre) {
    const { x, y } = bloc.fenetre
    etat.fenetre = { xMin: x[0], xMax: x[1], yMin: y[0], yMax: y[1] }
    etat.orthonorme = false
  }
  return etat
}

/** Explorer's calculator holding this state (« Ouvrir en grand »). */
export function adresseExplorer(etat: EtatCalculatrice): string {
  return `/explorer/calculatrice?e=${encoderEtat(etat)}`
}

/** The instruction as a screen reader says it, without the rich text's markers. */
export function consigneEnTexte(consigne: string): string {
  return consigne
    .replace(/\*\*|==|\$/g, '')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}
