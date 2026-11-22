import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildDeck, type DeckInput } from '@brio/content'

import { indexDiapo } from '@/lib/diapos'

// #371 (PL-2) plan guard-rail: the Accueil links to `?diapo=<sectionId>`, and `indexDiapo` tries a
// slide id, then a block id, before a section id. A section id equal to a block or slide id
// elsewhere in the chapter would open the wrong slide.

const CHAPITRES = join(__dirname, '../../../content/chapitres')

type Chapitre = DeckInput & { id: string; sections: { id: string; kind: string }[] }

function sousDossiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
}

function chapitres(): { fichier: string; chapitre: Chapitre }[] {
  const resultat: { fichier: string; chapitre: Chapitre }[] = []
  for (const niveau of sousDossiers(CHAPITRES)) {
    for (const matiere of sousDossiers(join(CHAPITRES, niveau))) {
      const dossier = join(CHAPITRES, niveau, matiere)
      for (const f of readdirSync(dossier)) {
        if (!f.endsWith('.json') || f.startsWith('_')) continue
        resultat.push({
          fichier: `${niveau}/${matiere}/${f}`,
          chapitre: JSON.parse(readFileSync(join(dossier, f), 'utf8')) as Chapitre,
        })
      }
    }
  }
  return resultat
}

describe('diapo of a lesson section (content/chapitres)', () => {
  const tous = chapitres()

  it('should find chapters to check', () => {
    expect(tous.length).toBeGreaterThan(10)
  })

  it('should open a slide of the section itself, for every lesson section of every chapter', () => {
    const fautes: string[] = []
    let sections = 0
    for (const { fichier, chapitre } of tous) {
      const deck = buildDeck(chapitre)
      for (const section of chapitre.sections.filter((s) => s.kind === 'lesson')) {
        sections++
        const diapo = deck[indexDiapo(deck, section.id)]
        const sectionId = diapo && 'sectionId' in diapo ? diapo.sectionId : undefined
        if (sectionId !== section.id) fautes.push(`${fichier} : ${section.id} -> ${diapo?.id}`)
      }
    }
    expect(sections).toBeGreaterThan(50)
    expect(fautes).toEqual([])
  })
})
