// check-content's "prévoir la valeur" check (#232): an exercise linked to a Scratch programme by
// `program: { ref, inputs? }` must expect what the programme makes the sprite say. These run the
// real script on fixture chapters (`--root`), so a wrong answer is proven to fail the CI.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = new URL('../../../../scripts/check-content.mjs', import.meta.url).pathname

type Block = Record<string, unknown>

function programme(id: string, code: string): Block {
  return { id, type: 'code', language: 'scratch', code }
}

function numeric(id: string, answer: number, program: unknown, extra: Block = {}): Block {
  return {
    id,
    type: 'exercise',
    exerciseType: 'numeric',
    prompt: 'Quel nombre dit le lutin ?',
    answer,
    tolerance: 0,
    program,
    ...extra,
  }
}

function check(blocks: Block[]): { ok: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'check-content-'))
  try {
    writeFileSync(
      join(dir, 'chapitre.json'),
      JSON.stringify({ id: 'fixture', sections: [{ id: 's1', blocks }] })
    )
    const run = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--disable-warning=ExperimentalWarning',
        SCRIPT,
        '--root',
        dir,
      ],
      { encoding: 'utf8' }
    )
    return { ok: run.status === 0, output: run.stdout + run.stderr }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('check-content — programme-linked exercises', () => {
  it('passes when the expected answer is what the sprite says', () => {
    const r = check([
      programme('p', 'demander « n ? » et attendre\nmettre x à (réponse)\ndire ((x * 3) + 4)'),
      numeric('ex', 19, { ref: 'p', inputs: ['5'] }),
    ])
    expect(r.output).not.toContain('✗')
    expect(r.ok).toBe(true)
  })

  it('fails when the expected answer is wrong', () => {
    const r = check([programme('p', 'dire ((2 * 3) + 4)'), numeric('ex', 11, { ref: 'p' })])
    expect(r.ok).toBe(false)
    expect(r.output).toContain('makes the sprite say 10, but the exercise expects 11')
  })

  it('compares with the LAST « dire »', () => {
    const r = check([programme('p', 'dire 1\ndire 2'), numeric('ex', 1, { ref: 'p' })])
    expect(r.ok).toBe(false)
    expect(r.output).toContain('say 2, but the exercise expects 1')
  })

  it('evaluates conditions and répéter jusqu’à ce que (4e)', () => {
    const code = [
      'mettre n à 1',
      "répéter jusqu'à ce que (n > 10)",
      '    mettre n à (n * 2)',
      'fin',
      'si (non (n = 16)) alors',
      '    dire 0',
      'sinon',
      '    dire (n)',
      'fin',
    ].join('\n')
    expect(check([programme('p', code), numeric('ex', 16, { ref: 'p' })]).ok).toBe(true)
    expect(check([programme('p', code), numeric('ex', 8, { ref: 'p' })]).ok).toBe(false)
  })

  it('fails on a loop that never ends', () => {
    const r = check([
      programme('p', "répéter jusqu'à ce que (x < 0)\n    ajouter 1 à x\nfin\ndire (x)"),
      numeric('ex', 0, { ref: 'p' }),
    ])
    expect(r.ok).toBe(false)
    expect(r.output).toContain('ran too long')
  })

  it.each([
    ['NaN', 'dire (0 / 0)', 5],
    ['a text', 'dire « bonjour »', 0],
    ['an empty réponse', 'dire (réponse)', 0],
    ['Infinity', 'dire (1 / 0)', 0],
  ])('fails when the sprite says %s, not a number', (_, code, answer) => {
    const r = check([programme('p', code), numeric('ex', answer, { ref: 'p' })])
    expect(r.ok).toBe(false)
    expect(r.output).toContain('not a number')
  })

  it('reads NaN as 0 in a calculation, as Scratch does', () => {
    expect(check([programme('p', 'dire ((0 / 0) + 1)'), numeric('ex', 1, { ref: 'p' })]).ok).toBe(
      true
    )
  })

  it('fails on a decimal comma in the programme or in its inputs', () => {
    const inCode = check([
      programme('p', 'mettre x à 10\nsi (x > 2,5) alors\n    dire 1\nfin'),
      numeric('ex', 1, { ref: 'p' }),
    ])
    expect(inCode.ok).toBe(false)
    expect(inCode.output).toContain('decimal with a comma (2,5)')
    const inInputs = check([
      programme('p', 'demander « ? » et attendre\ndire ((réponse) * 2)'),
      numeric('ex', 5, { ref: 'p', inputs: ['2,5'] }),
    ])
    expect(inInputs.ok).toBe(false)
    expect(inInputs.output).toContain('decimal with a comma (2,5)')
  })

  it('accepts float noise on a decimal written with a point', () => {
    expect(check([programme('p', 'dire (1.1 * 3)'), numeric('ex', 3.3, { ref: 'p' })]).ok).toBe(
      true
    )
  })

  it('fails when some inputs are never used by a « demander »', () => {
    const r = check([programme('p', 'dire 3'), numeric('ex', 3, { ref: 'p', inputs: ['5'] })])
    expect(r.ok).toBe(false)
    expect(r.output).toContain('uses 0 of the 1 inputs')
  })

  it('treats variables named like Object.prototype members as ordinary variables', () => {
    const r = check([
      programme(
        'p',
        'mettre __proto__ à 5\najouter 1 à constructor\ndire ((__proto__) + (constructor))'
      ),
      numeric('ex', 6, { ref: 'p' }),
    ])
    expect(r.output).not.toContain('internal error')
    expect(r.ok).toBe(true)
  })

  it('fails when a wrong choice of a QCM equals the computed value', () => {
    const r = check([
      programme('p', 'dire 3'),
      {
        id: 'ex',
        type: 'exercise',
        exerciseType: 'multiple-choice',
        prompt: 'Que dit le lutin ?',
        choices: [
          { text: '3', correct: true },
          { text: '3,0', correct: false },
        ],
        program: { ref: 'p' },
      },
    ])
    expect(r.ok).toBe(false)
    expect(r.output).toContain('also the wrong choice « 3,0 »')
  })

  it('refuses an empty correct choice instead of reading it as 0', () => {
    const r = check([
      programme('p', 'dire 0'),
      {
        id: 'ex',
        type: 'exercise',
        exerciseType: 'multiple-choice',
        prompt: 'Que dit le lutin ?',
        choices: [
          { text: '', correct: true },
          { text: '1', correct: false },
        ],
        program: { ref: 'p' },
      },
    ])
    expect(r.ok).toBe(false)
    expect(r.output).toContain('single numeric correct answer')
  })

  it('does not read the inputs of a program link as rich text', () => {
    const r = check([
      programme('p', 'demander « ? » et attendre\ndire (réponse)'),
      numeric('ex', 3, { ref: 'p', inputs: ['3*'] }),
    ])
    expect(r.output).not.toContain('unbalanced * delimiter')
  })

  it('applies the tolerance of a numeric exercise', () => {
    const p = programme('p', 'dire (22 / 7)')
    expect(check([p, numeric('ex', 3.14, { ref: 'p' }, { tolerance: 0.01 })]).ok).toBe(true)
    const tight = check([p, numeric('ex', 3.14, { ref: 'p' }, { tolerance: 0.001 })])
    expect(tight.ok).toBe(false)
    expect(tight.output).toMatch(/expects 3\.14 \(± 0\.001\)/)
  })

  it('reads a QCM correct choice written with a decimal comma', () => {
    const r = check([
      programme('p', 'dire (5 / 2)'),
      {
        id: 'ex',
        type: 'exercise',
        exerciseType: 'multiple-choice',
        prompt: 'Que dit le lutin ?',
        choices: [
          { text: '2,5', correct: true },
          { text: '3', correct: false },
        ],
        program: { ref: 'p' },
      },
    ])
    expect(r.output).not.toContain('✗')
    expect(r.ok).toBe(true)
  })

  it.each([
    [
      'a programme that says nothing',
      [programme('p', 'mettre a à 1')],
      { ref: 'p' },
      /says nothing/,
    ],
    ['an unknown ref', [], { ref: 'zz' }, /no Scratch programme with id "zz"/],
    [
      'a demander without inputs',
      [programme('p', 'demander « ? » et attendre\ndire (réponse)')],
      { ref: 'p' },
      /cannot be evaluated/,
    ],
  ])('fails on %s', (_, blocks, link, message) => {
    const r = check([...blocks, numeric('ex', 1, link)])
    expect(r.ok).toBe(false)
    expect(r.output).toMatch(message)
  })
})
