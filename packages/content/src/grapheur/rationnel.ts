// Exact fractions for the graphing calculator (ADR 0049): a calculation line that only adds,
// subtracts, multiplies, divides, raises to a whole power or takes the square root of a perfect
// square is worked out in BigInt fractions, so 2/3 + 1/6 is 5/6 and not 0,8333….
//
// Every operation returns null when its result would be too large to be worth showing as a
// fraction: the caller then falls back to the decimal value.

/** A fraction in lowest terms, with a positive denominator. */
export type Rationnel = { num: bigint; den: bigint }

/** Beyond this many bits in a numerator or denominator, the fraction is not shown. */
export const BITS_MAX = 2048

/** The largest |exponent| of a power computed exactly. */
export const EXPOSANT_MAX = 64

function abs(n: bigint): bigint {
  return n < 0n ? -n : n
}

function pgcd(a: bigint, b: bigint): bigint {
  let x = abs(a)
  let y = abs(b)
  while (y !== 0n) {
    const r = x % y
    x = y
    y = r
  }
  return x
}

function bits(n: bigint): number {
  return abs(n).toString(2).length
}

/** The fraction num/den in lowest terms; null if den is 0 or the fraction is too large. */
export function rationnel(num: bigint, den: bigint = 1n): Rationnel | null {
  if (den === 0n) return null
  const sign = den < 0n ? -1n : 1n
  const g = pgcd(num, den)
  // g is 0 only when num is 0 too, and den is not.
  const d = g === 0n ? 1n : g
  const r = { num: (sign * num) / d, den: (sign * den) / d }
  return bits(r.num) > BITS_MAX || bits(r.den) > BITS_MAX ? null : r
}

export function estNul(r: Rationnel): boolean {
  return r.num === 0n
}

export function ajouter(a: Rationnel, b: Rationnel): Rationnel | null {
  return rationnel(a.num * b.den + b.num * a.den, a.den * b.den)
}

export function soustraire(a: Rationnel, b: Rationnel): Rationnel | null {
  return rationnel(a.num * b.den - b.num * a.den, a.den * b.den)
}

export function multiplier(a: Rationnel, b: Rationnel): Rationnel | null {
  return rationnel(a.num * b.num, a.den * b.den)
}

/** a ÷ b; null when b is 0 (the caller reports the division by zero). */
export function diviser(a: Rationnel, b: Rationnel): Rationnel | null {
  return rationnel(a.num * b.den, a.den * b.num)
}

export function opposer(a: Rationnel): Rationnel {
  return { num: -a.num, den: a.den }
}

export function valeurAbsolue(a: Rationnel): Rationnel {
  return { num: abs(a.num), den: a.den }
}

/**
 * a to the power e, for a whole e with |e| ≤ EXPOSANT_MAX; null otherwise, or when the result is
 * too large, or when a is 0 and e negative (the caller reports the division by zero).
 */
export function puissance(a: Rationnel, e: Rationnel): Rationnel | null {
  if (e.den !== 1n || abs(e.num) > BigInt(EXPOSANT_MAX)) return null
  const n = Number(abs(e.num))
  // Checked before computing: 2^64 of a 2048-bit number would take a while for nothing.
  if (Math.max(bits(a.num), bits(a.den)) * n > BITS_MAX) return null
  const num = a.num ** BigInt(n)
  const den = a.den ** BigInt(n)
  return e.num < 0n ? rationnel(den, num) : rationnel(num, den)
}

function racineEntiere(n: bigint): bigint {
  if (n < 2n) return n
  // Newton's method from a power of two above the root.
  let x = 1n << BigInt(Math.ceil(bits(n) / 2))
  for (;;) {
    const y = (x + n / x) >> 1n
    if (y >= x) return x
    x = y
  }
}

/** √a when a is the square of a fraction (√(4/9) = 2/3); null otherwise. */
export function racine(a: Rationnel): Rationnel | null {
  if (a.num < 0n) return null
  const n = racineEntiere(a.num)
  const d = racineEntiere(a.den)
  return n * n === a.num && d * d === a.den ? { num: n, den: d } : null
}

/**
 * The fraction a decimal text stands for: "1,5" → 3/2, "-0.25" → −1/4, "2e-3" → 1/500. Accepts
 * a comma or a point, a sign (− included) and an exponent; null if the text is not a number.
 */
export function rationnelDepuisDecimal(texte: string): Rationnel | null {
  const m = /^\s*([+\-−–]?)\s*(\d*)(?:[.,](\d*))?(?:[eE]([+-]?\d+))?\s*$/.exec(texte)
  if (!m) return null
  const [, signe, entier, decimales = '', exposant] = m
  if (entier === '' && decimales === '') return null
  const e = exposant === undefined ? 0 : Number(exposant)
  if (Math.abs(e) > 400) return null
  let num = BigInt(entier + decimales || '0')
  let den = 10n ** BigInt(decimales.length)
  if (e > 0) num *= 10n ** BigInt(e)
  else den *= 10n ** BigInt(-e)
  if (signe !== '' && signe !== '+') num = -num
  return rationnel(num, den)
}

/**
 * The fraction a number stands for, read from its first 15 significant digits: a value typed as
 * 0,1 (stored as 0,1000000000000000055…) is 1/10, and a slider value 0,30000000000000004 is 3/10.
 */
export function rationnelDepuisNombre(v: number): Rationnel | null {
  if (!Number.isFinite(v)) return null
  return rationnelDepuisDecimal(v.toPrecision(15))
}

/** The decimal value of a fraction, as close as a double allows. */
export function valeurDe(r: Rationnel): number {
  const direct = Number(r.num) / Number(r.den)
  if (Number.isFinite(direct)) return direct
  // Both terms beyond the range of a double: drop the same number of bits from each.
  const shift = BigInt(Math.max(bits(r.num), bits(r.den)) - 1000)
  return Number(r.num >> shift) / Number(r.den >> shift)
}

/** "5/6", "−5/6" (minus sign U+2212), "3". */
export function formaterRationnel(r: Rationnel): string {
  const signe = r.num < 0n ? '−' : ''
  const num = abs(r.num).toString()
  return r.den === 1n ? signe + num : `${signe}${num}/${r.den.toString()}`
}

/** "\frac{5}{6}", "-\frac{5}{6}", "3", for KaTeX. */
export function latexRationnel(r: Rationnel): string {
  const signe = r.num < 0n ? '-' : ''
  const num = abs(r.num).toString()
  return r.den === 1n ? signe + num : `${signe}\\frac{${num}}{${r.den.toString()}}`
}
