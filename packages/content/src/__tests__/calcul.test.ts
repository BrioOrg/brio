import { describe, expect, it } from 'vitest'
import {
  buildCalculModel,
  calculSteps,
  checkCalcul,
  focusRanges,
  scanLatex,
  splitCalculLine,
  wrapFocus,
} from '../calcul'

describe('scanLatex', () => {
  it('should find only the relations outside every group', () => {
    expect(scanLatex('x + 13 = 41').relations.map((r) => r.symbol)).toEqual(['='])
    expect(scanLatex('\\frac{a=b}{2} \\leq 3').relations.map((r) => r.symbol)).toEqual(['\\leq'])
    expect(scanLatex('\\left< u \\right> = 1').relations.map((r) => r.symbol)).toEqual(['='])
    expect(scanLatex('\\begin{cases} a = 1 \\end{cases}').relations).toEqual([])
  })

  it('should tell a command from a relation that prefixes it', () => {
    expect(scanLatex('\\left( x \\right) \\le 2').relations.map((r) => r.symbol)).toEqual(['\\le'])
  })

  it('should report unbalanced groups', () => {
    expect(scanLatex('\\frac{1}{2').balanced).toBe(false)
    expect(scanLatex('\\left( x').balanced).toBe(false)
    expect(scanLatex('a } b').balanced).toBe(false)
    expect(scanLatex('\\{ x \\}').balanced).toBe(true)
  })
})

describe('splitCalculLine', () => {
  it('should split an equation on its relation', () => {
    expect(splitCalculLine('3x + 5 = 11', 'equation', 0)).toEqual({
      ok: true,
      parts: { lhs: '3x + 5', rel: '=', rhs: '11' },
    })
    expect(splitCalculLine('BC^2 = AB^2 + AC^2', 'equation', 3)).toEqual({
      ok: true,
      parts: { lhs: 'BC^2', rel: '=', rhs: 'AB^2 + AC^2' },
    })
  })

  it('should require exactly one relation in an equation', () => {
    expect(splitCalculLine('3x + 5', 'equation', 0)).toEqual({ ok: false, error: 'NO_RELATION' })
    expect(splitCalculLine('a = b = c', 'equation', 1)).toEqual({
      ok: false,
      error: 'SEVERAL_RELATIONS',
    })
    expect(splitCalculLine('= 11', 'equation', 1)).toEqual({ ok: false, error: 'EMPTY_MEMBER' })
  })

  it('should let a chain start with a name, a whole equality or a bare expression', () => {
    expect(splitCalculLine('A = 2x + 3', 'egalites', 0)).toEqual({
      ok: true,
      parts: { lhs: 'A', rel: '=', rhs: '2x + 3' },
    })
    expect(splitCalculLine('2x + 3 + 4x', 'egalites', 0)).toEqual({
      ok: true,
      parts: { lhs: '', rel: '', rhs: '2x + 3 + 4x' },
    })
  })

  it('should imply = on a continuation line, or take the relation it starts with', () => {
    expect(splitCalculLine('6x + 2', 'egalites', 1)).toEqual({
      ok: true,
      parts: { lhs: '', rel: '=', rhs: '6x + 2' },
    })
    expect(splitCalculLine('\\approx 28{,}3', 'egalites', 2)).toEqual({
      ok: true,
      parts: { lhs: '', rel: '\\approx', rhs: '28{,}3' },
    })
    expect(splitCalculLine('6x = 2', 'egalites', 1)).toEqual({
      ok: false,
      error: 'RELATION_INSIDE',
    })
  })
})

describe('focus', () => {
  it('should find a focus whatever its spacing', () => {
    expect(focusRanges('41 - 13', '-13')).toEqual([[3, 7]])
  })

  it('should never cut a number or a command', () => {
    expect(focusRanges('12 + 2', '2')).toEqual([[5, 6]])
    expect(focusRanges('1{,}25 + 2', '2')).toEqual([[9, 10]])
    expect(focusRanges('\\frac{f}{2}', 'f')).toEqual([[6, 7]])
  })

  it('should wrap every occurrence in the focus class', () => {
    expect(wrapFocus('x + 13 - 13', '- 13')).toBe('x + 13 \\htmlClass{calcul-focus}{- 13}')
    expect(wrapFocus('5x + 10', undefined)).toBe('5x + 10')
  })
})

