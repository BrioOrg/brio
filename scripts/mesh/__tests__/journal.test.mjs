import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

// PL-4 retro, lesson 9: the journal stayed empty for the whole first ticket, so A1 had to work
// from PRs and issues. Every line written now follows docs/mesh/JOURNAL.md, or this fails.

const dir = new URL('../../../mesh/journal/', import.meta.url)
const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
const FIELDS = [
  'ts',
  'agent',
  'signal',
  'action',
  'detail',
  'level',
  'tokens_read',
  'tokens_written',
  'human_disagreement',
  'note_humaine',
]
const isCount = (v) => v === null || (Number.isInteger(v) && v >= 0)

test('journal files are named AAAA-MM.jsonl', () => {
  for (const f of files) assert.match(f, /^\d{4}-(0[1-9]|1[0-2])\.jsonl$/, f)
})

for (const f of files) {
  test(`every line of ${f} follows docs/mesh/JOURNAL.md`, () => {
    const lines = readFileSync(new URL(f, dir), 'utf8').split('\n').filter(Boolean)
    lines.forEach((line, i) => {
      const where = `${f}:${i + 1}`
      const e = JSON.parse(line)
      assert.deepEqual(Object.keys(e).sort(), [...FIELDS].sort(), `${where} : champs`)
      assert.match(e.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, `${where} : ts ISO-8601 UTC`)
      assert.ok(e.ts.startsWith(f.slice(0, 7)), `${where} : ts hors du mois du fichier`)
      assert.match(e.agent, /^[A-Z]\d$/, `${where} : agent`)
      assert.match(e.action, /^[a-z-]+$/, `${where} : action`)
      assert.ok(e.signal && e.detail, `${where} : signal et detail requis`)
      assert.match(e.level, /^N[0-3]$/, `${where} : level`)
      assert.ok(
        isCount(e.tokens_read) && isCount(e.tokens_written),
        `${where} : tokens entier ou null`
      )
      assert.equal(typeof e.human_disagreement, 'boolean', `${where} : human_disagreement`)
      if (e.human_disagreement) assert.ok(e.note_humaine, `${where} : désaccord sans note_humaine`)
    })
  })
}
