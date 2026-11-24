// The language of the graphing calculator (ADR 0049): a list of lines, each one an expression,
// read together. A line defines a function (f(x) = x² − 3), a constant (a = 2, a slider), draws an
// explicit curve (y = 2x + 1, or 2x + 1 alone, or f'(x)) or an implicit one (x² + y² = 4,
// x = 3), or is a calculation (2/3 + 1/6, f(3), √2).
//
// Lines may come in any order: definitions are resolved by their dependencies. A user call is
// inlined (f(x − 1) becomes the body of f with x − 1 for x), a derivative f'(u) is the symbolic
// derivative of that body, so every curve compiles into one closure of x (or of x and y) with no
// lookup left at call time.
//
// Pure: no React, no DOM. Messages are French sentences with the position of the faulty
// character; their wording comes from the UX writer (gate 2 of #418).

import {
  applyBuiltin,
  parseExpression,
  TOO_LONG,
  type ExpressionNode,
  type ModeAngle,
} from '../expression'
import { compilerX, compilerXY } from './compilation'
import { DeriveeTropLongue, deriver } from './derivee'
import { latexName, latexOf } from './latex'
import {
  ajouter,
  diviser,
  estNul,
  multiplier,
  opposer,
  puissance,
  racine,
  rationnelDepuisDecimal,
  rationnelDepuisNombre,
  soustraire,
  valeurAbsolue,
  valeurDe,
  type Rationnel,
} from './rationnel'

export type { Rationnel } from './rationnel'
export { formaterRationnel, latexRationnel } from './rationnel'

export type { ModeAngle } from '../expression'

export type LigneSaisie = { id: string; texte: string }

/**
 * A French sentence and the 0-based index of the character it is about. `curseurPropose` names a
 * letter that is not defined anywhere: the screen offers to add a slider for it.
 */
export type ErreurLigne = { message: string; position: number; curseurPropose?: string }

export type LigneAnalysee =
  | { id: string; genre: 'vide' }
  | { id: string; genre: 'erreur'; erreur: ErreurLigne; latex?: string }
  | {
      id: string
      latex: string
      genre: 'explicite'
      /** The name of the function a definition line defines (f, g, f1); null otherwise. */
      nom: string | null
      f: (x: number) => number
    }
  | { id: string; latex: string; genre: 'implicite'; F: (x: number, y: number) => number }
  | {
      id: string
      latex: string
      genre: 'constante'
      nom: string
      valeur: number
      /** The value is a number as typed (a = 2, b = −1,5): the screen shows a slider. */
      curseur: boolean
      /** The value was computed with doubles and rounded: never shown after "=" (V4, #421). */
      arrondi?: boolean
    }
  | {
      id: string
      latex: string
      genre: 'calcul'
      valeur: number
      exact: Rationnel | null
      /** No exact fraction: `valeur` is a double rounded to 12 digits, never shown after "=". */
      arrondi?: boolean
    }

export type OptionsAnalyse = {
  angle?: ModeAngle
  /** The values of the slider constants, by name; they replace the value typed in the line. */
  valeurs?: Readonly<Record<string, number>>
}

const NBSP = ' '

/**
 * Bounds of a line once its calls are inlined and derived: beyond this many nodes, or this
 * depth, it is refused rather than compiled (the closures recurse once per level when called).
 */
export const NOEUDS_MAX = 50_000
export const PROFONDEUR_MAX = 1_000

export const MESSAGES = {
  lettreInconnue: (a: string) => `La lettre ${a} n’est pas définie.`,
  dejaDefinie: (a: string, ligne: number) =>
    `La lettre ${a} est déjà définie à la ligne ${ligne}. Choisis une autre lettre ou supprime l’une des deux lignes.`,
  circulaireSeule: (a: string) => `Cette ligne utilise ${a} pour définir ${a}.`,
  circulaire: (noms: string) =>
    `Ces lignes se renvoient l’une à l’autre${NBSP}: ${noms}. Change l’une des définitions pour casser la boucle.`,
  inequation:
    'Les inéquations ne sont pas prises en charge ici. Écris une égalité, avec un seul signe =.',
  plusieursEgal: 'Une ligne ne peut contenir qu’un seul signe =.',
  divisionParZero: `Division par zéro${NBSP}: ce calcul n’a pas de résultat.`,
  manqueAvant: 'Il manque une expression avant le signe =.',
  manqueApres: 'Il manque une expression après le signe =.',
  nomVariable: `x et y sont les variables du repère${NBSP}: choisis une autre lettre pour nommer la fonction, par exemple f.`,
  nomEuler: (exemple: string) =>
    `e est le nombre d’Euler (≈${NBSP}2,718)${NBSP}: choisis une autre lettre, par exemple ${exemple}.`,
  variableDeFonction: (f: string) =>
    `La variable d’une fonction s’écrit x${NBSP}: écris ${f}(x) = …`,
  fonctionAvecY: (f: string) => `${f}(x) ne peut dépendre que de x, pas de y.`,
  constanteAvecXY: (a: string) =>
    `${a} est une constante${NBSP}: sa valeur ne peut dépendre ni de x ni de y. Pour tracer une courbe, écris y = …`,
  yHorsEquation: `Une expression avec y se trace comme une équation${NBSP}: écris par exemple x² + y² = 4.`,
  rienATracer: `Cette égalité ne contient ni x ni y${NBSP}: il n’y a rien à tracer.`,
  nombreDejaConnu: (c: string) =>
    `${c} est déjà un nombre${NBSP}: choisis une lettre, par exemple a = 2.`,
  definitionEnErreur: (nom: string, ligne: number) =>
    `${nom} n’est pas utilisable${NBSP}: sa définition, ligne ${ligne}, contient une erreur.`,
  calculSansValeur: 'Ce calcul n’a pas de valeur réelle.',
  constanteSansValeur: (a: string) => `La valeur de ${a} n’est pas définie.`,
  toujoursVraie: `Cette égalité est vraie pour tous les points${NBSP}: il n’y a rien à tracer.`,
  vraieOuDefinie: `Cette égalité est vraie partout où elle est définie${NBSP}: il n’y a rien à tracer.`,
  nomMinuscule: (f: string) => `Écris le nom de la fonction en minuscule${NBSP}: ${f}(x) = …`,
  tropGrand: 'Ce nombre est trop grand pour la calculatrice.',
  zeroPuissanceZero: '0⁰ n’est pas défini.',
  puissanceNegative:
    'La puissance d’un nombre négatif n’est définie ici que pour un exposant entier.',
  deriveeIncalculable: (appel: string) => `Je ne sais pas calculer ${appel} avec cette écriture.`,
  tropLongue: TOO_LONG,
} as const

