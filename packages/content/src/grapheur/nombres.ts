// Numbers as the graphing calculator writes them (ADR 0049 §3): French decimal comma, U+2212 for
// minus, a narrow no-break space between groups of three digits from five digits on (1234, but
// 12 345), never an exponent, never "−0". A value is written "=" only when what is shown is the
// value itself; anything rounded is "≈". Pure: no Intl, the same output everywhere.

import { CHIFFRES_SIGNIFICATIFS } from './langage'
import type { Rationnel } from './rationnel'

const MOINS = '−'
const FINE = ' '

/** From this many digits on, the integer part is grouped by three. */
export const GROUPER_A_PARTIR_DE = 5

/** "12345" → "12 345"; under five digits, unchanged. */
export function grouperChiffres(entier: string): string {
  if (entier.length < GROUPER_A_PARTIR_DE) return entier
  return entier.replace(/\B(?=(\d{3})+(?!\d))/g, FINE)
}

/** Sign, integer digits and decimal digits put together; trailing decimal zeros dropped. */
function ecrire(negatif: boolean, entier: string, decimales: string, grouper = true): string {
  const e = entier.replace(/^0+(?=\d)/, '') || '0'
  const d = decimales.replace(/0+$/, '')
  const t = `${grouper ? grouperChiffres(e) : e}${d ? `,${d}` : ''}`
  return negatif && t !== '0' ? MOINS + t : t
}

/**
 * The decimal digits of a finite, non-negative double, from its shortest representation (the one
 * that reads back as the same double), without an exponent: 1e-7 → ["0", "0000001"].
 */
function chiffres(a: number): [string, string] {
  const s = a.toString()
  const m = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(s)
  if (!m) return ['0', '']
  const entier = m[1]
  const fraction = m[2] ?? ''
  const exposant = Number(m[3] ?? '0')
  const tous = entier + fraction
  const virgule = entier.length + exposant
  if (virgule <= 0) return ['0', '0'.repeat(-virgule) + tous]
  if (virgule >= tous.length) return [tous + '0'.repeat(virgule - tous.length), '']
  return [tous.slice(0, virgule), tous.slice(virgule)]
}

/** Significant digits of a double's shortest representation. */
function significatifs(a: number): number {
  const [e, d] = chiffres(a)
  return (e + d).replace(/^0+/, '').replace(/0+$/, '').length
}

/** "1.25" or "125" (from toFixed / toPrecision without exponent) → [integer, decimals]. */
function couper(s: string): [string, string] {
  const [e, d = ''] = s.split('.')
  return [e, d]
}

/**
 * A double written in full: the shortest decimal that reads back as the same double, so it is
 * always exact (1e−7 is 0,0000001; 3,14159265358979 keeps all its digits). `grouper: false` for
 * text the engine reads again (a slider's line).
 */
export function nombreExact(v: number, options: { grouper?: boolean } = {}): string {
  if (!Number.isFinite(v)) return ''
  const [e, d] = chiffres(Math.abs(v))
  return ecrire(v < 0, e, d, options.grouper ?? true)
}

/**
 * A number with at most `decimales` decimals (rounded as the double is), trailing zeros dropped:
 * the graduations of the grid.
 */
export function formaterNombre(v: number, decimales: number): string {
  if (!Number.isFinite(v)) return ''
  const d = Math.max(0, Math.min(100, Math.floor(decimales)))
  const a = Math.abs(v)
  const [e, f] = a < 1e21 ? couper(a.toFixed(d)) : chiffres(a)
  return ecrire(v < 0, e, f)
}

function abs(n: bigint): bigint {
  return n < 0n ? -n : n
}

/** The exact fraction rounded half up (in absolute value) to its decimals, in BigInt. */
function decimalExact(r: Rationnel): { texte: string; approche: boolean } {
  const negatif = r.num < 0n
  const a = abs(r.num)
  const den = r.den
  if (den === 1n) return { texte: ecrire(negatif, a.toString(), ''), approche: false }
  if (a === 0n) return { texte: '0', approche: false }
  // k: the smallest power with a·10^k ≥ den, so that the value is at least 10^−k.
  let k = 0
  let p = a
  while (p < den) {
    p *= 10n
    k++
  }
  // At least 0,1 (k ≤ 1): two decimals; below, three significant digits.
  const d = k <= 1 ? 2 : k + 2
  const echelle = 10n ** BigInt(d)
  const scaled = a * echelle
  let q = scaled / den
  const reste = scaled % den
  if (2n * reste >= den) q += 1n
  const s = q.toString().padStart(d + 1, '0')
  return {
    texte: ecrire(negatif, s.slice(0, s.length - d), s.slice(s.length - d)),
    approche: reste !== 0n,
  }
}

/**
 * A computed value as the calculator writes it in decimal: two decimals, or three significant
 * digits under 0,1 (≈ 0,83, ≈ 0,000123, = 0,0000000000001). With the exact fraction the rounding
 * is done on it (0,995 → ≈ 1, 1 + 10⁻¹¹ → ≈ 1); without it, a value is "=" only when the double is
 * exactly what is written and has fewer digits than the engine rounds decimal calculations to. Large values keep ten significant digits and are "≈" unless they are
 * exact integers. Null for a value that is not a finite number.
 */
export function formaterDecimal(
  v: number,
  exact?: Rationnel | null,
  options: { arrondi?: boolean } = {}
): { texte: string; approche: boolean } | null {
  if (exact) return decimalExact(exact)
  if (!Number.isFinite(v)) return null
  // A value the engine computed with doubles and rounded (`arrondi`): never "=", even when it
  // lands on an integer (π·10¹², e³⁰, √1,0000000000001).
  const arrondi = options.arrondi === true
  if (v === 0) return { texte: '0', approche: arrondi }
  const a = Math.abs(v)
  if (Number.isSafeInteger(a)) return { texte: ecrire(v < 0, a.toString(), ''), approche: arrondi }
  if (a >= 1e15) {
    const [e, d] = chiffres(Number(a.toPrecision(10)))
    return { texte: ecrire(v < 0, e, d), approche: true }
  }
  const s = a >= 0.1 ? a.toFixed(2) : a.toPrecision(3)
  const [e, d] = a >= 0.1 ? couper(s) : chiffres(Number(s))
  // The engine rounds a decimal calculation to CHIFFRES_SIGNIFICATIFS digits: a value that uses
  // them all may have been rounded there (√2·10¹⁰ reads 14 142 135 623,7), so it is never "=".
  const arrondiParLeMoteur = significatifs(a) >= CHIFFRES_SIGNIFICATIFS
  return {
    texte: ecrire(v < 0, e, d),
    approche: arrondi || arrondiParLeMoteur || Number(s) !== a,
  }
}
