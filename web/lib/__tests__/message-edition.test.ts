import { describe, expect, it } from 'vitest'

import { zoneVersContenus } from '@/lib/message-blocs'
import {
  basculerListe,
  basculerMarque,
  couperApres,
  insererAtome,
  insererTexte,
  joindreZones,
  latexDeLaSelection,
  marqueActive,
} from '@/lib/message-edition'

function zone(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

/** A range over `texte`, in the first text node holding it. */
function selection(el: Element, texte: string): Range {
  const parcours = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = parcours.nextNode(); n; n = parcours.nextNode()) {
    const i = (n.nodeValue ?? '').indexOf(texte)
    if (i >= 0) {
      const range = document.createRange()
      range.setStart(n, i)
      range.setEnd(n, i + texte.length)
      return range
    }
  }
  throw new Error(`no text: ${texte}`)
}

function curseur(el: Element, apres: string): Range {
  const range = selection(el, apres)
  range.collapse(false)
  return range
}

describe('basculerMarque', () => {
  it('marks the selected words only', () => {
    const el = zone('le grand côté')
    basculerMarque(el, selection(el, 'grand'), 'bold')
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: 'le **grand** côté' }])
  })

  it('returns a selection on the same words, and removes the mark a second time', () => {
    const el = zone('le grand côté')
    const apres = basculerMarque(el, selection(el, 'grand'), 'highlight')
    expect(apres.toString()).toBe('grand')
    basculerMarque(el, apres, 'highlight')
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: 'le grand côté' }])
  })

  it('takes the mark off part of a span, keeping it on the rest', () => {
    const el = zone('<strong>le grand côté</strong>')
    basculerMarque(el, selection(el, 'grand'), 'bold')
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: '**le** grand **côté**' }])
  })

  it('replaces another mark: a span has only one', () => {
    const el = zone('<em>grand</em>')
    basculerMarque(el, selection(el, 'grand'), 'bold')
    expect(el.querySelector('em')).toBeNull()
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: '**grand**' }])
  })

  it('crosses lines, and leaves a formula out of the mark', () => {
    const el = zone('<div>un</div><div>deux <span data-latex="x"></span> trois</div>')
    const range = selection(el, 'un')
    range.setEnd(selection(el, ' trois').endContainer, selection(el, ' trois').endOffset)
    basculerMarque(el, range, 'bold')
    expect(zoneVersContenus(el)).toEqual([
      { type: 'prose', text: '**un**' },
      { type: 'prose', text: '**deux** $x$ **trois**' },
    ])
  })

  it('at the caret, applies to what comes next', () => {
    const el = zone('avant ')
    const apres = basculerMarque(el, curseur(el, 'avant '), 'bold')
    expect(marqueActive(el, apres)).toBe('bold')
    ;(apres.startContainer as Text).appendData('gras')
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: 'avant **gras**' }])
  })

  it('at the caret in a span, leaves it for what comes next', () => {
    const el = zone('<strong>grasfin</strong>')
    const apres = basculerMarque(el, curseur(el, 'gras'), 'bold')
    expect(marqueActive(el, apres)).toBeNull()
    ;(apres.startContainer as Text).appendData(' normal ')
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: '**gras** normal **fin**' }])
  })

  it('at the end of a span, leaves no empty copy of the mark', () => {
    const el = zone('<strong>gras</strong>')
    basculerMarque(el, curseur(el, 'gras'), 'bold')
    expect(el.querySelectorAll('strong')).toHaveLength(1)
  })

  it('at the caret in a span, can switch to another mark', () => {
    const el = zone('<strong>gras</strong>')
    const apres = basculerMarque(el, curseur(el, 'gras'), 'italic')
    expect(marqueActive(el, apres)).toBe('italic')
    ;(apres.startContainer as Text).appendData('ital')
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: '**gras***ital*' }])
  })
})

