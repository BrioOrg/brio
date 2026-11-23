// check-content on calculator blocks (ADR 0049 §6, #424): the real script on fixture chapters
// (`--root`), so an expression the calculator cannot read is proven to fail the CI, with the
// engine's French message and the block's path.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MESSAGES } from '../grapheur/langage'

const SCRIPT = new URL('../../../../scripts/check-content.mjs', import.meta.url).pathname

function check(block: Record<string, unknown>): { ok: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'check-content-'))
  try {
    writeFileSync(
      join(dir, 'chapitre.json'),
      JSON.stringify({ id: 'fixture', sections: [{ id: 's1', blocks: [block] }] })
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

const bloc = (extra: Record<string, unknown>) => ({
  id: 'explorer-a',
  type: 'calculatrice',
  consigne: 'Déplace le curseur $a$.',
  expressions: ['y = a*x + 1', 'a = 1'],
  fenetre: { x: [-5, 5], y: [-5, 5] },
  ...extra,
})

describe('check-content — calculator blocks', () => {
  it('passes a block the calculator reads, `*` in an expression included', () => {
    const r = check(bloc({}))
    expect(r.output).toContain('Content checks passed')
    expect(r.ok).toBe(true)
  })

  it('fails on an expression the calculator cannot read, with its message and the block path', () => {
    const r = check(bloc({ expressions: ['y = 2x < 3'] }))
    expect(r.ok).toBe(false)
    expect(r.output).toContain('sections[id=s1].blocks[0].expressions[0]')
    expect(r.output).toContain(MESSAGES.inequation)
  })

  it('fails on an inverted window and on too many expressions', () => {
    const r = check(
      bloc({
        expressions: Array.from({ length: 9 }, (_, i) => `y = x + ${i}`),
        fenetre: { x: [5, -5], y: [-5, 5] },
      })
    )
    expect(r.ok).toBe(false)
    expect(r.output).toContain('8 expressions au maximum dans un bloc.')
    expect(r.output).toContain('blocks[0].fenetre.x')
  })
})
