import { describe, expect, it } from 'vitest'
import { buildScratchModel, parseScratch, type ScratchParseResult } from '../scratch'

function script(code: string) {
  const result = parseScratch(code)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.script
}

function errors(result: ScratchParseResult) {
  return result.ok ? [] : result.errors
}

describe('parseScratch', () => {
  it('should parse the programme de calcul of programmes-blocs', () => {
    const parsed = script(
      [
        'quand le drapeau vert est cliqué',
        'demander « Choisis un nombre » et attendre',
        'mettre x à (réponse)',
        'mettre résultat à ((x * 3) + 4)',
        'dire (résultat)',
      ].join('\n')
    )
    expect(parsed.map((s) => s.kind)).toEqual([
      'whenFlagClicked',
      'ask',
      'setVariable',
      'setVariable',
      'say',
    ])
    expect(parsed[1]).toMatchObject({ question: { kind: 'text', text: 'Choisis un nombre' } })
    expect(parsed[2]).toMatchObject({ variable: 'x', value: { kind: 'answer' } })
    expect(parsed[3]).toMatchObject({
      variable: 'résultat',
      value: {
        kind: 'operator',
        op: '+',
        left: {
          kind: 'operator',
          op: '*',
          left: { kind: 'variable', name: 'x' },
          right: { kind: 'number', value: 3 },
        },
        right: { kind: 'number', value: 4 },
      },
    })
    expect(parsed[4]).toMatchObject({ message: { kind: 'variable', name: 'résultat' } })
  })

  it('should nest the indented lines of a loop until its fin', () => {
    const parsed = script(
      ['mettre n à 0', 'répéter 5 fois', '    ajouter 3 à n', 'fin', 'dire n'].join('\n')
    )
    expect(parsed.map((s) => s.kind)).toEqual(['setVariable', 'repeat', 'say'])
    expect(parsed[1]).toMatchObject({
      times: { kind: 'number', value: 5 },
      body: [{ kind: 'changeVariable', variable: 'n', by: { kind: 'number', value: 3 } }],
    })
  })

  it('should nest loops inside loops', () => {
    const parsed = script(
      [
        'répéter 2 fois',
        '    répéter 4 fois',
        '        avancer de 50 pas',
        '        tourner à gauche de 90 degrés',
        '    fin',
        'fin',
      ].join('\n')
    )
    expect(parsed).toMatchObject([
      {
        kind: 'repeat',
        body: [
          {
            kind: 'repeat',
            body: [
              { kind: 'move', steps: { value: 50 } },
              { kind: 'turn', direction: 'left', degrees: { value: 90 } },
            ],
          },
        ],
      },
    ])
  })

  it('should read decimals with a comma or a point, and negative numbers', () => {
    const parsed = script('mettre a à 2,5\nmettre b à -3\nmettre c à (a - 1.5)')
    expect(parsed[0]).toMatchObject({ value: { kind: 'number', text: '2,5', value: 2.5 } })
    expect(parsed[1]).toMatchObject({ value: { kind: 'number', text: '-3', value: -3 } })
    expect(parsed[2]).toMatchObject({
      value: { op: '-', right: { kind: 'number', text: '1.5', value: 1.5 } },
    })
  })

  it('should accept a trailing newline and collapse repeated spaces', () => {
    expect(script('dire  «  Bonjour  »\n')).toMatchObject([
      { kind: 'say', message: { kind: 'text', text: 'Bonjour' } },
    ])
  })

  it.each([
    ['avancer 10', 'unknown instruction'],
    ['mettre x à x * 3', 'an operator block goes in parentheses'],
    ['mettre x à (x × 3)', 'Scratch writes *, not ×'],
    ['mettre x à (x * 3 + 4)', 'one operator per pair of parentheses'],
    ['mettre x à (x * 3', '")" is missing'],
    ['mettre x à (x *)', 'a value is missing'],
    ['dire « Bonjour', '« is never closed'],
    ['dire « »', 'empty text'],
    ['mettre réponse à 3', 'is not a variable name'],
    ['mettre 3x à 3', 'is not a variable name'],
  ])('should reject %j', (code, message) => {
    const [error] = errors(parseScratch(code))
    expect(error.line).toBe(1)
    expect(error.message).toContain(message)
  })

  it('should carry a stable code and structured params on each error (#307)', () => {
    // The code + params are the language-agnostic form the web translates; the English message
    // is derived from them, so rewording a message never changes what the web keys on.
    expect(errors(parseScratch('mettre x à (x × 3)'))[0]).toMatchObject({
      code: 'wrongOperatorSymbol',
      params: { symbol: '×', correct: '*', source: '(x × 3)' },
    })
    expect(errors(parseScratch('répéter 2 fois\n    dire 1\n  fin'))[0]).toMatchObject({
      code: 'finIndent',
      params: { loopLine: 1 },
    })
    expect(errors(parseScratch('sauter'))[0]).toMatchObject({
      code: 'unknownInstruction',
      params: { text: 'sauter' },
    })
  })

  it('should reject a loop that is never closed, with the loop line', () => {
    expect(errors(parseScratch('répéter 4 fois\n    avancer de 10 pas'))).toMatchObject([
      { line: 1, code: 'loopNeverClosed', message: '"répéter" is never closed by "fin"' },
    ])
  })

  it('should reject a line that leaves a loop without fin', () => {
    const [error] = errors(parseScratch('répéter 4 fois\n    avancer de 10 pas\ndire 1\nfin'))
    expect(error.line).toBe(3)
    expect(error.message).toContain('must be closed by "fin"')
  })

  it('should reject an empty loop, a stray fin and a misaligned fin', () => {
    expect(errors(parseScratch('répéter 4 fois\nfin'))[0]).toMatchObject({ line: 1 })
    expect(errors(parseScratch('dire 1\nfin'))[0].message).toContain('closes no')
    expect(errors(parseScratch('répéter 4 fois\n    dire 1\n  fin'))[0]).toMatchObject({
      line: 3,
    })
  })

  it('should reject unexpected indentation, tabs and blank lines', () => {
    expect(errors(parseScratch('dire 1\n    dire 2'))[0].message).toContain(
      'unexpected indentation'
    )
    expect(errors(parseScratch('répéter 2 fois\n\tdire 1\nfin'))[0].message).toContain('tabs')
    expect(errors(parseScratch('dire 1\n\ndire 2'))[0]).toMatchObject({ line: 2 })
  })

  it('should only accept the green flag on the first line', () => {
    expect(errors(parseScratch('dire 1\nquand le drapeau vert est cliqué'))[0].message).toContain(
      'can only start'
    )
  })

  it('should report every faulty line, not only the first', () => {
    expect(errors(parseScratch('avancer 10\ndire 1\ntourner de 90')).map((e) => e.line)).toEqual([
      1, 3,
    ])
  })

  // --- 4e: conditions, comparisons, logical operators, répéter jusqu'à, pen (#234) ---

  it('should parse a si … alors as an if with no else branch', () => {
    const parsed = script(['si (x > 10) alors', '    dire « grand »', 'fin'].join('\n'))
    expect(parsed[0]).toMatchObject({
      kind: 'if',
      elseBody: null,
      condition: {
        kind: 'comparison',
        op: '>',
        left: { kind: 'variable', name: 'x' },
        right: { kind: 'number', value: 10 },
      },
      body: [{ kind: 'say', message: { kind: 'text', text: 'grand' } }],
    })
  })

  it('should parse a si … sinon as an if whose elseBody is an array', () => {
    const parsed = script(
      ['si (n = 0) alors', '    dire « zéro »', 'sinon', '    dire « autre »', 'fin'].join('\n')
    )
    expect(parsed[0]).toMatchObject({
      kind: 'if',
      condition: { kind: 'comparison', op: '=' },
      body: [{ kind: 'say', message: { kind: 'text', text: 'zéro' } }],
      elseBody: [{ kind: 'say', message: { kind: 'text', text: 'autre' } }],
    })
  })

  it('should parse répéter jusqu’à ce que as a C block with a boolean condition', () => {
    const parsed = script(["répéter jusqu'à ce que (n = 0)", '    ajouter -1 à n', 'fin'].join('\n'))
    expect(parsed[0]).toMatchObject({
      kind: 'repeatUntil',
      condition: { kind: 'comparison', op: '=', right: { kind: 'number', value: 0 } },
      body: [{ kind: 'changeVariable', variable: 'n' }],
    })
  })

  it('should combine booleans with et/ou only in operator position', () => {
    const parsed = script('si ((réponse = « oui ») ou (essais > 3)) alors\n    dire 1\nfin')
    expect(parsed[0]).toMatchObject({
      kind: 'if',
      condition: {
        kind: 'logical',
        op: 'ou',
        left: { kind: 'comparison', op: '=', left: { kind: 'answer' } },
        right: { kind: 'comparison', op: '>', left: { kind: 'variable', name: 'essais' } },
      },
    })
  })

  it('should keep et/ou as variable names when they are operands, not operators', () => {
    const parsed = script('mettre et à (ou + 1)')
    expect(parsed[0]).toMatchObject({
      kind: 'setVariable',
      variable: 'et',
      value: { kind: 'operator', op: '+', left: { kind: 'variable', name: 'ou' } },
    })
  })

  it('should parse the three pen blocks by exact wording', () => {
    const parsed = script(
      ["stylo en position d'écriture", 'effacer tout', 'relever le stylo'].join('\n')
    )
    expect(parsed.map((s) => s.kind)).toEqual(['penDown', 'clear', 'penUp'])
  })

  it('should nest a répéter inside a si and close each with its own fin', () => {
    const parsed = script(
      [
        'si (x > 0) alors',
        '    répéter 3 fois',
        '        avancer de 10 pas',
        '    fin',
        'fin',
      ].join('\n')
    )
    expect(parsed[0]).toMatchObject({
      kind: 'if',
      body: [{ kind: 'repeat', body: [{ kind: 'move' }] }],
    })
  })

  it.each([
    ['si x alors\n    dire 1\nfin', 'conditionNotBoolean', 1],
    ['si (x + 1) alors\n    dire 1\nfin', 'conditionNotBoolean', 1],
    ["répéter jusqu'à ce que 5\n    dire 1\nfin", 'conditionNotBoolean', 1],
    ['mettre x à (a > b)', 'booleanInValueSlot', 1],
    ['dire ((a > b) > 3)', 'comparisonNeedsValues', 1],
    ['si (x et y) alors\n    dire 1\nfin', 'logicalNeedsBooleans', 1],
    ['sinon', 'sinonWithoutIf', 1],
    ['si (x > 0) alors\n    dire 1\n  sinon\n    dire 2\nfin', 'sinonIndent', 3],
    [
      'si (x > 0) alors\n    dire 1\nsinon\n    dire 2\nsinon\n    dire 3\nfin',
      'duplicateSinon',
      5,
    ],
  ])('should reject %j with code %s', (code, expected, line) => {
    const [error] = errors(parseScratch(code))
    expect(error).toMatchObject({ code: expected, line })
  })

  it('should report an empty si, an empty sinon and an empty répéter jusqu’à with a block type', () => {
    expect(errors(parseScratch('si (x > 0) alors\nsinon\n    dire 1\nfin'))[0]).toMatchObject({
      code: 'emptyLoop',
      params: { blockType: 'if' },
    })
    expect(errors(parseScratch('si (x > 0) alors\n    dire 1\nsinon\nfin'))[0]).toMatchObject({
      code: 'emptyLoop',
      params: { blockType: 'else' },
    })
    expect(errors(parseScratch("répéter jusqu'à ce que (n = 0)\nfin"))[0]).toMatchObject({
      code: 'emptyLoop',
      params: { blockType: 'repeatUntil' },
    })
  })

  it('should carry the block type when a si or répéter jusqu’à is left open or has a stray fin', () => {
    expect(errors(parseScratch('si (x > 0) alors\n    dire 1'))[0]).toMatchObject({
      code: 'loopNeverClosed',
      params: { blockType: 'if' },
    })
    expect(
      errors(parseScratch('si (x > 0) alors\n    dire 1\n  fin'))[0]
    ).toMatchObject({ code: 'finIndent', params: { blockType: 'if', loopLine: 1 } })
  })
})