// ---------------------------------------------------------------------------------------------
// Reading each line on its own

type Tete =
  | { type: 'fonction'; nom: string; position: number; parametre: string; parametrePos: number }
  | { type: 'constante'; nom: string; position: number }

/** The shape of a line, from its text alone: where its "=" is, and what its left side names. */
type Forme =
  | { type: 'vide' }
  | { type: 'erreur'; erreur: ErreurLigne }
  | { type: 'expression' }
  | { type: 'egalite'; egal: number; gauche: string; droite: string; tete: Tete | null }

const TETE_FONCTION = /^(\s*)([a-z]\d?)(\s*\(\s*)([a-zA-Z])\s*\)\s*$/
const TETE_FONCTION_MAJUSCULE = /^(\s*)([A-Z])\d?\s*\(\s*[a-zA-Z]\s*\)\s*$/
const TETE_CONSTANTE = /^(\s*)([a-zA-Z])\s*$/
const INEQUATION = /[<>≤≥⩽⩾≠]/
const LITTERAL = /^\s*[+\-−–]?\s*(\d+([.,]\d+)?|[.,]\d+)\s*$/
/** Letters a line can never name: the two variables and Euler's number. */
const RESERVES: ReadonlySet<string> = new Set(['x', 'y', 'e'])

function forme(texte: string): Forme {
  if (texte.trim() === '') return { type: 'vide' }
  const inequation = INEQUATION.exec(texte)
  if (inequation) {
    return { type: 'erreur', erreur: { message: MESSAGES.inequation, position: inequation.index } }
  }
  const egal = texte.indexOf('=')
  if (egal < 0) return { type: 'expression' }
  const second = texte.indexOf('=', egal + 1)
  if (second >= 0) {
    return { type: 'erreur', erreur: { message: MESSAGES.plusieursEgal, position: second } }
  }
  // Each side keeps its place in the line: the other side is blanked, so every position the
  // parser reports is a position in the whole line.
  const gauche = texte.slice(0, egal)
  const droite = ' '.repeat(egal + 1) + texte.slice(egal + 1)
  if (gauche.trim() === '') {
    return { type: 'erreur', erreur: { message: MESSAGES.manqueAvant, position: egal } }
  }
  if (droite.trim() === '') {
    return { type: 'erreur', erreur: { message: MESSAGES.manqueApres, position: egal } }
  }
  const f = TETE_FONCTION.exec(gauche)
  if (f) {
    const position = f[1].length
    return {
      type: 'egalite',
      egal,
      gauche,
      droite,
      tete: {
        type: 'fonction',
        nom: f[2],
        position,
        parametre: f[4],
        parametrePos: position + f[2].length + f[3].length,
      },
    }
  }
  const majuscule = TETE_FONCTION_MAJUSCULE.exec(gauche)
  if (majuscule) {
    return {
      type: 'erreur',
      erreur: {
        message: MESSAGES.nomMinuscule(majuscule[2].toLowerCase()),
        position: majuscule[1].length,
      },
    }
  }
  const c = TETE_CONSTANTE.exec(gauche)
  const tete: Tete | null =
    c && c[2] !== 'x' && c[2] !== 'y'
      ? { type: 'constante', nom: c[2], position: c[1].length }
      : null
  return { type: 'egalite', egal, gauche, droite, tete }
}

/** The error a head carries by itself (a reserved name, a variable other than x); null if none. */
function erreurDeTete(tete: Tete): ErreurLigne | null {
  // The letter decides, digit or not: x1(x) or e2(x) would read x·1 or Euler's number.
  const lettre = tete.nom[0]
  if (lettre === 'x' || lettre === 'y') {
    return { message: MESSAGES.nomVariable, position: tete.position }
  }
  if (lettre === 'e') {
    return {
      message: MESSAGES.nomEuler(tete.type === 'fonction' ? 'f' : 'a'),
      position: tete.position,
    }
  }
  if (tete.type === 'fonction' && tete.parametre !== 'x') {
    return { message: MESSAGES.variableDeFonction(tete.nom), position: tete.parametrePos }
  }
  return null
}

type Reference = { nom: string; position: number }

/** What a line means, once parsed; `corps` is the tree to resolve. */
type Sens =
  | { genre: 'vide' }
  | { genre: 'erreur'; erreur: ErreurLigne; latex?: string }
  | { genre: 'fonction'; nom: string; position: number; corps: ExpressionNode; latex: string }
  | {
      genre: 'constante'
      nom: string
      position: number
      corps: ExpressionNode
      latex: string
      litteral: string | null
    }
  | { genre: 'explicite'; corps: ExpressionNode; latex: string }
  | { genre: 'implicite'; corps: ExpressionNode; latex: string }
  | { genre: 'calcul'; corps: ExpressionNode; latex: string }

function variablesDe(tree: ExpressionNode, into: Map<string, number> = new Map()) {
  switch (tree.type) {
    case 'variable':
      if (!into.has(tree.name)) into.set(tree.name, tree.pos ?? 0)
      break
    case 'negate':
      variablesDe(tree.operand, into)
      break
    case 'call':
    case 'userCall':
      variablesDe(tree.arg, into)
      break
    case 'binary':
      variablesDe(tree.left, into)
      variablesDe(tree.right, into)
      break
    case 'number':
    case 'constant':
      break
  }
  return into
}

