// Symbolic derivative of an expression tree (ADR 0049), for f'(x), f''(x) and the tangent
// y = f'(2)(x − 2) + f(2). The rules of a lycée textbook, applied to the tree, then a light
// simplification (0 and 1 neutral, numbers folded) so that the tree stays small.
//
// The derivative is evaluated, never shown: the simplification does not try to make it pretty.

import {
  applyBuiltin,
  isTrigonometric,
  type ExpressionFunction,
  type ExpressionNode,
} from '../expression'

const ZERO: ExpressionNode = { type: 'number', value: 0 }
const ONE: ExpressionNode = { type: 'number', value: 1 }

function num(value: number): ExpressionNode {
  return { type: 'number', value }
}

function isNumber(node: ExpressionNode, value?: number): boolean {
  return node.type === 'number' && (value === undefined || node.value === value)
}

function numberOf(node: ExpressionNode): number {
  return node.type === 'number' ? node.value : NaN
}

/** u + v, simplified. */
export function plus(u: ExpressionNode, v: ExpressionNode): ExpressionNode {
  if (isNumber(u) && isNumber(v)) return fold(numberOf(u) + numberOf(v), u, v, '+')
  if (isNumber(u, 0)) return v
  if (isNumber(v, 0)) return u
  if (v.type === 'negate') return minus(u, v.operand)
  return { type: 'binary', op: '+', left: u, right: v }
}

/** u − v, simplified. */
export function minus(u: ExpressionNode, v: ExpressionNode): ExpressionNode {
  if (isNumber(u) && isNumber(v)) return fold(numberOf(u) - numberOf(v), u, v, '-')
  if (isNumber(v, 0)) return u
  if (isNumber(u, 0)) return negate(v)
  if (v.type === 'negate') return plus(u, v.operand)
  return { type: 'binary', op: '-', left: u, right: v }
}

/** u × v, simplified. */
export function times(u: ExpressionNode, v: ExpressionNode): ExpressionNode {
  if (isNumber(u) && isNumber(v)) return fold(numberOf(u) * numberOf(v), u, v, '*')
  if (isNumber(u, 0) || isNumber(v, 0)) return ZERO
  if (isNumber(u, 1)) return v
  if (isNumber(v, 1)) return u
  if (isNumber(u, -1)) return negate(v)
  if (isNumber(v, -1)) return negate(u)
  // A number goes in front, and two numbers meet: 2·(3·x) = 6x, x·2 = 2x.
  if (isNumber(v)) return times(v, u)
  if (isNumber(u) && v.type === 'binary' && v.op === '*' && isNumber(v.left)) {
    return times(num(numberOf(u) * numberOf(v.left)), v.right)
  }
  if (u.type === 'negate') return negate(times(u.operand, v))
  if (v.type === 'negate') return negate(times(u, v.operand))
  return { type: 'binary', op: '*', left: u, right: v }
}

/** u ÷ v, simplified. */
export function over(u: ExpressionNode, v: ExpressionNode): ExpressionNode {
  if (isNumber(u) && isNumber(v)) return fold(numberOf(u) / numberOf(v), u, v, '/')
  if (isNumber(v, 1)) return u
  return { type: 'binary', op: '/', left: u, right: v }
}

/** u ^ v, simplified. */
export function power(u: ExpressionNode, v: ExpressionNode): ExpressionNode {
  if (isNumber(u) && isNumber(v)) return fold(Math.pow(numberOf(u), numberOf(v)), u, v, '^')
  if (isNumber(v, 1)) return u
  if (isNumber(v, 0)) return ONE
  return { type: 'binary', op: '^', left: u, right: v }
}

/** −u, simplified. */
export function negate(u: ExpressionNode): ExpressionNode {
  if (u.type === 'number') return num(-u.value)
  if (u.type === 'negate') return u.operand
  return { type: 'negate', operand: u }
}

function call(fn: ExpressionFunction, arg: ExpressionNode, degrees?: true): ExpressionNode {
  // Folded only to a whole number (√4, cos(0)): √2 stays √2, for the same reason as `fold`.
  if (arg.type === 'number') {
    const v = applyBuiltin(fn, arg.value, degrees)
    if (Number.isInteger(v)) return num(v)
  }
  // ln(e) = 1: the derivative of e^v (taken as a general power) needs it.
  if (fn === 'ln' && arg.type === 'constant' && arg.name === 'e') return ONE
  const node: ExpressionNode = { type: 'call', fn, arg }
  if (degrees) node.degrees = true
  return node
}

/**
 * A folded number, unless the operation is not defined (1/0 stays 1/0, and reads NaN). A quotient
 * or a power is folded only when it is a whole number: 1/3 folded would be 0,333…, and the exact
 * fractions of a calculation line (rationnel.ts) would read that rounded value.
 */
function fold(
  value: number,
  u: ExpressionNode,
  v: ExpressionNode,
  op: '+' | '-' | '*' | '/' | '^'
): ExpressionNode {
  const exact = op === '/' || op === '^' ? Number.isInteger(value) : Number.isFinite(value)
  return exact ? num(value) : { type: 'binary', op, left: u, right: v }
}

/** Whether the tree depends on the variable (user calls are followed through their argument). */
export function dependsOn(tree: ExpressionNode, variable: string): boolean {
  switch (tree.type) {
    case 'number':
    case 'constant':
      return false
    case 'variable':
      return tree.name === variable
    case 'negate':
      return dependsOn(tree.operand, variable)
    case 'call':
    case 'userCall':
      return dependsOn(tree.arg, variable)
    case 'binary':
      return dependsOn(tree.left, variable) || dependsOn(tree.right, variable)
  }
}

