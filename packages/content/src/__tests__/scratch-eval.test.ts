import { describe, expect, it } from 'vitest'
import { parseScratch } from '../scratch'
import { evaluateScratch, toNumber, type ScratchEvalOptions } from '../scratch-eval'

function run(lines: string[], options?: ScratchEvalOptions) {
  const parsed = parseScratch(lines.join('\n'))
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors))
  return evaluateScratch(parsed.script, options)
}

function says(lines: string[], options?: ScratchEvalOptions) {
  const result = run(lines, options)
  if (!result.ok) throw new Error(`${result.error.code} (line ${result.error.line})`)
  return result.says
}

describe('evaluateScratch', () => {
  it('computes a formula built from nested operator blocks', () => {
    expect(says(['mettre x à 5', 'mettre résultat à ((x * 3) + 4)', 'dire (résultat)'])).toEqual([
      19,
    ])
  })

  it('feeds `demander` from inputs and reads it through `réponse`', () => {
    // The « programme de calcul » of programmes-blocs, with the user typing 5.
    expect(
      says(
        [
          'quand le drapeau vert est cliqué',
          'demander « Choisis un nombre » et attendre',
          'mettre x à (réponse)',
          'mettre résultat à ((x * 3) + 4)',
          'dire (résultat)',
        ],
        { inputs: ['5'] }
      )
    ).toEqual([19])
  })

  it('reassigns a variable, keeping only its last value', () => {
    expect(says(['mettre a à 7', 'mettre a à (a + 3)', 'mettre a à (a * 2)', 'dire (a)'])).toEqual([
      20,
    ])
  })

  it('reads one variable to set another', () => {
    expect(says(['mettre a à 4', 'mettre b à (a + 1)', 'mettre a à (b * 2)', 'dire (a)'])).toEqual([
      10,
    ])
  })

  it('runs a `répéter n fois` loop with an accumulator', () => {
    expect(
      says(['mettre n à 0', 'répéter 5 fois', '    ajouter 3 à n', 'fin', 'dire (n)'])
    ).toEqual([15])
  })

  it('runs nested loops', () => {
    expect(
      says([
        'mettre n à 0',
        'répéter 3 fois',
        '    répéter 2 fois',
        '        ajouter 1 à n',
        '    fin',
        'fin',
        'dire (n)',
      ])
    ).toEqual([6])
  })

  it('treats a never-set variable and `ajouter` to it as 0', () => {
    expect(says(['ajouter 4 à n', 'dire (n)'])).toEqual([4])
  })

  it('divides as real numbers', () => {
    expect(says(['dire (7 / 2)'])).toEqual([3.5])
  })

  it('keeps decimals written with a comma', () => {
    expect(says(['mettre r à 10', 'dire ((3,14 * r) * r)'])).toEqual([314])
  })

  it('says a text value unchanged', () => {
    expect(says(['dire « Bonjour »'])).toEqual(['Bonjour'])
  })

  it('says several times, in order', () => {
    expect(says(['mettre a à 1', 'dire (a)', 'ajouter 1 à a', 'dire (a)'])).toEqual([1, 2])
  })

  it('exposes the final variables', () => {
    const result = run(['mettre a à 2', 'mettre b à (a + 3)'])
    expect(result.ok && result.variables).toEqual({ a: 2, b: 5 })
  })

  it('runs motion blocks as no-ops that say nothing', () => {
    expect(
      says(['répéter 4 fois', '    avancer de 50 pas', '    tourner à droite de 90 degrés', 'fin'])
    ).toEqual([])
  })

  it('coerces a non-numeric answer to 0 in arithmetic, as Scratch does', () => {
    expect(says(['mettre x à (réponse)', 'dire ((x * 3) + 4)'], { inputs: ['bonjour'] })).toEqual([
      4,
    ])
  })

  describe('errors', () => {
    it('reports a `demander` with no input left', () => {
      const result = run(['demander « ? » et attendre', 'dire (réponse)'])
      expect(result.ok).toBe(false)
      expect(!result.ok && result.error).toMatchObject({ code: 'missingInput', line: 1 })
    })

    it('reports a negative repeat count', () => {
      const result = run(['répéter -1 fois', '    dire 1', 'fin'])
      expect(!result.ok && result.error.code).toBe('invalidRepeatCount')
    })

    it('reports a fractional repeat count', () => {
      const result = run(['mettre n à 2,5', 'répéter (n) fois', '    dire 1', 'fin'])
      expect(!result.ok && result.error.code).toBe('invalidRepeatCount')
    })

    it('guards against a runaway loop via maxSteps', () => {
      const result = run(['répéter 1000 fois', '    ajouter 1 à n', 'fin'], { maxSteps: 50 })
      expect(!result.ok && result.error.code).toBe('tooManySteps')
    })
  })
})

describe('toNumber', () => {
  it('passes a number through', () => {
    expect(toNumber(42)).toBe(42)
  })
  it('reads a numeric string, decimal comma accepted', () => {
    expect(toNumber('3,5')).toBe(3.5)
    expect(toNumber('  12 ')).toBe(12)
  })
  it('maps empty and non-numeric text to 0', () => {
    expect(toNumber('')).toBe(0)
    expect(toNumber('abc')).toBe(0)
  })
})