/** The letters and functions a tree refers to (x and y aside), in the order they are written. */
function references(tree: ExpressionNode, into: Reference[] = []): Reference[] {
  switch (tree.type) {
    case 'variable':
      if (tree.name !== 'x' && tree.name !== 'y') {
        into.push({ nom: tree.name, position: tree.pos ?? 0 })
      }
      break
    case 'userCall':
      into.push({ nom: tree.name, position: tree.pos ?? 0 })
      references(tree.arg, into)
      break
    case 'negate':
      references(tree.operand, into)
      break
    case 'call':
      references(tree.arg, into)
      break
    case 'binary':
      references(tree.left, into)
      references(tree.right, into)
      break
    case 'number':
    case 'constant':
      break
  }
  // A walk from left to right: the references come in the order they are written.
  return into
}

function lire(
  source: string,
  fonctions: readonly string[],
  angle: ModeAngle
): { ok: true; tree: ExpressionNode } | { ok: false; erreur: ErreurLigne } {
  const r = parseExpression(source, { calculator: { functions: fonctions, angle } })
  return r.ok ? { ok: true, tree: r.expression.tree } : { ok: false, erreur: r.error }
}

function sens(texte: string, f: Forme, fonctions: readonly string[], angle: ModeAngle): Sens {
  if (f.type === 'vide') return { genre: 'vide' }
  if (f.type === 'erreur') return { genre: 'erreur', erreur: f.erreur }
  if (f.type === 'expression') {
    const r = lire(texte, fonctions, angle)
    if (!r.ok) return { genre: 'erreur', erreur: r.erreur }
    const latex = latexOf(r.tree)
    const vars = variablesDe(r.tree)
    const y = vars.get('y')
    if (y !== undefined) {
      return { genre: 'erreur', erreur: { message: MESSAGES.yHorsEquation, position: y }, latex }
    }
    return { genre: vars.has('x') ? 'explicite' : 'calcul', corps: r.tree, latex }
  }

  const { tete } = f
  if (tete) {
    const erreur = erreurDeTete(tete)
    if (erreur) return { genre: 'erreur', erreur }
  }
  const droite = lire(f.droite, fonctions, angle)
  if (tete?.type === 'fonction') {
    if (!droite.ok) return { genre: 'erreur', erreur: droite.erreur }
    const latex = `${latexName(tete.nom)}(x)=${latexOf(droite.tree)}`
    const y = variablesDe(droite.tree).get('y')
    if (y !== undefined) {
      return {
        genre: 'erreur',
        erreur: { message: MESSAGES.fonctionAvecY(tete.nom), position: y },
        latex,
      }
    }
    return { genre: 'fonction', nom: tete.nom, position: tete.position, corps: droite.tree, latex }
  }
  if (tete?.type === 'constante') {
    if (!droite.ok) return { genre: 'erreur', erreur: droite.erreur }
    const latex = `${latexName(tete.nom)}=${latexOf(droite.tree)}`
    const vars = variablesDe(droite.tree)
    const xy = Math.min(vars.get('x') ?? Infinity, vars.get('y') ?? Infinity)
    if (xy !== Infinity) {
      return {
        genre: 'erreur',
        erreur: { message: MESSAGES.constanteAvecXY(tete.nom), position: xy },
        latex,
      }
    }
    return {
      genre: 'constante',
      nom: tete.nom,
      position: tete.position,
      corps: droite.tree,
      latex,
      litteral: LITTERAL.test(f.droite) ? f.droite : null,
    }
  }

  const gauche = lire(f.gauche, fonctions, angle)
  if (!gauche.ok) return { genre: 'erreur', erreur: gauche.erreur }
  if (!droite.ok) return { genre: 'erreur', erreur: droite.erreur }
  const latex = `${latexOf(gauche.tree)}=${latexOf(droite.tree)}`
  const g = gauche.tree
  if (g.type === 'constant') {
    return {
      genre: 'erreur',
      erreur: { message: MESSAGES.nombreDejaConnu(g.name), position: g.pos ?? 0 },
      latex,
    }
  }
  const varsD = variablesDe(droite.tree)
  if (g.type === 'variable' && g.name === 'y' && !varsD.has('y')) {
    return { genre: 'explicite', corps: droite.tree, latex }
  }
  // F(x, y) = left − right: the curve is where F is 0. An equality with neither x nor y, or
  // true everywhere (y = y), is refused once its letters are known (`evaluer`).
  const corps: ExpressionNode = {
    type: 'binary',
    op: '-',
    left: g,
    right: droite.tree,
    pos: f.egal,
  }
  return { genre: 'implicite', corps, latex }
}

// ---------------------------------------------------------------------------------------------
// Resolving the lines together

class TropLongue extends Error {}

/** A calculation refused, with its French message and the position in the line. */
class ErreurCalcul extends Error {
  readonly position: number
  constructor(message: string, position: number) {
    super(message)
    this.position = position
  }
}

/** The tree with x replaced by `arg`; every node takes the position of the call (`pos`). */
function substituer(
  tree: ExpressionNode,
  arg: ExpressionNode,
  pos: number | undefined,
  budget: { reste: number }
): ExpressionNode {
  if (--budget.reste < 0) throw new TropLongue()
  const at = <N extends ExpressionNode>(node: N): N => {
    if (pos !== undefined) node.pos = pos
    return node
  }
  switch (tree.type) {
    case 'variable':
      return tree.name === 'x' ? arg : at({ type: 'variable', name: tree.name })
    case 'number': {
      const node: ExpressionNode = { type: 'number', value: tree.value }
      if (tree.text !== undefined) node.text = tree.text
      return at(node)
    }
    case 'constant':
      return at({ type: 'constant', name: tree.name })
    case 'negate':
      return at({ type: 'negate', operand: substituer(tree.operand, arg, pos, budget) })
    case 'call': {
      const node: ExpressionNode = {
        type: 'call',
        fn: tree.fn,
        arg: substituer(tree.arg, arg, pos, budget),
      }
      if (tree.degrees) node.degrees = true
      return at(node)
    }
    case 'userCall':
      return at({
        type: 'userCall',
        name: tree.name,
        order: tree.order,
        arg: substituer(tree.arg, arg, pos, budget),
      })
    case 'binary':
      return at({
        type: 'binary',
        op: tree.op,
        left: substituer(tree.left, arg, pos, budget),
        right: substituer(tree.right, arg, pos, budget),
      })
  }
}

