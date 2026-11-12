import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const personasDir = new URL('../../../mesh/personas/', import.meta.url)
const tasks = JSON.parse(readFileSync(new URL('../../../mesh/routes/tasks.json', import.meta.url), 'utf8'))
const taskIds = new Set(tasks.taches.map((t) => t.id))

test('every persona file targets tasks that exist in tasks.json and carries no e-mail', () => {
  const files = readdirSync(personasDir).filter((f) => f.endsWith('.yaml'))
  assert.ok(files.length >= 1)
  for (const f of files) {
    const text = readFileSync(new URL(f, personasDir), 'utf8')
    assert.match(text, new RegExp(`^id: ${f.replace('.yaml', '')}$`, 'm'), `${f} : id = nom du fichier`)
    const role = text.match(/^role: (\w+)/m)?.[1]
    assert.ok(tasks.personas[role], `${f} : role « ${role} » absent de tasks.json`)
    for (const [, id] of text.matchAll(/^\s+tache: (\S+)/gm)) {
      assert.ok(taskIds.has(id), `${f} : tâche « ${id} » absente de tasks.json`)
    }
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[\w.-]+/, `${f} : pas d'adresse e-mail`)
  }
})
