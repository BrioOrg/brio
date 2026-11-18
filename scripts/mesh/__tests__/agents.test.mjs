import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

// Every agent card follows .claude/agents/_TEMPLATE.md: same frontmatter, same ten sections,
// in the same order, autonomy starting at 0.
const dir = new URL('../../../.claude/agents/', import.meta.url)
const cards = readdirSync(dir).filter((f) => /^[A-Z]\d-.+\.md$/.test(f))
const SECTIONS = [
  'Mission',
  'Se réveille',
  'Produit',
  'Outils',
  'Modèle',
  'Veto',
  'Reçoit de',
  'Envoie à',
  'Garde-fous',
  'Autonomie',
]
const MODELS = ['haiku', 'sonnet', 'opus', 'inherit']

for (const file of cards) {
  test(`fiche ${file} respects the template`, () => {
    const text = readFileSync(new URL(file, dir), 'utf8')
    const fm = text.match(/^---\n([\s\S]*?)\n---\n/)
    assert.ok(fm, 'frontmatter manquant')
    const name = fm[1].match(/^name: (.+)$/m)?.[1]
    assert.equal(
      name,
      file
        .replace(/\.md$/, '')
        .toLowerCase()
        .replace(/^(\w\d)-/, '$1-'),
      'name = nom du fichier en minuscules'
    )
    assert.match(fm[1], /^description: >-\n/m, 'description multi-ligne')
    assert.match(fm[1], /^tools: \[.*\]$/m)
    const model = fm[1].match(/^model: (\w+)$/m)?.[1]
    assert.ok(MODELS.includes(model), `model « ${model} » inconnu`)

    const id = file.match(/^([A-Z]\d)-/)[1]
    assert.match(text, new RegExp(`^# ${id} .+  ·  Pôle .+$`, 'm'), 'titre « # ID Nom  ·  Pôle … »')
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1])
    assert.deepEqual(headings, SECTIONS)
    assert.match(text, /## Autonomie\n[^\n]*\*\*0 · observateur\*\*/, 'autonomie démarre à 0')
    assert.doesNotMatch(text, /^> Gabarit de fiche/m, 'bloc de gabarit retiré')
  })
}

test('the cards of the UX and simulation poles exist', () => {
  for (const id of ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'S1', 'S2', 'S3', 'S4']) {
    assert.ok(
      cards.some((f) => f.startsWith(`${id}-`)),
      `fiche ${id} manquante`
    )
  }
})

test('the three veto holders of the UX pole state a veto, the others do not', () => {
  const veto = (id) => {
    const f = cards.find((c) => c.startsWith(`${id}-`))
    return readFileSync(new URL(f, dir), 'utf8')
      .match(/## Veto\n([\s\S]*?)\n## /)[1]
      .trim()
  }
  for (const id of ['U1', 'U6', 'U7']) assert.doesNotMatch(veto(id), /^Aucun/, `${id} a un veto`)
  for (const id of ['U2', 'U3', 'U4', 'U5', 'S1', 'S2', 'S3', 'S4'])
    assert.match(veto(id), /^Aucun/, `${id} n'a pas de veto`)
})
