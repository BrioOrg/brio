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

import { DEGREE, mathOf, parseExpression, type ExpressionNode } from '../expression'
import { compilerX, compilerXY } from './compilation'
import { deriver } from './derivee'
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

export type ModeAngle = 'radians' | 'degres'

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
    }
  | { id: string; latex: string; genre: 'calcul'; valeur: number; exact: Rationnel | null }

export type OptionsAnalyse = {
  angle?: ModeAngle
  /** The values of the slider constants, by name; they replace the value typed in the line. */
  valeurs?: Readonly<Record<string, number>>
}

const NBSP = ' '

/** Beyond this many nodes once calls are inlined, a line is refused rather than compiled. */
export const NOEUDS_MAX = 50_000

export const MESSAGES = {
  lettreInconnue: (a: string) => `La lettre ${a} n’est pas définie.`,
  dejaDefinie: (a: string, ligne: number) =>
    `La lettre ${a} est déjà définie à la ligne ${ligne}. Choisis une autre lettre ou supprime l’une des deux lignes.`,
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
    `La variable d’une fonction s’écrit x${NBSP}: écris ${f}(x) = ….`,
  fonctionAvecY: (f: string) => `${f}(x) ne peut dépendre que de x, pas de y.`,
  constanteAvecXY: (a: string) =>
    `${a} est une constante${NBSP}: sa valeur ne peut dépendre ni de x ni de y. Pour tracer une courbe, écris y = ….`,
  yHorsEquation: `Une expression avec y se trace comme une équation${NBSP}: écris par exemple x² + y² = 4.`,
  rienATracer: `Cette égalité ne contient ni x ni y${NBSP}: il n’y a rien à tracer.`,
  nombreDejaConnu: (c: string) =>
    `${c} est déjà un nombre${NBSP}: choisis une lettre, par exemple a = 2.`,
  definitionEnErreur: (nom: string, ligne: number) =>
    `${nom} n’est pas utilisable${NBSP}: sa définition, ligne ${ligne}, contient une erreur.`,
  calculSansValeur: 'Ce calcul n’a pas de valeur réelle.',
  constanteSansValeur: (a: string) => `La valeur de ${a} n’est pas définie.`,
  tropLongue: 'Cette expression devient trop longue à calculer.',
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
const TETE_CONSTANTE = /^(\s*)([a-zA-Z])\s*$/
const INEQUATION = /[<>≤≥⩽⩾≠]/
const LITTERAL = /^\s*[+\-−–]?\s*(\d+([.,]\d+)?|[.,]\d+)\s*$/

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
  const c = TETE_CONSTANTE.exec(gauche)
  const tete: Tete | null =
    c && c[2] !== 'x' && c[2] !== 'y'
      ? { type: 'constante', nom: c[2], position: c[1].length }
      : null
  return { type: 'egalite', egal, gauche, droite, tete }
}