/**
 * Whether a tree is beyond NOEUDS_MAX nodes or PROFONDEUR_MAX levels. Iterative, and it stops
 * as soon as it knows: a derived tree shares sub-trees, and walked as a tree it can be huge.
 */
export function tropGrandArbre(
  tree: ExpressionNode,
  noeuds: number = NOEUDS_MAX,
  profondeur: number = PROFONDEUR_MAX
): boolean {
  const pile: Array<[ExpressionNode, number]> = [[tree, 1]]
  let compte = 0
  for (let item = pile.pop(); item !== undefined; item = pile.pop()) {
    const [node, d] = item
    if (++compte > noeuds || d > profondeur) return true
    switch (node.type) {
      case 'negate':
        pile.push([node.operand, d + 1])
        break
      case 'call':
      case 'userCall':
        pile.push([node.arg, d + 1])
        break
      case 'binary':
        pile.push([node.left, d + 1], [node.right, d + 1])
        break
      case 'number':
      case 'variable':
      case 'constant':
        break
    }
  }
  return false
}

type Valeur = { v: number; r: Rationnel | null }

/**
 * What a calculation met on its way: `max`, the largest term of a sum or angle; `depasse`, a
 * double that overflowed to ±∞ (2^2048), after which ∞/∞ or ∞ − ∞ is NaN without meaning that
 * the value does not exist.
 */
type Echelle = { max: number; depasse: boolean }

/**
 * A calculation worked out once, in doubles and, where it can be, in exact fractions. `echelle`
 * records the largest term of a sum and the largest angle met: a result 10¹² times smaller is a
 * rounding residue (sin(π) = 1,2·10⁻¹⁶, √2·√2 − 2 = 4,4·10⁻¹⁶), not a value (π/10²⁰ is one).
 */
function calculer(
  tree: ExpressionNode,
  valeurs: ReadonlyMap<string, number>,
  exacts: ReadonlyMap<string, Rationnel | null>,
  echelle: Echelle
): Valeur {
  const c = calculerNoeud(tree, valeurs, exacts, echelle)
  if (c.v === Infinity || c.v === -Infinity) echelle.depasse = true
  return c
}

/** Records a magnitude where a rounding residue can appear: a term of a sum, an angle. */
function noter(echelle: Echelle, v: number): void {
  const m = Math.abs(v)
  if (m - m === 0 && m > echelle.max) echelle.max = m
}

function calculerNoeud(
  tree: ExpressionNode,
  valeurs: ReadonlyMap<string, number>,
  exacts: ReadonlyMap<string, Rationnel | null>,
  echelle: Echelle
): Valeur {
  const sous = (t: ExpressionNode) => calculer(t, valeurs, exacts, echelle)
  switch (tree.type) {
    case 'number':
      // Typed digits are read from their text: 12345678901234567 is not the double it rounds to.
      return {
        v: tree.value,
        r:
          tree.text !== undefined
            ? rationnelDepuisDecimal(tree.text)
            : rationnelDepuisNombre(tree.value),
      }
    case 'constant':
      return { v: tree.name === 'π' ? Math.PI : Math.E, r: null }
    case 'variable':
      return { v: valeurs.get(tree.name) ?? NaN, r: exacts.get(tree.name) ?? null }
    case 'userCall':
      return { v: NaN, r: null }
    case 'negate': {
      const a = sous(tree.operand)
      return { v: -a.v, r: a.r && opposer(a.r) }
    }
    case 'call': {
      const a = sous(tree.arg)
      // ln(0) is −∞ for a double: not a value, not an overflow either.
      const v = applyBuiltin(tree.fn, a.v, tree.degrees)
      if (tree.fn === 'sin' || tree.fn === 'cos' || tree.fn === 'tan') noter(echelle, a.v)
      if ((tree.fn === 'ln' || tree.fn === 'log') && a.v === 0) return { v: NaN, r: null }
      const r =
        a.r && (tree.fn === 'sqrt' ? racine(a.r) : tree.fn === 'abs' ? valeurAbsolue(a.r) : null)
      return { v, r }
    }
    case 'binary': {
      const a = sous(tree.left)
      const b = sous(tree.right)
      const ra = a.r
      const rb = b.r
      switch (tree.op) {
        case '+':
          noter(echelle, a.v)
          noter(echelle, b.v)
          return { v: a.v + b.v, r: ra && rb && ajouter(ra, rb) }
        case '-':
          noter(echelle, a.v)
          noter(echelle, b.v)
          return { v: a.v - b.v, r: ra && rb && soustraire(ra, rb) }
        case '*':
          return { v: a.v * b.v, r: ra && rb && multiplier(ra, rb) }
        case '/': {
          if (rb ? estNul(rb) : b.v === 0) {
            throw new ErreurCalcul(MESSAGES.divisionParZero, tree.pos ?? 0)
          }
          return { v: a.v / b.v, r: ra && rb && diviser(ra, rb) }
        }
        case '^': {
          if (ra ? estNul(ra) : a.v === 0) {
            if (rb ? estNul(rb) : b.v === 0) {
              throw new ErreurCalcul(MESSAGES.zeroPuissanceZero, tree.pos ?? 0)
            }
            if (b.v < 0) throw new ErreurCalcul(MESSAGES.divisionParZero, tree.pos ?? 0)
          }
          // (−8)^(1/3): no real value is chosen for a negative base and a non-integer exponent.
          const entier = rb ? rb.den === 1n : Number.isInteger(b.v)
          if ((ra ? ra.num < 0n : a.v < 0) && !entier) {
            throw new ErreurCalcul(MESSAGES.puissanceNegative, tree.pos ?? 0)
          }
          return { v: Math.pow(a.v, b.v), r: ra && rb && puissance(ra, rb) }
        }
      }
    }
  }
}

