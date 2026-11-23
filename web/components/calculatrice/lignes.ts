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

/** A number typed in French or English: "−1,5", "-1.5", "2". Null when it is not one. */
export function lireNombre(texte: string): number | null {
  const t = texte.trim().replace(/[−–]/g, '-').replace(',', '.')
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}

/** A value on the slider's grid: min + k·pas, without the floating-point tail. */
export function surLaGrille(v: number, c: CurseurEtat): number {
  const k = Math.round((v - c.min) / c.pas)
  const brut = Math.min(c.max, Math.max(c.min, c.min + k * c.pas))
  return Number(brut.toPrecision(12))
}
