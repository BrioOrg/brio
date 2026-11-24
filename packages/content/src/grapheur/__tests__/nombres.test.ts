import { describe, expect, it } from 'vitest'

import { analyserLignes } from '../langage'
import { formaterDecimal, formaterNombre, grouperChiffres, nombreExact } from '../nombres'
import type { Rationnel } from '../rationnel'

// Gate 5 round 1 of #421 (V4-B1…B4, V4-I1, V4-S1): what the calculator writes for a number.

const F = ' '
const M = '−'

/** The result line of a calculation, as the screen writes it in decimal. */
function decimal(texte: string) {
  const a = analyserLignes([{ id: 'l', texte }])[0]
  if (a.genre !== 'calcul') throw new Error(`${texte}: ${a.genre}`)
  return formaterDecimal(a.valeur, a.exact)
}

describe('jamais « = » pour une valeur arrondie', () => {
  it.each([
    // V4-B1: tiny values are written, not zeroed.
    ['10^(-13)', '0,0000000000001', false],
    ['exp(-30)', '0,0000000000000936', true],
    ['π/10^20', '0,0000000000000000000314', true],
    // V4-B2: beyond 10^10, "=" only for the value itself.
    ['12345678901,5', `12${F}345${F}678${F}901,5`, false],
    // The engine keeps 12 significant digits of a decimal calculation: the last one shown is its.
    ['√2·10^10', `14${F}142${F}135${F}623,7`, true],
    // V4-B3: decided on the exact fraction, or "≈" for a rounded double.
    ['1 + 10^(-11)', '1', true],
    ['cos(10^(-6))', '1', true],
    ['2/3 + 1/6', '0,83', true],
    ['1/4', '0,25', false],
    ['-3/2', `${M}1,5`, false],
    // V4-I1: halves rounded up on the fraction, not on the double.
    ['0,995', '1', true],
    ['1,005', '1,01', true],
    ['-0,125', `${M}0,13`, true],
  ])('%s → %s (approché : %s)', (texte, attendu, approche) => {
    expect(decimal(texte)).toEqual({ texte: attendu, approche })
  })

  it('ne dit « = » d’un double que s’il vaut exactement ce qui est écrit', () => {
    expect(formaterDecimal(0.25)).toEqual({ texte: '0,25', approche: false })
    expect(formaterDecimal(1 + 1e-11)).toEqual({ texte: '1', approche: true })
    expect(formaterDecimal(1234567.5)).toEqual({ texte: `1${F}234${F}567,5`, approche: false })
    expect(formaterDecimal(12345678901.257)?.approche).toBe(true)
    // Twelve significant digits: the engine may have rounded there, so "≈" without the fraction.
    expect(formaterDecimal(12345678901.5)).toEqual({
      texte: `12${F}345${F}678${F}901,5`,
      approche: true,
    })
  })

  it('arrondit une fraction exacte en BigInt, même énorme', () => {
    const r: Rationnel = { num: 10n ** 40n + 1n, den: 3n }
    const d = formaterDecimal(Number.NaN, r)
    expect(d?.approche).toBe(true)
    expect(d?.texte.startsWith(`3${F}333${F}333`)).toBe(true)
    expect(d?.texte.endsWith(',67')).toBe(true)
  })
})

describe('groupement des chiffres : une seule règle, à partir de 5 chiffres', () => {
  it('ne groupe pas 4 chiffres et groupe 5', () => {
    expect(grouperChiffres('1234')).toBe('1234')
    expect(grouperChiffres('12345')).toBe(`12${F}345`)
    expect(formaterNombre(1000, 0)).toBe('1000')
    expect(formaterNombre(-25000, 0)).toBe(`${M}25${F}000`)
    expect(formaterDecimal(1234.5)?.texte).toBe('1234,5')
    expect(nombreExact(123456.5)).toBe(`123${F}456,5`)
  })
})

describe('nombreExact', () => {
  it.each([
    [1e-7, '0,0000001'],
    [1e-11, '0,00000000001'],
    [1e21, `1${F}000${F}000${F}000${F}000${F}000${F}000${F}000`],
    [3.14159265358979, '3,14159265358979'],
    [-0.5, `${M}0,5`],
    [-0, '0'],
    [0.30000000000000004, '0,30000000000000004'],
  ])('%s → %s, sans exposant', (v, attendu) => {
    expect(nombreExact(v)).toBe(attendu)
  })

  it('relit exactement la même valeur dans le moteur', () => {
    for (const v of [1e-7, 0.1, -2.5, 1e21, 123456.789, 3.14159265358979, 0.30000000000000004]) {
      const texte = `a = ${nombreExact(v, { grouper: false })}`
      const [a] = analyserLignes([{ id: 'l', texte }])
      expect(a.genre, texte).toBe('constante')
      if (a.genre === 'constante') expect(a.valeur, texte).toBe(v)
    }
  })
})