/** Significant digits of a decimal calculation: what is left after rounding residues. */
export const CHIFFRES_SIGNIFICATIFS = 12

/**
 * The value shown for a calculation: the exact fraction's when there is one; otherwise the double
 * rounded to 12 significant digits, and 0 below 10⁻¹² of the largest term or angle met (sin(π) is 0,
 * √2·√2 is 2). A French message for a value that is not a number or does not fit a double; a
 * decimal calculation in which a term overflowed is too big, whatever it ends on (2^2048/2^2047
 * reads ∞/∞, 1/2^2048 reads 0): never "pas de valeur réelle", never a made-up value.
 */
function valeurAffichee(c: Valeur, echelle: Echelle): number | { message: string } {
  const v = c.r ? valeurDe(c.r) : c.v
  if (!c.r && echelle.depasse) return { message: MESSAGES.tropGrand }
  if (Number.isNaN(v)) return { message: MESSAGES.calculSansValeur }
  if (!Number.isFinite(v)) return { message: MESSAGES.tropGrand }
  if (c.r) return v
  if (Math.abs(v) < 1e-12 * echelle.max) return 0
  return Number(v.toPrecision(CHIFFRES_SIGNIFICATIFS))
}

/** The first call to a derivative (f'(…), f''(…)) in the tree, if any. */
function premiereDerivee(
  tree: ExpressionNode
): Extract<ExpressionNode, { type: 'userCall' }> | null {
  switch (tree.type) {
    case 'userCall':
      return tree.order > 0 ? tree : premiereDerivee(tree.arg)
    case 'negate':
      return premiereDerivee(tree.operand)
    case 'call':
      return premiereDerivee(tree.arg)
    case 'binary':
      return premiereDerivee(tree.left) ?? premiereDerivee(tree.right)
    case 'number':
    case 'variable':
    case 'constant':
      return null
  }
}

/** Every derivative call f⁽ⁿ⁾(u) of the tree becomes f⁽ⁿ⁾(u + x): x is the step h of a limit. */
function decalerDerivees(tree: ExpressionNode): ExpressionNode {
  switch (tree.type) {
    case 'userCall': {
      const arg = decalerDerivees(tree.arg)
      return {
        ...tree,
        arg:
          tree.order > 0
            ? { type: 'binary', op: '+', left: arg, right: { type: 'variable', name: 'x' } }
            : arg,
      }
    }
    case 'negate':
      return { ...tree, operand: decalerDerivees(tree.operand) }
    case 'call':
      return { ...tree, arg: decalerDerivees(tree.arg) }
    case 'binary':
      return { ...tree, left: decalerDerivees(tree.left), right: decalerDerivees(tree.right) }
    case 'number':
    case 'variable':
    case 'constant':
      return tree
  }
}

/**
 * One side of a limit at 0: g extrapolated linearly to 0 from the steps (s·10⁻⁴, s·10⁻⁵) and
 * from (s·10⁻⁵, s·10⁻⁶). The two must coincide (within 10⁻⁸): a value that keeps moving as the
 * step shrinks (1/h² gives −1,1·10¹¹ then −1,1·10¹³) is not a limit. Null otherwise.
 */
function limiteDUnCote(g: (h: number) => number, s: 1 | -1): number | null {
  const [a, b, c] = [g(s * 1e-4), g(s * 1e-5), g(s * 1e-6)]
  const grossiere = (10 * b - a) / 9
  const fine = (10 * c - b) / 9
  if (!Number.isFinite(grossiere) || !Number.isFinite(fine)) return null
  if (Math.abs(grossiere - fine) > 1e-8 * Math.max(1, Math.abs(fine))) return null
  return fine
}

/**
 * The value at h = 0 of g(h), from both sides: each side must converge (`limiteDUnCote`), and
 * the two sides must agree within 10⁻⁹. For f(x) = x|x|, f'(h) = 2|h| has the limit 0 at 0
 * where the formula reads 0/0; for f(x) = x√x the left side is not defined, for 1/x the two
 * sides agree on f'(h) = −1/h² but never converge, and there is no limit to show. Null when a
 * side does not converge or the sides disagree.
 */
export function limiteBilaterale(g: (h: number) => number): number | null {
  const gauche = limiteDUnCote(g, -1)
  const droite = limiteDUnCote(g, 1)
  if (gauche === null || droite === null) return null
  const tolerance = 1e-9 * Math.max(1, Math.abs(gauche), Math.abs(droite))
  if (Math.abs(gauche - droite) > tolerance) return null
  const v = (gauche + droite) / 2
  return Math.abs(v) < 1e-9 ? 0 : Number(v.toPrecision(9))
}

/**
 * Whether F is defined at a and continuous there, as far as doubles tell: F(a) finite, and
 * F(a ± h) closing in on it as h shrinks from 10⁻⁵ to 10⁻⁶ (by a factor 5 at least, or already
 * within 10⁻⁹). A pole (1/x at 0), a hole (sin(x)/x at 0) or a jump fails.
 */
export function continueEn(F: (x: number) => number, a: number): boolean {
  const v = F(a)
  if (!Number.isFinite(v)) return false
  const presque = 1e-9 * Math.max(1, Math.abs(v))
  return [1, -1].every((s) => {
    const loin = Math.abs(F(a + s * 1e-5) - v)
    const pres = Math.abs(F(a + s * 1e-6) - v)
    if (!Number.isFinite(loin) || !Number.isFinite(pres)) return false
    return pres <= presque || pres <= loin / 5
  })
}

