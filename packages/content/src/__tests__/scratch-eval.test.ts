import { describe, expect, it } from 'vitest'
import { parseScratch } from '../scratch'
import { compare, evaluateScratch, toNumber, type ScratchEvalOptions } from '../scratch-eval'

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

// --- 4e blocks (#234/#354): conditions, booleans, répéter jusqu'à, pen ---

describe('evaluateScratch — 4e blocks', () => {
  it('runs the alors branch of a si when its condition is true, nothing otherwise', () => {
    const prog = (x: number) => [
      `mettre x à ${x}`,
      'si (x > 10) alors',
      '    dire « grand »',
      'fin',
    ]
    expect(says(prog(12))).toEqual(['grand'])
    expect(says(prog(10))).toEqual([])
  })

  it('runs exactly one branch of a si … sinon', () => {
    const prog = (x: number) => [
      `mettre x à ${x}`,
      'si (x < 0) alors',
      '    dire « négatif »',
      'sinon',
      '    dire « positif ou nul »',
      'fin',
    ]
    expect(says(prog(-3))).toEqual(['négatif'])
    expect(says(prog(0))).toEqual(['positif ou nul'])
  })

  it('tests répéter jusqu’à ce que BEFORE each turn, as Scratch does', () => {
    // n = 1 → 2 → 4 → 8 → 16 : four turns, then 16 > 10 stops the loop.
    expect(
      says([
        'mettre n à 1',
        'mettre tours à 0',
        "répéter jusqu'à ce que (n > 10)",
        '    mettre n à (n * 2)',
        '    ajouter 1 à tours',
        'fin',
        'dire (n)',
        'dire (tours)',
      ])
    ).toEqual([16, 4])
    // Already true: the body never runs (not « at least once »).
    expect(
      says([
        'mettre n à 0',
        "répéter jusqu'à ce que (n = 0)",
        '    ajouter 1 à n',
        'fin',
        'dire (n)',
      ])
    ).toEqual([0])
  })

  it('combines booleans with et, ou and non', () => {
    const prog = (cond: string) => [
      'mettre x à 5',
      `si ${cond} alors`,
      '    dire 1',
      'sinon',
      '    dire 0',
      'fin',
    ]
    expect(says(prog('((x > 0) et (x < 10))'))).toEqual([1])
    expect(says(prog('((x > 0) et (x > 10))'))).toEqual([0])
    expect(says(prog('((x < 0) ou (x = 5))'))).toEqual([1])
    expect(says(prog('((x < 0) ou (x > 10))'))).toEqual([0])
    expect(says(prog('(non (x = 5))'))).toEqual([0])
    expect(says(prog('(non (x = 3))'))).toEqual([1])
  })

  it('compares like Scratch: numbers as numbers, texts without case', () => {
    expect(compare(10, 9)).toBeGreaterThan(0)
    expect(compare('10', '9')).toBeGreaterThan(0) // numeric strings compare as numbers
    expect(compare('Oui', 'oui')).toBe(0)
    expect(compare('abc', 'abd')).toBeLessThan(0)
    expect(compare('', 0)).not.toBe(0) // blank text is not the number 0
    expect(compare(Infinity, Infinity)).toBe(0)
    expect(
      says(
        [
          'demander « Veux-tu jouer ? » et attendre',
          'si ((réponse) = « oui ») alors',
          '    dire « Allons-y »',
          'fin',
        ],
        { inputs: ['OUI'] }
      )
    ).toEqual(['Allons-y'])
  })

  it('reads a decimal comma as a number in a comparison (Brio convention, ADR 0031 §7)', () => {
    expect(says(['mettre x à 10', 'si (x > 2,5) alors', '    dire 1', 'fin'])).toEqual([1])
  })

  it('runs the pen blocks as no-ops that say nothing', () => {
    const result = run([
      'effacer tout',
      "stylo en position d'écriture",
      'avancer de 50 pas',
      'relever le stylo',
    ])
    expect(result).toEqual({ ok: true, says: [], variables: {} })
  })

  it('evaluates a si nested in a loop', () => {
    // Counts the even numbers among 1..6 the 4e way: n mod 2 via ((n / 2) * 2) is not in the
    // catalogue, so compare with a running parity flag instead.
    expect(
      says([
        'mettre pair à 0',
        'mettre compte à 0',
        'répéter 6 fois',
        '    si (pair = 1) alors',
        '        ajouter 1 à compte',
        '        mettre pair à 0',
        '    sinon',
        '        mettre pair à 1',
        '    fin',
        'fin',
        'dire (compte)',
      ])
    ).toEqual([3])
  })

  describe('errors (saboteur, porte 6)', () => {
    it('stops a répéter jusqu’à ce que that never ends with tooManySteps', () => {
      const result = run(["répéter jusqu'à ce que (x < 0)", '    ajouter 1 à x', 'fin'])
      expect(!result.ok && result.error).toMatchObject({ code: 'tooManySteps' })
    })

    it('stops a loop whose condition never changes, even with a tiny budget', () => {
      const result = run(["répéter jusqu'à ce que (1 = 2)", '    dire 1', 'fin'], { maxSteps: 10 })
      expect(!result.ok && result.error).toMatchObject({ code: 'tooManySteps' })
    })

    it('reports a demander with no input inside a branch, on its line', () => {
      const result = run(['si (1 = 1) alors', '    demander « ? » et attendre', 'fin'])
      expect(!result.ok && result.error).toMatchObject({ code: 'missingInput', line: 2 })
    })

    it('does not consume an input in a branch that is not taken', () => {
      expect(
        says(
          [
            'si (1 = 2) alors',
            '    demander « a ? » et attendre',
            'fin',
            'demander « b ? » et attendre',
            'dire (réponse)',
          ],
          { inputs: ['7'] }
        )
      ).toEqual(['7'])
    })

    it('stops nested huge loops within the budget, fast', () => {
      const start = Date.now()
      const result = run([
        'répéter 100000 fois',
        '    répéter 100000 fois',
        '        ajouter 1 à n',
        '    fin',
        'fin',
      ])
      expect(!result.ok && result.error.code).toBe('tooManySteps')
      expect(Date.now() - start).toBeLessThan(1000)
    })
  })
})
