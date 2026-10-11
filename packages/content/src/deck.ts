/**
 * Splits a chapter into the slides of the interactive mode (ADR 0032 §1–2).
 *
 * Pure and framework-free: the web shell (#245) and the Expo app reuse it as is. A slide holds
 * block ids, never copies of blocks, so both modes render the same blocks with the same renderer.
 */

/** The only fields `buildDeck` reads. The web's `ChapitreResponse` satisfies it without mapping. */
export type DeckBlock = { id: string; type: string; variant?: unknown }
export type DeckSection = { id: string; kind: string; blocks: readonly DeckBlock[] }
export type DeckInput = { sections: readonly DeckSection[] }

export type Diapo =
  | { id: 'debut'; kind: 'debut'; blockIds: string[] }
  | { id: string; kind: 'lecon'; sectionId: string; blockIds: string[] }
  | { id: string; kind: 'exercice'; sectionId: string; blockIds: string[] }
  | { id: 'fin'; kind: 'fin'; blockIds: [] }

/** Ids `buildDeck` gives its own slides: no block may use them (checked by `check-content`). */
export const RESERVED_DIAPO_IDS = ['debut', 'fin'] as const

type Role = 'lead' | 'support' | 'aside' | 'exercise'

const SUPPORT_TYPES = new Set(['figure', 'formula', 'chart', 'code', 'table', 'image'])
const LEAD_CALLOUTS = new Set(['definition', 'example'])

function roleOf(block: DeckBlock): Role {
  if (block.type === 'exercise') return 'exercise'
  if (SUPPORT_TYPES.has(block.type)) return 'support'
  if (block.type === 'callout') {
    return typeof block.variant === 'string' && LEAD_CALLOUTS.has(block.variant) ? 'lead' : 'aside'
  }
  // prose, steps, heading, objectives (when not first), reference, and any future type
  return 'lead'
}

/** The lesson slide being filled, with what rules 3 and 6 need to know about it. */
type OpenSlide = {
  diapo: Extract<Diapo, { kind: 'lecon' }>
  /** Opened by a lead, not by a support or aside with nothing before it (rule 4). */
  openedByLead: boolean
  hasSupport: boolean
  /** Holds a single prose block, which joins the lead that follows (rule 3). */
  introducing: boolean
}

export function buildDeck(chapitre: DeckInput): Diapo[] {
  const debut: Diapo = { id: 'debut', kind: 'debut', blockIds: [] }
  const deck: Diapo[] = [debut]

  chapitre.sections.forEach((section, sectionIndex) => {
    let blocks = section.blocks
    // Rule 1: objectives opening the chapter belong to the title slide.
    if (sectionIndex === 0 && blocks[0]?.type === 'objectives') {
      debut.blockIds.push(blocks[0].id)
      blocks = blocks.slice(1)
    }

    // Rule 7: a slide never spans two sections, so each section starts with nothing open.
    let open: OpenSlide | null = null
    const openSlide = (block: DeckBlock, openedByLead: boolean): OpenSlide => {
      const diapo: OpenSlide['diapo'] = {
        id: block.id,
        kind: 'lecon',
        sectionId: section.id,
        blockIds: [block.id],
      }
      deck.push(diapo)
      return { diapo, openedByLead, hasSupport: false, introducing: block.type === 'prose' }
    }

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      const role = roleOf(block)

      if (role === 'exercise') {
        // Rule 5: one exercise per slide, which closes the open slide.
        deck.push({ id: block.id, kind: 'exercice', sectionId: section.id, blockIds: [block.id] })
        open = null
      } else if (role === 'lead') {
        if (open?.introducing && block.type !== 'prose') {
          // Rule 3: the prose introduces this lead, so the lead joins it.
          open.diapo.blockIds.push(block.id)
          open.introducing = false
        } else {
          // Rule 2: a lead opens a new slide.
          open = openSlide(block, true)
        }
      } else {
        const next = blocks[i + 1]
        if (
          role === 'support' &&
          next !== undefined &&
          roleOf(next) === 'exercise' &&
          open?.openedByLead &&
          open.hasSupport
        ) {
          // Rule 6: the lead already has its illustration, so this support is the exercise's data.
          deck.push({
            id: block.id,
            kind: 'exercice',
            sectionId: section.id,
            blockIds: [block.id, next.id],
          })
          open = null
          i++
          continue
        }
        if (open === null) {
          // Rule 4: nothing open (start of a section, after an exercise), so it opens a slide.
          open = openSlide(block, false)
        } else {
          open.diapo.blockIds.push(block.id)
          open.introducing = false
        }
        if (role === 'support') open.hasSupport = true
      }
    }
  })

  // Rule 9.
  deck.push({ id: 'fin', kind: 'fin', blockIds: [] })
  return deck
}