describe('basculerListe', () => {
  it('turns the line at the caret into an item, keeping its marks', () => {
    const el = zone('<div>intro</div><div>un <strong>gras</strong></div>')
    basculerListe(el, curseur(el, 'un'))
    expect(zoneVersContenus(el)).toEqual([
      { type: 'prose', text: 'intro' },
      { type: 'list', items: ['un **gras**'] },
    ])
  })

  it('wraps text the browser left directly in the zone', () => {
    const el = zone('sans ligne')
    const apres = basculerListe(el, curseur(el, 'sans'))
    expect(zoneVersContenus(el)).toEqual([{ type: 'list', items: ['sans ligne'] }])
    expect(apres.startContainer.textContent).toBe('sans ligne')
  })

  it('opens a list in an empty zone, with the caret inside', () => {
    const el = zone('')
    const range = document.createRange()
    range.setStart(el, 0)
    const apres = basculerListe(el, range)
    expect(el.querySelector('ul li')).not.toBeNull()
    expect((apres.startContainer as Element).closest('li')).not.toBeNull()
  })

  it('makes one list of several selected lines, and joins a list next to them', () => {
    const el = zone('<ul><li>zero</li></ul><div>un</div><div>deux</div>')
    const range = selection(el, 'un')
    const fin = selection(el, 'deux')
    range.setEnd(fin.endContainer, fin.endOffset)
    basculerListe(el, range)
    expect(zoneVersContenus(el)).toEqual([{ type: 'list', items: ['zero', 'un', 'deux'] }])
    expect(el.querySelectorAll('ul')).toHaveLength(1)
  })

  it('takes one item out, splitting the list around it', () => {
    const el = zone('<ul><li>un</li><li>deux</li><li>trois</li></ul>')
    basculerListe(el, curseur(el, 'deux'))
    expect(zoneVersContenus(el)).toEqual([
      { type: 'list', items: ['un'] },
      { type: 'prose', text: 'deux' },
      { type: 'list', items: ['trois'] },
    ])
  })
})

describe('insererAtome', () => {
  it('puts a formula at the caret, and the caret after it', () => {
    const el = zone('avant apres')
    const apres = insererAtome(curseur(el, 'avant '), 'x^2')
    ;(apres.startContainer as Text).appendData('suite ')
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: 'avant $x^2$suite apres' }])
  })

  it('replaces the selected formula when it is edited', () => {
    const el = zone('a ')
    insererAtome(curseur(el, 'a '), 'x')
    const range = document.createRange()
    range.selectNode(el.querySelector('[data-latex]') as Element)
    expect(latexDeLaSelection(range)).toBe('x')
    insererAtome(range, 'y')
    expect(el.querySelectorAll('[data-latex]')).toHaveLength(1)
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: 'a $y$' }])
  })

  it('starts from the selected text', () => {
    const el = zone('voici x^2 ici')
    expect(latexDeLaSelection(selection(el, 'x^2'))).toBe('x^2')
  })
})

describe('insererTexte', () => {
  it('keeps pasted lines apart, with no markup of their own', () => {
    const el = zone('')
    const range = document.createRange()
    range.setStart(el, 0)
    insererTexte(range, '<b>un</b>\r\n**deux**')
    expect(el.querySelector('b')).toBeNull()
    expect(zoneVersContenus(el)).toEqual([
      { type: 'prose', text: '<b>un</b>' },
      { type: 'prose', text: '\\*\\*deux\\*\\*' },
    ])
  })
})

describe('couperApres and joindreZones', () => {
  it('splits a line and its mark at the caret', () => {
    const el = zone('<div>un <strong>grasfin</strong> deux</div><div>trois</div>')
    const reste = couperApres(el, curseur(el, 'gras'))
    const suite = document.createElement('div')
    suite.append(reste)
    expect(zoneVersContenus(el)).toEqual([{ type: 'prose', text: 'un **gras**' }])
    expect(zoneVersContenus(suite)).toEqual([
      { type: 'prose', text: '**fin** deux' },
      { type: 'prose', text: 'trois' },
    ])
  })

  it('splits a list at the caret', () => {
    const el = zone('<ul><li>un</li><li>deux</li></ul>')
    const reste = couperApres(el, curseur(el, 'un'))
    const suite = document.createElement('div')
    suite.append(reste)
    expect(zoneVersContenus(el)).toEqual([{ type: 'list', items: ['un'] }])
    expect(zoneVersContenus(suite)).toEqual([{ type: 'list', items: ['deux'] }])
  })

  it('leaves nothing behind at the end of a line', () => {
    const el = zone('<div>un</div>')
    const reste = couperApres(el, curseur(el, 'un'))
    expect(reste.childNodes).toHaveLength(0)
  })

  it('keeps the lines of two joined zones apart', () => {
    const el = zone('un')
    const suite = zone('deux<div>trois</div>')
    joindreZones(el, suite)
    expect(zoneVersContenus(el)).toEqual([
      { type: 'prose', text: 'un' },
      { type: 'prose', text: 'deux' },
      { type: 'prose', text: 'trois' },
    ])
  })
})