/** The tree rebuilt bottom-up through the simplifying constructors. */
export function simplifier(tree: ExpressionNode): ExpressionNode {
  switch (tree.type) {
    case 'number':
    case 'variable':
    case 'constant':
      return tree
    case 'negate':
      return negate(simplifier(tree.operand))
    case 'call':
      return call(tree.fn, simplifier(tree.arg), tree.degrees)
    case 'userCall':
      return { type: 'userCall', name: tree.name, order: tree.order, arg: simplifier(tree.arg) }
    case 'binary': {
      const l = simplifier(tree.left)
      const r = simplifier(tree.right)
      switch (tree.op) {
        case '+':
          return plus(l, r)
        case '-':
          return minus(l, r)
        case '*':
          return times(l, r)
        case '/':
          return over(l, r)
        case '^':
          return power(l, r)
      }
    }
  }
}

/** d/dv of f(u) for a built-in f, before the chain rule's factor u'. */
function outerDerivative(
  fn: ExpressionFunction,
  u: ExpressionNode,
  degrees?: true
): ExpressionNode {
  // In degrees sin°(u) = sin(u·π/180): every trigonometric derivative takes the factor π/180.
  const k: ExpressionNode =
    degrees && isTrigonometric(fn)
      ? { type: 'binary', op: '/', left: { type: 'constant', name: 'π' }, right: num(180) }
      : ONE
  switch (fn) {
    case 'sqrt':
      return over(ONE, times(num(2), call('sqrt', u)))
    // |u|' = u/|u|: not defined at 0, where |u| has no tangent.
    case 'abs':
      return over(u, call('abs', u))
    case 'sin':
      return times(k, call('cos', u, degrees))
    case 'cos':
      return times(k, negate(call('sin', u, degrees)))
    case 'tan':
      return over(k, power(call('cos', u, degrees), num(2)))
    case 'exp':
      return call('exp', u)
    case 'ln':
      return over(ONE, u)
    case 'log':
      return over(ONE, times(u, call('ln', num(10))))
  }
}

/** Thrown when a derivative would take more steps than its budget allows. */
export class DeriveeTropLongue extends Error {
  constructor() {
    super('dérivée trop longue')
  }
}

/** The number of steps a derivative may take: one per node of the tree it derives. */
export type BudgetDerivee = { reste: number }

// The tree is simplified once by `deriver`; every node built here goes through the simplifying
// constructors, so no sub-tree is simplified again (which made long trees quadratic).
function derive(tree: ExpressionNode, v: string, budget: BudgetDerivee): ExpressionNode {
  if (--budget.reste < 0) throw new DeriveeTropLongue()
  switch (tree.type) {
    case 'number':
    case 'constant':
      return ZERO
    case 'variable':
      return tree.name === v ? ONE : ZERO
    case 'negate':
      return negate(derive(tree.operand, v, budget))
    case 'call': {
      const u = tree.arg
      return times(outerDerivative(tree.fn, u, tree.degrees), derive(u, v, budget))
    }
    // (f⁽ⁿ⁾∘u)' = f⁽ⁿ⁺¹⁾(u)·u': whoever knows f evaluates the higher derivative.
    case 'userCall': {
      const u = tree.arg
      return times(
        { type: 'userCall', name: tree.name, order: tree.order + 1, arg: u },
        derive(u, v, budget)
      )
    }
    case 'binary': {
      const l = tree.left
      const r = tree.right
      switch (tree.op) {
        case '+':
          return plus(derive(l, v, budget), derive(r, v, budget))
        case '-':
          return minus(derive(l, v, budget), derive(r, v, budget))
        case '*':
          return plus(times(derive(l, v, budget), r), times(l, derive(r, v, budget)))
        case '/':
          return over(
            minus(times(derive(l, v, budget), r), times(l, derive(r, v, budget))),
            power(r, num(2))
          )
        case '^':
          return derivePower(l, r, v, budget)
      }
    }
  }
}

function derivePower(
  u: ExpressionNode,
  w: ExpressionNode,
  v: string,
  budget: BudgetDerivee
): ExpressionNode {
  const baseVaries = dependsOn(u, v)
  const exponentVaries = dependsOn(w, v)
  if (!exponentVaries) {
    // (u^n)' = n·u^(n−1)·u'
    return times(times(w, power(u, minus(w, ONE))), derive(u, v, budget))
  }
  if (!baseVaries) {
    // (a^w)' = a^w·ln(a)·w', with ln(e) = 1
    const lnA = u.type === 'constant' && u.name === 'e' ? ONE : call('ln', u)
    return times(times(power(u, w), lnA), derive(w, v, budget))
  }
  // u^w = e^(w·ln u): (u^w)' = u^w·(w'·ln u + w·u'/u)
  return times(
    power(u, w),
    plus(times(derive(w, v, budget), call('ln', u)), over(times(w, derive(u, v, budget)), u))
  )
}

/**
 * The derivative of the tree with respect to `variable` (x by default), simplified. Other letters
 * are constants. A call f⁽ⁿ⁾(u) to a function the student defined becomes f⁽ⁿ⁺¹⁾(u)·u'.
 * `budget` bounds the work (one step per node derived, shared sub-trees counted each time they
 * are met): past it, DeriveeTropLongue is thrown. Default: unbounded.
 */
export function deriver(
  tree: ExpressionNode,
  variable: string = 'x',
  budget: BudgetDerivee = { reste: Infinity }
): ExpressionNode {
  return derive(simplifier(tree), variable, budget)
}
