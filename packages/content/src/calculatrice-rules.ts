// The course block `calculatrice` (ADR 0049 §6, #424): a compact graphing calculator an author
// places in a chapter, with its starting lines, an optional instruction and an optional window.
//
// The rules a block must follow beyond its JSON schema are here, shared by check-content and the
// teacher editor (as for figures, ADR 0038 §7). Each issue carries its path in the block and a
// French message written for the author: both callers print it as is. An expression is read by
// the calculator's own engine, so a line check-content accepts is a line the student sees drawn.

import { analyserLignes } from './grapheur/langage'

export type CalculatriceFenetre = {
  x: readonly [number, number]
  y: readonly [number, number]
}

export type CalculatriceSpec = {
  /** Rich text above the calculator: « Déplace le curseur $a$… ». */
  consigne?: string
  /** The starting lines, in the calculator's language (`y = ax`, `a = 1`). */
  expressions: readonly string[]
  /** The starting window; the calculator's default view when absent. */
  fenetre?: CalculatriceFenetre
}

export type CalculatriceIssue = { path: string; message: string }

/** A block is an illustration, not the Explorer page (12 lines): a few lines, read at a glance. */
export const CALCULATRICE_MAX_EXPRESSIONS = 8
export const CALCULATRICE_CONSIGNE_MAX = 280

const NBSP = ' '

export const MESSAGES_BLOC_CALCULATRICE = {
  tropDExpressions: `${CALCULATRICE_MAX_EXPRESSIONS} expressions au maximum dans un bloc.`,
  aucuneExpression: 'Ajoute au moins une expression.',
  expressionVide: `Cette expression est vide${NBSP}: écris-la ou supprime-la.`,
  fenetre: `La fenêtre est vide ou inversée${NBSP}: le minimum doit être plus petit que le maximum.`,
  consigne: `La consigne dépasse ${CALCULATRICE_CONSIGNE_MAX} caractères.`,
} as const

function intervalleValide(v: unknown): v is readonly [number, number] {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    v[0] < v[1]
  )
}

/** The number of characters a reader counts: code points, not UTF-16 units. */
function longueur(texte: string): number {
  return [...texte].length
}

/** Any block-shaped object: check-content and the editor hand over the JSON as it is. */
export function checkCalculatrice(spec: {
  consigne?: unknown
  expressions?: unknown
  fenetre?: unknown
  [champ: string]: unknown
}): CalculatriceIssue[] {
  const issues: CalculatriceIssue[] = []
  const M = MESSAGES_BLOC_CALCULATRICE

  if (typeof spec.consigne === 'string' && longueur(spec.consigne) > CALCULATRICE_CONSIGNE_MAX) {
    issues.push({ path: 'consigne', message: M.consigne })
  }

  const expressions = Array.isArray(spec.expressions) ? spec.expressions : []
  if (expressions.length === 0) {
    issues.push({ path: 'expressions', message: M.aucuneExpression })
  } else if (expressions.length > CALCULATRICE_MAX_EXPRESSIONS) {
    issues.push({ path: 'expressions', message: M.tropDExpressions })
  }

  // Read together, as the calculator reads them: a letter defined on one line is known on the
  // others, and a line using an undefined letter is an error.
  const textes = expressions.map((e) => (typeof e === 'string' ? e : ''))
  const analyse = analyserLignes(textes.map((texte, i) => ({ id: String(i), texte })))
  analyse.forEach((a, i) => {
    const path = `expressions[${i}]`
    if (a.genre === 'vide') issues.push({ path, message: M.expressionVide })
    else if (a.genre === 'erreur') issues.push({ path, message: a.erreur.message })
  })

  if (spec.fenetre !== undefined) {
    const f = spec.fenetre as { x?: unknown; y?: unknown } | null
    if (f === null || typeof f !== 'object') {
      issues.push({ path: 'fenetre', message: M.fenetre })
    } else {
      if (!intervalleValide(f.x)) issues.push({ path: 'fenetre.x', message: M.fenetre })
      if (!intervalleValide(f.y)) issues.push({ path: 'fenetre.y', message: M.fenetre })
    }
  }

  return issues
}