describe('buildScratchModel', () => {
  it('should give each block its category, shape and French wording', () => {
    const model = buildScratchModel(
      script(
        [
          'quand le drapeau vert est cliqué',
          'mettre résultat à ((x * 3) + réponse)',
          'répéter 4 fois',
          '    tourner à droite de 90 degrés',
          'fin',
        ].join('\n')
      )
    )
    expect(model.map((b) => [b.category, b.shape])).toEqual([
      ['events', 'hat'],
      ['variables', 'stack'],
      ['control', 'c'],
    ])
    expect(model[0].parts).toContainEqual({ kind: 'icon', icon: 'flag', label: 'le drapeau vert' })
    expect(model[1].parts).toEqual([
      { kind: 'label', text: 'mettre' },
      { kind: 'dropdown', text: 'résultat' },
      { kind: 'label', text: 'à' },
      {
        kind: 'reporter',
        category: 'operators',
        parts: [
          {
            kind: 'reporter',
            category: 'operators',
            parts: [
              { kind: 'reporter', category: 'variables', parts: [{ kind: 'label', text: 'x' }] },
              { kind: 'label', text: '*' },
              { kind: 'input', text: '3' },
            ],
          },
          { kind: 'label', text: '+' },
          { kind: 'reporter', category: 'sensing', parts: [{ kind: 'label', text: 'réponse' }] },
        ],
      },
    ])
    expect(model[2].body).toEqual([
      {
        category: 'motion',
        shape: 'stack',
        parts: [
          { kind: 'label', text: 'tourner' },
          { kind: 'icon', icon: 'turn-right', label: 'à droite' },
          { kind: 'label', text: 'de' },
          { kind: 'input', text: '90' },
          { kind: 'label', text: 'degrés' },
        ],
        body: [],
      },
    ])
  })

  it('should draw a si as a C block with a hexagonal boolean in its condition', () => {
    const [b] = buildScratchModel(script('si (x > 10) alors\n    dire 1\nfin'))
    expect(b.shape).toBe('c')
    expect(b.category).toBe('control')
    expect(b.elseBody).toBeUndefined()
    expect(b.parts).toEqual([
      { kind: 'label', text: 'si' },
      {
        kind: 'boolean',
        category: 'operators',
        parts: [
          { kind: 'reporter', category: 'variables', parts: [{ kind: 'label', text: 'x' }] },
          { kind: 'label', text: '>' },
          { kind: 'input', text: '10' },
        ],
      },
      { kind: 'label', text: 'alors' },
    ])
  })

  it('should draw a si … sinon as a double C block (cElse) with an else row and body', () => {
    const [b] = buildScratchModel(
      script('si (n = 0) alors\n    dire « a »\nsinon\n    dire « b »\nfin')
    )
    expect(b.shape).toBe('cElse')
    expect(b.elseParts).toEqual([{ kind: 'label', text: 'sinon' }])
    expect(b.body).toMatchObject([{ parts: [{ text: 'dire' }, { text: 'a' }] }])
    expect(b.elseBody).toMatchObject([{ parts: [{ text: 'dire' }, { text: 'b' }] }])
  })

  it('should nest booleans: a logical holds two hexagonal comparisons', () => {
    const [b] = buildScratchModel(
      script('si ((x > 0) et (x < 10)) alors\n    dire 1\nfin')
    )
    expect(b.parts[1]).toMatchObject({
      kind: 'boolean',
      parts: [
        { kind: 'boolean', parts: [{}, { text: '>' }, {}] },
        { kind: 'label', text: 'et' },
        { kind: 'boolean', parts: [{}, { text: '<' }, {}] },
      ],
    })
  })

  it('should draw répéter jusqu’à ce que as a C block with its boolean condition', () => {
    const [b] = buildScratchModel(script("répéter jusqu'à ce que (n = 0)\n    dire 1\nfin"))
    expect(b).toMatchObject({
      category: 'control',
      shape: 'c',
      parts: [
        { kind: 'label', text: "répéter jusqu'à ce que" },
        { kind: 'boolean', category: 'operators' },
      ],
    })
  })

  it('should draw the three pen blocks as pen-category stacks', () => {
    const model = buildScratchModel(
      script("stylo en position d'écriture\neffacer tout\nrelever le stylo")
    )
    expect(model.map((b) => [b.category, b.shape])).toEqual([
      ['pen', 'stack'],
      ['pen', 'stack'],
      ['pen', 'stack'],
    ])
    expect(model[0].parts).toEqual([{ kind: 'label', text: "stylo en position d'écriture" }])
  })
})
