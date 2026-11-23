// An expression tree written in LaTeX for KaTeX (ADR 0049): the preview under a calculator line.
// 1/2x is \frac{1}{2}x, (x+1)/(x−1) is \frac{x+1}{x-1} (the fraction bar replaces the
// brackets), implicit products stay implicit except between two numbers (2\times 3), and the
// brackets kept are the ones the reading needs. Decimals take the French comma: 2{,}5.

import type { ExpressionFunction, ExpressionNode } from '../expression'

/** How tightly a written node holds together: a looser child gets brackets. */
const SUM = 1
const PRODUCT = 2
const SIGNED = 3
const POWER = 4
const ATOM = 5

const FUNCTION_LATEX: Readonly<Record<Exclude<ExpressionFunction, 'sqrt' | 'abs'>, string>> = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  exp: '\\exp',
  ln: '\\ln',
  log: '\\log',
}

function level(node: ExpressionNode): number {
  switch (node.type) {
    case 'number':
      return node.value < 0 ? SIGNED : ATOM
    case 'variable':
    case 'constant':
    case 'call':
    case 'userCall':
      return ATOM
    case 'negate':
      return SIGNED
    case 'binary':
      switch (node.op) {
        case '+':
        case '-':
          return SUM
        case '*':
          return PRODUCT
        // A fraction is a block of its own, except as the base of a power.
        case '/':
          return ATOM
        case '^':
          return POWER
      }
  }
}

/** A sum or a signed term, which needs brackets after a sign or as a factor on the right. */
function loose(node: ExpressionNode): boolean {
  const l = level(node)
  return l === SUM || l === SIGNED
}

function brackets(tex: string): string {
  return `\\left(${tex}\\right)`
}

/** Groups the digits of a long whole number by three, with a thin space: 12\,345. */
function groupDigits(digits: string): string {
  if (digits.length < 5) return digits
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,')
}

/** A number as typed (`2,5`, `12345678901234567`): its digits, French comma, grouped. */
function latexTyped(text: string): string {
  const [whole, decimals] = text.split(/[.,]/)
  return groupDigits(whole === '' ? '0' : whole) + (decimals === undefined ? '' : `{,}${decimals}`)
}

export function latexNumber(value: number): string {
  if (Number.isNaN(value)) return '\\text{?}'
  if (!Number.isFinite(value)) return value > 0 ? '\\infty' : '-\\infty'
  const sign = value < 0 ? '-' : ''
  const text = String(Math.abs(value))
  const [mantissa, exponent] = text.split('e')
  const [whole, decimals] = mantissa.split('.')
  const body = groupDigits(whole) + (decimals === undefined ? '' : `{,}${decimals}`)
  return exponent === undefined
    ? sign + body
    : `${sign}${body}\\times 10^{${Number(exponent).toString()}}`
}

/** f → f, f1 → f_{1}. */
export function latexName(name: string): string {
  return name.length > 1 ? `${name[0]}_{${name.slice(1)}}` : name
}

function primes(order: number): string {
  return order <= 3 ? "'".repeat(order) : `^{(${order.toString()})}`
}

/** a·b written side by side, or with × when b starts with a figure (2\times 3) or a fraction. */
function joinProduct(left: string, right: string): string {
  if (/^(\d|\\frac|-)/.test(right)) return `${left}\\times ${right}`
  // \pi x, not \pix (which KaTeX reads as an unknown command).
  if (/\\[a-zA-Z]+$/.test(left) && /^[a-zA-Z]/.test(right)) return `${left} ${right}`
  return left + right
}

function render(node: ExpressionNode): string {
  switch (node.type) {
    case 'number':
      return node.text !== undefined ? latexTyped(node.text) : latexNumber(node.value)
    case 'variable':
      return latexName(node.name)
    case 'constant':
      return node.name === 'π' ? '\\pi' : 'e'
    case 'negate': {
      const operand = render(node.operand)
      return loose(node.operand) ? `-${brackets(operand)}` : `-${operand}`
    }
    case 'call': {
      const arg = render(node.arg)
      if (node.fn === 'sqrt') return `\\sqrt{${arg}}`
      if (node.fn === 'abs') return `\\left|${arg}\\right|`
      return `${FUNCTION_LATEX[node.fn]}${brackets(arg)}`
    }
    case 'userCall':
      return `${latexName(node.name)}${primes(node.order)}(${render(node.arg)})`
    case 'binary': {
      const { left, right } = node
      switch (node.op) {
        case '+':
          return `${render(left)}+${loose(right) ? brackets(render(right)) : render(right)}`
        case '-':
          return `${render(left)}-${loose(right) ? brackets(render(right)) : render(right)}`
        case '*': {
          const l = level(left) === SUM ? brackets(render(left)) : render(left)
          return joinProduct(l, loose(right) ? brackets(render(right)) : render(right))
        }
        case '/':
          return `\\frac{${render(left)}}{${render(right)}}`
        case '^': {
          const base =
            level(left) < ATOM ||
            left.type === 'binary' ||
            // √x² would read √(x²): (√x)² keeps its brackets. |x|² is unambiguous.
            (left.type === 'call' && left.fn !== 'abs')
              ? brackets(render(left))
              : render(left)
          return `${base}^{${render(right)}}`
        }
      }
    }
  }
}

/** The tree in LaTeX, for KaTeX. */
export function latexOf(tree: ExpressionNode): string {
  return render(tree)
}
