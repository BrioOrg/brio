import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

// PL-4 retro, lesson 6: `git merge origin/develop` was stopped by .githooks/commit-msg with an
// empty subject, because git writes the merge message with no trailing newline and the hook's
// `read` loop dropped that last line. The constructor then rewrote the merge commit by hand.

const hook = fileURLToPath(new URL('../../../.githooks/commit-msg', import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'commit-msg-'))
after(() => rmSync(dir, { recursive: true, force: true }))

let n = 0
function run(message) {
  const file = join(dir, `msg-${n++}`)
  writeFileSync(file, message)
  return spawnSync('bash', [hook, file], { encoding: 'utf8' }).status
}

test('a default merge message without a trailing newline passes', () => {
  assert.equal(run("Merge remote-tracking branch 'origin/develop' into feature/364-x"), 0)
})

test('a conventional subject with an issue reference passes, with or without a newline', () => {
  assert.equal(run('fix(identite): verrouille la connexion (#364)'), 0)
  assert.equal(run('fix(identite): verrouille la connexion (#364)\n\nCorps.\n'), 0)
})

test('a subject without an issue reference is still refused, even on the last line', () => {
  assert.equal(run('chore: merge origin/develop'), 1)
  assert.equal(run('# comment\nchore: merge origin/develop\n'), 1)
})
