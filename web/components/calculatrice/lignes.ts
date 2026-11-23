import { nombreExact, type LigneAnalysee, type ModeAngle } from '@brio/content'

import type { CurveColour } from '@/lib/curve-colours'
import type { CurseurEtat, EtatCalculatrice } from '@/lib/calculatrice-etat'

// The lines of the calculator as the screen holds them: the address's state plus an id per line.
// Pure helpers, so the colour rules are tested without a DOM.

export type Ligne = {
  id: string
  texte: string
  couleur: CurveColour
  style: 'plein' | 'pointille'
  masquee: boolean
  curseur?: CurseurEtat
}

/** Names of the curve colours (#420): what the menu and the drawing's description say. */
export const NOMS_COULEURS: Record<CurveColour, string> = {
  1: 'bleu',
  2: 'orange',
  3: 'magenta',
  4: 'turquoise',
  5: 'violet',
  6: 'brique',
}

export const COULEURS: readonly CurveColour[] = [1, 2, 3, 4, 5, 6]

/** The first colour no line uses yet; once all six are taken, they come round again. */
export function prochaineCouleur(utilisees: readonly CurveColour[]): CurveColour {
  const libre = COULEURS.find((c) => !utilisees.includes(c))
  return libre ?? COULEURS[utilisees.length % COULEURS.length]
}

/** The lines of a state, each with an id and a colour (the next free one when none is given). */
export function lignesDepuisEtat(etat: EtatCalculatrice): Ligne[] {
  const lignes: Ligne[] = []
  for (const [i, l] of etat.lignes.entries()) {
    const couleur =
      (l.couleur as CurveColour | undefined) ?? prochaineCouleur(lignes.map((x) => x.couleur))
    lignes.push({
      id: `l${i}`,
      texte: l.texte,
      couleur,
      style: l.style ?? 'plein',
      masquee: l.masquee ?? false,
      ...(l.curseur && { curseur: l.curseur }),
    })
  }
  return lignes
}

/** The state to write in the address. */
export function etatDepuisLignes(
  lignes: readonly Ligne[],
  reste: Omit<EtatCalculatrice, 'v' | 'lignes'>
): EtatCalculatrice {
  return {
    v: 1,
    lignes: lignes.map((l) => ({
      texte: l.texte,
      couleur: l.couleur,
      ...(l.style === 'pointille' && { style: l.style }),
      ...(l.masquee && { masquee: true }),
      ...(l.curseur && { curseur: l.curseur }),
    })),
    ...reste,
  }
}

/** The bounds a slider starts with: −10 to 10 by 0,1, widened to hold its value. */
export function curseurParDefaut(valeur: number): CurseurEtat {
  return {
    min: Math.min(-10, Math.floor(valeur)),
    max: Math.max(10, Math.ceil(valeur)),
    pas: 0.1,
  }
}

/** The slider of a constant: its own bounds, widened to hold a value typed outside them. */
export function curseurPour(curseur: CurseurEtat | undefined, valeur: number): CurseurEtat {
  if (!curseur) return curseurParDefaut(valeur)
  if (valeur >= curseur.min && valeur <= curseur.max) return curseur
  return {
    ...curseur,
    min: Math.min(curseur.min, Math.floor(valeur)),
    max: Math.max(curseur.max, Math.ceil(valeur)),
  }
}

/** A number typed in French or English: "−1,5", "-1.5", "2", "1 000". Null when it is not one. */
export function lireNombre(texte: string): number | null {
  const t = texte
    .trim()
    .replace(/[ \u00a0\u202f\u2009]/g, '')
    .replace(/[\u2212\u2013]/g, '-')
    .replace(',', '.')
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}

/** Decimals a number is written with, in full: 0,25 → 2, 1e−7 → 7, 3 → 0. */
export function decimalesDe(v: number): number {
  return nombreExact(v, { grouper: false }).split(',')[1]?.length ?? 0
}

/**
 * A value on the slider's grid, min + k·pas, written with no more decimals than the step and the
 * minimum have: no floating-point tail.
 */
export function surLaGrille(v: number, c: CurseurEtat): number {
  const k = Math.round((v - c.min) / c.pas)
  const brut = Math.min(c.max, Math.max(c.min, c.min + k * c.pas))
  const d = Math.min(100, Math.max(decimalesDe(c.pas), decimalesDe(c.min)))
  const v2 = Number(brut.toFixed(d))
  return Object.is(v2, -0) ? 0 : v2
}

/**
 * The line of a slider constant for a value: `a = 0,0000001`, never an exponent, so the engine
 * reads back exactly the same value.
 */
export function texteConstante(nom: string, v: number): string {
  return `${nom} = ${nombreExact(v, { grouper: false })}`
}

/**
 * What the geometry of a curve depends on (V1-I2, gate 5): its own text, the angle unit, and the
 * text of every definition it may use, directly or through another (a slider's value is in its
 * text). Conservative: a name counts as used when its letters appear in the text, so a false
 * match only costs a trace, never a stale curve. Colour and stroke are not in it.
 */
export function cleDeCourbe(
  texte: string,
  lignes: readonly Ligne[],
  analyse: readonly LigneAnalysee[],
  angle: ModeAngle
): string {
  const definitions = new Map<string, string>()
  lignes.forEach((l, i) => {
    const a = analyse[i]
    if (a?.genre === 'constante' || (a?.genre === 'explicite' && a.nom !== null)) {
      definitions.set(a.nom as string, l.texte)
    }
  })
  const utilisees = new Set<string>()
  const aLire = [texte]
  while (aLire.length > 0) {
    const t = aLire.pop() as string
    for (const [nom, def] of definitions) {
      if (!utilisees.has(nom) && t.includes(nom)) {
        utilisees.add(nom)
        aLire.push(def)
      }
    }
  }
  const deps = [...utilisees].sort().map((n) => [n, definitions.get(n)])
  return JSON.stringify([texte, angle, deps])
}