/** The error a head carries by itself (a reserved name, a variable other than x); null if none. */
function erreurDeTete(tete: Tete): ErreurLigne | null {
  if (tete.nom === 'x' || tete.nom === 'y') {
    return { message: MESSAGES.nomVariable, position: tete.position }
  }
  if (tete.nom === 'e') {
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
  return into.sort((a, b) => a.position - b.position)
}

function lire(
  source: string,
  fonctions: readonly string[],
  angle: 'radians' | 'degrees'
): { ok: true; tree: ExpressionNode } | { ok: false; erreur: ErreurLigne } {
  const r = parseExpression(source, { calculator: { functions: fonctions, angle } })
  return r.ok ? { ok: true, tree: r.expression.tree } : { ok: false, erreur: r.error }
}

function sens(
  texte: string,
  f: Forme,
  fonctions: readonly string[],
  angle: 'radians' | 'degrees'
): Sens {
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
  const varsG = variablesDe(g)
  const varsD = variablesDe(droite.tree)
  if (g.type === 'variable' && g.name === 'y' && !varsD.has('y')) {
    return { genre: 'explicite', corps: droite.tree, latex }
  }
  if (!varsG.has('x') && !varsG.has('y') && !varsD.has('x') && !varsD.has('y')) {
    return { genre: 'erreur', erreur: { message: MESSAGES.rienATracer, position: f.egal }, latex }
  }
  // F(x, y) = left − right: the curve is where F is 0.
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

class DivisionParZero extends Error {
  readonly position: number
  constructor(position: number) {
    super('division par zéro')
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
    case 'number':
      return at({ type: 'number', value: tree.value })
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

function taille(tree: ExpressionNode): number {
  switch (tree.type) {
    case 'number':
    case 'variable':
    case 'constant':
      return 1
    case 'negate':
      return 1 + taille(tree.operand)
    case 'call':
    case 'userCall':
      return 1 + taille(tree.arg)
    case 'binary':
      return 1 + taille(tree.left) + taille(tree.right)
  }
}

type Valeur = { v: number; r: Rationnel | null }

/** A calculation worked out once, in doubles and, where it can be, in exact fractions. */
function calculer(
  tree: ExpressionNode,
  valeurs: ReadonlyMap<string, number>,
  exacts: ReadonlyMap<string, Rationnel | null>
): Valeur {
  switch (tree.type) {
    case 'number':
      return { v: tree.value, r: rationnelDepuisNombre(tree.value) }
    case 'constant':
      return { v: tree.name === 'π' ? Math.PI : Math.E, r: null }
    case 'variable':
      return { v: valeurs.get(tree.name) ?? NaN, r: exacts.get(tree.name) ?? null }
    case 'userCall':
      return { v: NaN, r: null }
    case 'negate': {
      const a = calculer(tree.operand, valeurs, exacts)
      return { v: -a.v, r: a.r && opposer(a.r) }
    }
    case 'call': {
      const a = calculer(tree.arg, valeurs, exacts)
      const v = mathOf(tree.fn)(tree.degrees ? a.v * DEGREE : a.v)
      const r =
        a.r && (tree.fn === 'sqrt' ? racine(a.r) : tree.fn === 'abs' ? valeurAbsolue(a.r) : null)
      return { v, r }
    }
    case 'binary': {
      const a = calculer(tree.left, valeurs, exacts)
      const b = calculer(tree.right, valeurs, exacts)
      const ra = a.r
      const rb = b.r
      switch (tree.op) {
        case '+':
          return { v: a.v + b.v, r: ra && rb && ajouter(ra, rb) }
        case '-':
          return { v: a.v - b.v, r: ra && rb && soustraire(ra, rb) }
        case '*':
          return { v: a.v * b.v, r: ra && rb && multiplier(ra, rb) }
        case '/': {
          if (b.r ? estNul(b.r) : b.v === 0) throw new DivisionParZero(tree.pos ?? 0)
          return { v: a.v / b.v, r: ra && rb && diviser(ra, rb) }
        }
        case '^': {
          if ((a.r ? estNul(a.r) : a.v === 0) && b.v < 0) throw new DivisionParZero(tree.pos ?? 0)
          return { v: Math.pow(a.v, b.v), r: ra && rb && puissance(ra, rb) }
        }
      }
    }
  }
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

/**
 * Reads the lines together: same order and same ids as the input. Never throws; a line that
 * cannot be drawn or computed comes back as an `erreur`, and the others are still read.
 */
export function analyserLignes(
  lignes: readonly LigneSaisie[],
  options: OptionsAnalyse = {}
): LigneAnalysee[] {
  const angle = options.angle === 'degres' ? 'degrees' : 'radians'
  const formes = lignes.map((l) => forme(l.texte))

  // 1. Who defines which letter: the first line wins, from its text alone.
  const proprietaire = new Map<string, number>()
  const fonctions: string[] = []
  formes.forEach((f, i) => {
    if (f.type !== 'egalite' || !f.tete || erreurDeTete(f.tete)) return
    if (proprietaire.has(f.tete.nom)) return
    proprietaire.set(f.tete.nom, i)
    if (f.tete.type === 'fonction') fonctions.push(f.tete.nom)
  })

  // 2. Each line parsed, knowing the function names; a second definition is refused.
  const sensDe: Sens[] = formes.map((f, i) => {
    const s = sens(lignes[i].texte, f, fonctions, angle)
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
      corps = deriver(corpsDe(nom, ordre - 1, budget))
      if (taille(corps) > NOEUDS_MAX) throw new TropLongue()
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
            message: MESSAGES.circulaire(enumerer(noms)),
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
      const ligne = evaluer(i, s)
      if (ligne.genre === 'erreur') enErreur.add(i)
      resultat[i] = ligne
    }
  }
  return resultat

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
    let corps: ExpressionNode
    try {
      corps = resoudre(s.corps, { reste: NOEUDS_MAX })
    } catch (e) {
      if (e instanceof TropLongue) return erreur(MESSAGES.tropLongue, 0)
      throw e
    }
    switch (s.genre) {
      case 'fonction':
        return { id, latex: s.latex, genre: 'explicite', nom: s.nom, f: compilerX(corps, valeurs) }
      case 'explicite':
        return { id, latex: s.latex, genre: 'explicite', nom: null, f: compilerX(corps, valeurs) }
      case 'implicite':
        return { id, latex: s.latex, genre: 'implicite', F: compilerXY(corps, valeurs) }
      case 'constante': {
        const curseur = s.litteral !== null
        const impose = options.valeurs?.[s.nom]
        let valeur: number
        let exact: Rationnel | null
        if (curseur && impose !== undefined && Number.isFinite(impose)) {
          valeur = impose
          exact = rationnelDepuisNombre(impose)
        } else if (curseur) {
          exact = rationnelDepuisDecimal(s.litteral!)
          valeur = exact ? valeurDe(exact) : NaN
        } else {
          let c: Valeur
          try {
            c = calculer(corps, valeurs, exacts)
          } catch (e) {
            if (e instanceof DivisionParZero) return erreur(MESSAGES.divisionParZero, e.position)
            throw e
          }
          exact = c.r
          valeur = c.r ? valeurDe(c.r) : c.v
        }
        if (!Number.isFinite(valeur)) return erreur(MESSAGES.constanteSansValeur(s.nom), s.position)
        valeurs.set(s.nom, valeur)
        exacts.set(s.nom, exact)
        return { id, latex: s.latex, genre: 'constante', nom: s.nom, valeur, curseur }
      }
      case 'calcul': {
        let c: Valeur
        try {
          c = calculer(corps, valeurs, exacts)
        } catch (e) {
          if (e instanceof DivisionParZero) return erreur(MESSAGES.divisionParZero, e.position)
          throw e
        }
        const valeur = c.r ? valeurDe(c.r) : c.v
        if (!Number.isFinite(valeur)) return erreur(MESSAGES.calculSansValeur, 0)
        return { id, latex: s.latex, genre: 'calcul', valeur, exact: c.r }
      }
    }
  }
}

function latexSiPresent(latex: string | undefined): { latex?: string } {
  return latex === undefined ? {} : { latex }
}