/** Every call to a derivative (f'(…), f''(…)) in the tree, nested ones included. */
function derivees(
  tree: ExpressionNode,
  into: Array<Extract<ExpressionNode, { type: 'userCall' }>> = []
): Array<Extract<ExpressionNode, { type: 'userCall' }>> {
  switch (tree.type) {
    case 'userCall':
      if (tree.order > 0) into.push(tree)
      derivees(tree.arg, into)
      break
    case 'negate':
      derivees(tree.operand, into)
      break
    case 'call':
      derivees(tree.arg, into)
      break
    case 'binary':
      derivees(tree.left, into)
      derivees(tree.right, into)
      break
    case 'number':
    case 'variable':
    case 'constant':
      break
  }
  return into
}

/** The text of a call as typed from `pos` (f'(0), f''(1/2)), primes written ′. */
function texteAppel(texte: string, pos: number): string {
  let i = pos
  while (i < texte.length && texte[i] !== '(') i++
  let profondeur = 0
  for (; i < texte.length; i++) {
    if (texte[i] === '(') profondeur++
    else if (texte[i] === ')' && --profondeur === 0) break
  }
  return texte
    .slice(pos, i + 1)
    .replace(/['’′]/g, '′')
    .replace(/\s+/g, '')
}

/** Tarjan's strongly connected components, dependencies first. */
function composantes(n: number, aretes: readonly (readonly number[])[]): number[][] {
  const index: number[] = new Array<number>(n).fill(-1)
  const bas: number[] = new Array<number>(n).fill(0)
  const surPile: boolean[] = new Array<boolean>(n).fill(false)
  const pile: number[] = []
  const resultat: number[][] = []
  let compteur = 0
  const visiter = (v: number): void => {
    index[v] = bas[v] = compteur++
    pile.push(v)
    surPile[v] = true
    for (const w of aretes[v]) {
      if (index[w] < 0) {
        visiter(w)
        bas[v] = Math.min(bas[v], bas[w])
      } else if (surPile[w]) {
        bas[v] = Math.min(bas[v], index[w])
      }
    }
    if (bas[v] === index[v]) {
      const composante: number[] = []
      let w: number
      do {
        w = pile.pop()!
        surPile[w] = false
        composante.push(w)
      } while (w !== v)
      resultat.push(composante.sort((a, b) => a - b))
    }
  }
  for (let v = 0; v < n; v++) if (index[v] < 0) visiter(v)
  return resultat
}

/** "f", "f et g", "f, g et h". */
function enumerer(noms: readonly string[]): string {
  return noms.length < 2
    ? noms.join('')
    : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
}

/** Points where an equality in x and y is tried before it is called true everywhere. */
const POINTS_ESSAI: ReadonlyArray<readonly [number, number]> = [
  [0.3711, -1.2343],
  [2.718, 0.577],
  [-3.14, 4.2],
  [10.5, -7.25],
  [-0.123, 0.987],
  [5.5, 5.5],
  [1.4142, 1.7321],
]

/**
 * Reads the lines together: same order and same ids as the input. Never throws; a line that
 * cannot be drawn or computed comes back as an `erreur`, and the others are still read.
 */
export function analyserLignes(
  lignes: readonly LigneSaisie[],
  options: OptionsAnalyse = {}
): LigneAnalysee[] {
  const angle: ModeAngle = options.angle === 'degres' ? 'degres' : 'radians'
  const formes = lignes.map((l) => forme(l.texte))

  // 1. Who defines which letter: the first line wins, from its text alone.
  const proprietaire = new Map<string, number>()
  const fonctions: string[] = []
  formes.forEach((f, i) => {
    // A head with a wrong variable (f(t) = …) still owns f: its users say f is broken.
    if (f.type !== 'egalite' || !f.tete || RESERVES.has(f.tete.nom[0])) return
    if (proprietaire.has(f.tete.nom)) return
    proprietaire.set(f.tete.nom, i)
    if (f.tete.type === 'fonction') fonctions.push(f.tete.nom)
  })

  // 2. Each line parsed, knowing the function names; a second definition is refused. A line too
  //    deep for the call stack is refused on its own (the parser bounds the input; this is the
  //    net under it).
  const sensDe: Sens[] = formes.map((f, i) => {
    let s: Sens
    try {
      s = sens(lignes[i].texte, f, fonctions, angle)
    } catch (e) {
      if (e instanceof RangeError) {
        return { genre: 'erreur', erreur: { message: MESSAGES.tropLongue, position: 0 } }
      }
      throw e
    }
    if (s.genre !== 'fonction' && s.genre !== 'constante') return s
    const premier = proprietaire.get(s.nom)
    if (premier === undefined || premier === i) return s
    return {
      genre: 'erreur',
      erreur: { message: MESSAGES.dejaDefinie(s.nom, premier + 1), position: s.position },
      latex: s.latex,
    }
  })

  // 3. Letters nobody defines.
  const refs: Reference[][] = sensDe.map((s) => ('corps' in s ? references(s.corps) : []))
  sensDe.forEach((s, i) => {
    if (s.genre === 'vide' || s.genre === 'erreur') return
    const inconnue = refs[i].find((r) => !proprietaire.has(r.nom))
    if (inconnue) {
      sensDe[i] = {
        genre: 'erreur',
        erreur: {
          message: MESSAGES.lettreInconnue(inconnue.nom),
          position: inconnue.position,
          curseurPropose: inconnue.nom,
        },
        latex: s.latex,
      }
    }
  })

  // 4. Dependencies first; a cycle is refused on each of its lines; a line that uses a definition
  //    in error is in error too.
  const aretes = refs.map((rs) =>
    rs.flatMap((r) => {
      const j = proprietaire.get(r.nom)
      return j === undefined ? [] : [j]
    })
  )
  const valeurs = new Map<string, number>()
  const exacts = new Map<string, Rationnel | null>()
  const corpsDerives = new Map<string, ExpressionNode>()
  const resultat: LigneAnalysee[] = lignes.map((l) => ({ id: l.id, genre: 'vide' }))

  const corpsDe = (nom: string, ordre: number, budget: { reste: number }): ExpressionNode => {
    const cle = `${nom}:${ordre.toString()}`
    const connu = corpsDerives.get(cle)
    if (connu) return connu
    let corps: ExpressionNode
    if (ordre === 0) {
      const s = sensDe[proprietaire.get(nom)!]
      corps = s.genre === 'fonction' ? resoudre(s.corps, budget) : { type: 'number', value: NaN }
    } else {
      // The derivative spends the same budget as the inlining: one step per node it derives.
      corps = deriver(corpsDe(nom, ordre - 1, budget), 'x', budget)
      if (tropGrandArbre(corps)) throw new TropLongue()
    }
    corpsDerives.set(cle, corps)
    return corps
  }

  // Every user call replaced by the body of its function (derived as many times as asked).
  const resoudre = (tree: ExpressionNode, budget: { reste: number }): ExpressionNode => {
    if (--budget.reste < 0) throw new TropLongue()
    switch (tree.type) {
      case 'number':
      case 'variable':
      case 'constant':
        return tree
      case 'negate':
        return { ...tree, operand: resoudre(tree.operand, budget) }
      case 'call':
        return { ...tree, arg: resoudre(tree.arg, budget) }
      case 'binary':
        return { ...tree, left: resoudre(tree.left, budget), right: resoudre(tree.right, budget) }
      case 'userCall':
        return substituer(
          corpsDe(tree.name, tree.order, budget),
          resoudre(tree.arg, budget),
          tree.pos,
          budget
        )
    }
  }

  const enErreur = new Set<number>()
  for (const composante of composantes(lignes.length, aretes)) {
    const cyclique = composante.length > 1 || aretes[composante[0]].includes(composante[0])
    for (const i of composante) {
      const s = sensDe[i]
      if (s.genre === 'vide') continue
      if (s.genre === 'erreur') {
        enErreur.add(i)
        resultat[i] = {
          id: lignes[i].id,
          genre: 'erreur',
          erreur: s.erreur,
          ...latexSiPresent(s.latex),
        }
        continue
      }
      if (cyclique) {
        const dansCycle = refs[i].find((r) => composante.includes(proprietaire.get(r.nom)!))
        const noms = composante.map((j) => {
          const t = sensDe[j]
          return t.genre === 'fonction' || t.genre === 'constante' ? t.nom : '?'
        })
        enErreur.add(i)
        resultat[i] = {
          id: lignes[i].id,
          genre: 'erreur',
          erreur: {
            message:
              noms.length === 1
                ? MESSAGES.circulaireSeule(noms[0])
                : MESSAGES.circulaire(enumerer(noms)),
            position: dansCycle?.position ?? 0,
          },
          latex: s.latex,
        }
        continue
      }
      const casse = refs[i].find((r) => enErreur.has(proprietaire.get(r.nom)!))
      if (casse) {
        enErreur.add(i)
        resultat[i] = {
          id: lignes[i].id,
          genre: 'erreur',
          erreur: {
            message: MESSAGES.definitionEnErreur(casse.nom, proprietaire.get(casse.nom)! + 1),
            position: casse.position,
          },
          latex: s.latex,
        }
        continue
      }
      let ligne: LigneAnalysee
      try {
        ligne = evaluer(i, s)
      } catch (e) {
        if (!(
          e instanceof TropLongue ||
          e instanceof DeriveeTropLongue ||
          e instanceof RangeError
        )) {
          throw e
        }
        ligne = {
          id: lignes[i].id,
          genre: 'erreur',
          erreur: { message: MESSAGES.tropLongue, position: 0 },
          latex: s.latex,
        }
      }
      if (ligne.genre === 'erreur') enErreur.add(i)
      resultat[i] = ligne
    }
  }
  return resultat

  /** The line inlined, within the bounds; throws TropLongue past them. */
  function resolu(tree: ExpressionNode): ExpressionNode {
    const corps = resoudre(tree, { reste: NOEUDS_MAX })
    if (tropGrandArbre(corps)) throw new TropLongue()
    return corps
  }

  function evaluer(
    i: number,
    s: Exclude<Sens, { genre: 'vide' } | { genre: 'erreur' }>
  ): LigneAnalysee {
    const id = lignes[i].id
    const erreur = (message: string, position: number): LigneAnalysee => ({
      id,
      genre: 'erreur',
      erreur: { message, position },
      latex: s.latex,
    })
    const corps = resolu(s.corps)
    switch (s.genre) {
      case 'fonction':
        return { id, latex: s.latex, genre: 'explicite', nom: s.nom, f: compilerX(corps, valeurs) }
      case 'explicite':
        return { id, latex: s.latex, genre: 'explicite', nom: null, f: compilerX(corps, valeurs) }
      case 'implicite': {
        const refus = egaliteSansCourbe(corps)
        if (refus) return erreur(refus, s.corps.pos ?? 0)
        return { id, latex: s.latex, genre: 'implicite', F: compilerXY(corps, valeurs) }
      }
      case 'constante': {
        const curseur = s.litteral !== null
        const impose = options.valeurs?.[s.nom]
        let interne: number
        let exact: Rationnel | null
        let affichee: number | { message: string }
        if (curseur && impose !== undefined && Number.isFinite(impose)) {
          interne = impose
          exact = rationnelDepuisNombre(impose)
          affichee = valeurAffichee(
            { v: impose, r: null },
            { max: Math.abs(impose), depasse: false }
          )
        } else if (curseur) {
          exact = rationnelDepuisDecimal(s.litteral!)
          interne = exact ? valeurDe(exact) : NaN
          affichee = valeurAffichee(
            { v: interne, r: exact },
            { max: Math.abs(interne), depasse: false }
          )
        } else {
          const c = calculLigne(i, s.corps, corps)
          if ('message' in c) {
            return c.message === MESSAGES.calculSansValeur
              ? erreur(MESSAGES.constanteSansValeur(s.nom), s.position)
              : erreur(c.message, c.position)
          }
          interne = c.interne
          exact = c.exact
          affichee = c.valeur
        }
        if (typeof affichee !== 'number') {
          return erreur(
            affichee.message === MESSAGES.tropGrand
              ? MESSAGES.tropGrand
              : MESSAGES.constanteSansValeur(s.nom),
            s.position
          )
        }
        // The lines that use the constant read its full value; the line shows it rounded.
        valeurs.set(s.nom, interne)
        exacts.set(s.nom, exact)
        return {
          id,
          latex: s.latex,
          genre: 'constante',
          nom: s.nom,
          valeur: affichee,
          curseur,
          arrondi: exact === null,
        }
      }
      case 'calcul': {
        const c = calculLigne(i, s.corps, corps)
        if ('message' in c) return erreur(c.message, c.position)
        return {
          id,
          latex: s.latex,
          genre: 'calcul',
          valeur: c.valeur,
          exact: c.exact,
          arrondi: c.exact === null,
        }
      }
    }
  }

  /**
   * A calculation line (or the value of a constant). A derivative f⁽ⁿ⁾(a) is computed only where
   * f⁽ⁿ⁻¹⁾ is defined and continuous at a (the derivative-limit theorem): 1/x has no f'(0), and
   * tan no f'(π/2), whatever the formula of f' reads there. When the formula has no value at a
   * (x|x| derived reads 0/0 at 0), the value is the limit from both sides, if it exists, and never
   * exact: the formula, not the function, is what fails.
   */
  function calculLigne(
    i: number,
    tree: ExpressionNode,
    corps: ExpressionNode
  ):
    | { valeur: number; interne: number; exact: Rationnel | null }
    | { message: string; position: number } {
    const derivee = premiereDerivee(tree)
    const incalculable = derivee && {
      message: MESSAGES.deriveeIncalculable(texteAppel(lignes[i].texte, derivee.pos ?? 0)),
      position: derivee.pos ?? 0,
    }
    if (incalculable && !deriveesContinues(tree)) return incalculable
    const echelle = { max: 0, depasse: false }
    let echec: { message: string; position: number }
    try {
      const c = calculer(corps, valeurs, exacts, echelle)
      const valeur = valeurAffichee(c, echelle)
      if (typeof valeur === 'number') {
        return { valeur, interne: c.r ? valeurDe(c.r) : c.v, exact: c.r }
      }
      echec = { message: valeur.message, position: 0 }
    } catch (e) {
      if (!(e instanceof ErreurCalcul)) throw e
      echec = { message: e.message, position: e.position }
    }
    if (!incalculable) return echec
    const g = compilerX(resolu(decalerDerivees(tree)), valeurs)
    const limite = limiteBilaterale(g)
    if (limite !== null) return { valeur: limite, interne: limite, exact: null }
    return incalculable
  }

  /** Whether, for every f⁽ⁿ⁾(u) of the tree, f⁽ⁿ⁻¹⁾ is defined and continuous at u. */
  function deriveesContinues(tree: ExpressionNode): boolean {
    return derivees(tree).every((d) => {
      const a = compilerX(resolu(d.arg), valeurs)(0)
      const primitive: ExpressionNode = {
        type: 'userCall',
        name: d.name,
        order: d.order - 1,
        arg: { type: 'variable', name: 'x' },
      }
      return Number.isFinite(a) && continueEn(compilerX(resolu(primitive), valeurs), a)
    })
  }

  /**
   * Why an equality draws nothing: it has neither x nor y (2 = 3), or it holds everywhere
   * (y = y, 2 = 2, (x + 1)² = x² + 2x + 1). Null when it draws a curve.
   */
  function egaliteSansCourbe(corps: ExpressionNode): string | null {
    if (corps.type !== 'binary') return null
    const gauche = compilerXY(corps.left, valeurs)
    const droite = compilerXY(corps.right, valeurs)
    const termes = [...termesDe(corps.left), ...termesDe(corps.right)].map((t) =>
      compilerXY(t, valeurs)
    )
    let essais = 0
    let horsDomaine = false
    for (const [x, y] of POINTS_ESSAI) {
      const l = gauche(x, y)
      const r = droite(x, y)
      if (!Number.isFinite(l) || !Number.isFinite(r)) {
        horsDomaine = true
        continue
      }
      // Strict: only a rounding residue of the largest term is equal (x² = x² + 10⁻¹⁰ is not).
      const grandeur = termes.reduce(
        (m, t) => Math.max(m, Math.abs(t(x, y)) || 0),
        Math.max(Math.abs(l), Math.abs(r))
      )
      if (Math.abs(l - r) > 1e-12 + 1e-12 * grandeur) {
        return dependDeXY(corps) ? null : MESSAGES.rienATracer
      }
      essais++
    }
    if (essais >= 3) return horsDomaine ? MESSAGES.vraieOuDefinie : MESSAGES.toujoursVraie
    return dependDeXY(corps) ? null : MESSAGES.rienATracer
  }
}

/** The terms of a sum or difference, signs dropped: (x + 1)² − 2x is [(x + 1)², 2x]. */
function termesDe(tree: ExpressionNode, into: ExpressionNode[] = []): ExpressionNode[] {
  if (tree.type === 'binary' && (tree.op === '+' || tree.op === '-')) {
    termesDe(tree.left, into)
    termesDe(tree.right, into)
  } else if (tree.type === 'negate') {
    termesDe(tree.operand, into)
  } else {
    into.push(tree)
  }
  return into
}

function dependDeXY(tree: ExpressionNode): boolean {
  const vars = variablesDe(tree)
  return vars.has('x') || vars.has('y')
}

function latexSiPresent(latex: string | undefined): { latex?: string } {
  return latex === undefined ? {} : { latex }
}