describe('buildCalculModel', () => {
  it('should lay an equation out with the operation under the line it applies to', () => {
    const model = buildCalculModel({
      mode: 'equation',
      lines: [
        { latex: 'x + 13 = 41' },
        {
          latex: 'x = 41 - 13',
          op: '-13',
          note: 'on soustrait 13 aux deux membres',
          focus: '- 13',
        },
        { latex: 'x = 28' },
      ],
      conclusion: 'La solution est $28$.',
    })
    expect(model.steps).toBe(4)
    expect(model.rows[0]).toEqual({
      lhs: 'x + 13',
      rel: '=',
      rhs: '41',
      spoken: 'x + 13 = 41',
    })
    expect(model.rows[1]).toEqual({
      lhs: 'x',
      rel: '=',
      rhs: '41 \\htmlClass{calcul-focus}{- 13}',
      spoken: 'x = 41 - 13',
      note: 'on soustrait 13 aux deux membres',
      op: { latex: '-13', rhsBefore: '41' },
    })
  })

  it('should draw a line that does not split whole, on the right', () => {
    const model = buildCalculModel({ mode: 'equation', lines: [{ latex: '3x' }, { latex: '' }] })
    expect(model.rows.map((r) => [r.lhs, r.rel, r.rhs])).toEqual([
      ['', '', '3x'],
      ['', '', ''],
    ])
  })

  it('should never draw an operation in a chain of equalities', () => {
    const model = buildCalculModel({
      mode: 'egalites',
      lines: [{ latex: 'A = 1 + 1' }, { latex: '2', op: '+1' }],
    })
    expect(model.rows[1].op).toBeUndefined()
    expect(model.steps).toBe(2)
  })

  it('should count the steps from the raw block', () => {
    expect(calculSteps({ lines: [{}, {}, {}], conclusion: 'Fini.' })).toBe(4)
    expect(calculSteps({ lines: [{}, {}], conclusion: ' ' })).toBe(2)
  })
})

describe('checkCalcul', () => {
  const ok = {
    mode: 'equation',
    lines: [
      { latex: '4x = 28' },
      { latex: 'x = \\frac{28}{4}', op: '\\div 4', note: 'on divise les deux membres par 4' },
      { latex: 'x = 7' },
    ],
  }

  it('should accept a valid block of each mode', () => {
    expect(checkCalcul(ok)).toEqual([])
    expect(
      checkCalcul({
        mode: 'egalites',
        lines: [{ latex: '2x + 3 + 4x - 1' }, { latex: '6x + 2', focus: '6x' }],
      })
    ).toEqual([])
  })

  it('should bound the number of lines', () => {
    expect(checkCalcul({ mode: 'equation', lines: [{ latex: 'x = 1' }] })[0]).toEqual({
      code: 'LINE_COUNT',
      path: 'lines',
      count: 1,
      min: 2,
      max: 12,
    })
  })

  it('should report a blank line, a missing relation and a relation inside a chain', () => {
    expect(
      checkCalcul({ mode: 'equation', lines: [{ latex: ' ' }, { latex: '3x' }] }).map((i) => [
        i.code,
        i.path,
      ])
    ).toEqual([
      ['BLANK_LINE', 'lines[0].latex'],
      ['NO_RELATION', 'lines[1].latex'],
    ])
    expect(
      checkCalcul({ mode: 'egalites', lines: [{ latex: 'A = 1' }, { latex: '1 = 1' }] })[0]?.code
    ).toBe('RELATION_INSIDE')
  })

  it('should report a focus that is not in its line', () => {
    expect(
      checkCalcul({
        ...ok,
        lines: [ok.lines[0], { ...ok.lines[1], focus: '\\div 4' }, ok.lines[2]],
      })
    ).toEqual([{ code: 'FOCUS_NOT_FOUND', path: 'lines[1].focus', index: 1, focus: '\\div 4' }])
  })

  it('should keep operations to the lines of an equation after the first', () => {
    expect(
      checkCalcul({ mode: 'egalites', lines: [{ latex: 'A = 1' }, { latex: '1', op: '+1' }] })[0]
        ?.code
    ).toBe('OP_IN_EGALITES')
    expect(
      checkCalcul({ ...ok, lines: [{ ...ok.lines[0], op: '-1' }, ok.lines[1]] })[0]?.code
    ).toBe('OP_ON_FIRST_LINE')
    expect(
      checkCalcul({ ...ok, lines: [ok.lines[0], { ...ok.lines[1], op: '= 2' }] })[0]?.code
    ).toBe('OP_INVALID')
  })

  it('should keep a note short', () => {
    const note = 'on '.repeat(30)
    expect(checkCalcul({ ...ok, lines: [ok.lines[0], { ...ok.lines[1], note }] })[0]?.code).toBe(
      'NOTE_TOO_LONG'
    )
  })
})
