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

  it('should reject a loop that is never closed, with the loop line', () => {
    expect(errors(parseScratch('répéter 4 fois\n    avancer de 10 pas'))).toEqual([
      { line: 1, message: '"répéter" is never closed by "fin"' },
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
})
