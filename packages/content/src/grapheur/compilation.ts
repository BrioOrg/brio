// A resolved expression tree compiled into closures of (x, y), for the graphing calculator
// (ADR 0049). They are called hundreds of thousands of times a frame (curve sampling, implicit
// curves), so the tree is walked once, here: every sub-tree without x or y is folded into a
// number, and the common shapes (an operation with a number, a square) get their own closure.
//
// The tree is resolved: no user call is left (the language inlines them), and every letter other
// than x and y is a constant whose value is given.

import { applyBuiltin, mathOf, type ExpressionNode } from '../expression'

export type FonctionXY = (x: number, y: number) => number

type Compiled = { run: FonctionXY; k: number | null }

function constant(k: number): Compiled {
  return { run: () => k, k }
}

function compile(node: ExpressionNode, constants: ReadonlyMap<string, number>): Compiled {
  switch (node.type) {
    case 'number':
      return constant(node.value)
    case 'constant':
      return constant(node.name === 'π' ? Math.PI : Math.E)
    case 'variable':
      if (node.name === 'x') return { run: (x) => x, k: null }
      if (node.name === 'y') return { run: (_x, y) => y, k: null }
      return constant(constants.get(node.name) ?? NaN)
    // Not resolved: the language never hands one over, and it would not be defined.
    case 'userCall':
      return constant(NaN)
    case 'negate': {
      const a = compile(node.operand, constants)
      if (a.k !== null) return constant(-a.k)
      const run = a.run
      return { run: (x, y) => -run(x, y), k: null }
    }
    case 'call': {
      const a = compile(node.arg, constants)
      const fn = node.fn
      const degrees = node.degrees === true
      if (a.k !== null) return constant(applyBuiltin(fn, a.k, degrees))
      const run = a.run
      if (degrees) return { run: (x, y) => applyBuiltin(fn, run(x, y), true), k: null }
      const math = mathOf(fn)
      return { run: (x, y) => math(run(x, y)), k: null }
    }
    case 'binary':
      return compileBinary(node.op, compile(node.left, constants), compile(node.right, constants))
  }
}

function apply(op: '+' | '-' | '*' | '/' | '^', a: number, b: number): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '*':
      return a * b
    case '/':
      return a / b
    case '^':
      return Math.pow(a, b)
  }
}

function compileBinary(op: '+' | '-' | '*' | '/' | '^', l: Compiled, r: Compiled): Compiled {
  if (l.k !== null && r.k !== null) return constant(apply(op, l.k, r.k))
  const L = l.run
  const R = r.run
  if (r.k !== null) {
    const b = r.k
    switch (op) {
      case '+':
        return { run: (x, y) => L(x, y) + b, k: null }
      case '-':
        return { run: (x, y) => L(x, y) - b, k: null }
      case '*':
        return { run: (x, y) => L(x, y) * b, k: null }
      case '/':
        return { run: (x, y) => L(x, y) / b, k: null }
      case '^':
        if (b === 2) {
          return {
            run: (x, y) => {
              const v = L(x, y)
              return v * v
            },
            k: null,
          }
        }
        return { run: (x, y) => Math.pow(L(x, y), b), k: null }
    }
  }
  if (l.k !== null) {
    const a = l.k
    switch (op) {
      case '+':
        return { run: (x, y) => a + R(x, y), k: null }
      case '-':
        return { run: (x, y) => a - R(x, y), k: null }
      case '*':
        return { run: (x, y) => a * R(x, y), k: null }
      case '/':
        return { run: (x, y) => a / R(x, y), k: null }
      case '^':
        return { run: (x, y) => Math.pow(a, R(x, y)), k: null }
    }
  }
  switch (op) {
    case '+':
      return { run: (x, y) => L(x, y) + R(x, y), k: null }
    case '-':
      return { run: (x, y) => L(x, y) - R(x, y), k: null }
    case '*':
      return { run: (x, y) => L(x, y) * R(x, y), k: null }
    case '/':
      return { run: (x, y) => L(x, y) / R(x, y), k: null }
    case '^':
      return { run: (x, y) => Math.pow(L(x, y), R(x, y)), k: null }
  }
}

/**
 * The tree as a function of (x, y); NaN where it is not defined, Infinity included (1/0 is not a
 * point of a curve). `constants` gives the value of every other letter.
 */
export function compilerXY(
  tree: ExpressionNode,
  constants: ReadonlyMap<string, number> = new Map()
): FonctionXY {
  const { run, k } = compile(tree, constants)
  if (k !== null) {
    const v = Number.isFinite(k) ? k : NaN
    return () => v
  }
  return (x, y) => {
    const v = run(x, y)
    // v − v is 0 for a finite v, NaN for ±Infinity and NaN.
    return v - v === 0 ? v : NaN
  }
}

/** The tree as a function of x alone (y, if any, reads 0). */
export function compilerX(
  tree: ExpressionNode,
  constants: ReadonlyMap<string, number> = new Map()
): (x: number) => number {
  const { run, k } = compile(tree, constants)
  if (k !== null) {
    const v = Number.isFinite(k) ? k : NaN
    return () => v
  }
  return (x) => {
    const v = run(x, 0)
    return v - v === 0 ? v : NaN
  }
}
