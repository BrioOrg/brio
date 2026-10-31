import { describe, expect, it } from 'vitest'
import { parseRichText, type RichTextToken } from '@brio/content'

import {
  contenusVersFragment,
  creerAtomeMaths,
  zoneVersContenus,
  type ContenuTexte,
} from '@/lib/message-blocs'

function zone(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

function prose(el: Element): string {
  const contenus = zoneVersContenus(el)
  expect(contenus).toHaveLength(1)
  const [contenu] = contenus
  if (contenu.type !== 'prose') throw new Error('expected prose')
  return contenu.text
}

describe('zoneVersContenus', () => {
  it('writes each mark the student applied', () => {
    expect(prose(zone('a <strong>b</strong> <em>c</em> <mark>d</mark>'))).toBe('a **b** *c* ==d==')
  })

  it('reads the tags a browser may add itself', () => {
    expect(prose(zone('<b>a</b> <i>b</i> <span style="color:red">c</span>'))).toBe('**a** *b* c')
  })

  it('makes a paragraph of each line, whatever separates them', () => {
    expect(zoneVersContenus(zone('un<div>deux</div><p>trois</p>quatre<br>cinq'))).toEqual(
      ['un', 'deux', 'trois', 'quatre', 'cinq'].map((text) => ({ type: 'prose', text }))
    )
  })

  it('drops empty lines and items, which the server would refuse', () => {
    expect(
      zoneVersContenus(zone('<div><br></div><div> \u200B </div><ul><li><br></li></ul>'))
    ).toEqual([])
    expect(
      zoneVersContenus(zone('<ul><li>a</li><li></li><li><strong>b</strong></li></ul>'))
    ).toEqual([{ type: 'list', items: ['a', '**b**'] }])
  })

  it('leaves the caret characters out', () => {
    expect(prose(zone('a\u200B<strong>\u200Bb</strong>\u200B'))).toBe('a**b**')
  })

  it('keeps spaces out of the delimiters, or a highlight would not parse', () => {
    expect(prose(zone('a<mark> b </mark>c'))).toBe('a ==b== c')
    expect(prose(zone('a<strong> </strong>b'))).toBe('a b')
  })

  it('merges neighbours with the same mark', () => {
    expect(prose(zone('<strong>a</strong><b>b</b>'))).toBe('**ab**')
  })

  it('cuts a mark around a formula: the format has no mark around maths', () => {
    const el = zone('<strong>a </strong>')
    el.querySelector('strong')?.append(creerAtomeMaths('x^2'), ' b')
    expect(prose(el)).toBe('**a** $x^2$ **b**')
  })

  it('takes a dollar out of inline maths, which it would close', () => {
    expect(prose(zone('<span data-latex="a$b"></span>'))).toBe('$ab$')
  })

  it('never reads the HTML of a formula as text', () => {
    const el = zone('')
    el.append(creerAtomeMaths('\\frac{1}{2}'))
    expect(prose(el)).toBe('$\\frac{1}{2}$')
  })
})

describe('what the student typed comes back unchanged from the parser', () => {
  const cas: [string, string][] = [
    ['an asterisk', 'a * b et 2*3*4'],
    ['a dollar', 'ça coûte 3$ et 4$'],
    ['a double equals', 'a == b et a === b'],
    ['an equals at the end', 'x ='],
    ['a backslash', 'c:\\temp\\* et \\$ et \\= et \\'],
    ['markup typed by hand', '**pas gras** *pas italique* ==pas surligné== $pas maths$'],
  ]

  it.each(cas)('as plain text: %s', (_nom, texte) => {
    const el = document.createElement('div')
    el.append(texte)
    const tokens = parseRichText(prose(el))
    expect(tokens).toHaveLength(1)
    expect(tokens[0].kind).toBe('text')
    expect(tokens[0].value.replaceAll('\u2060', '')).toBe(texte)
  })

  it.each([
    ['strong', 'bold'],
    ['em', 'italic'],
    ['mark', 'highlight'],
  ] as const)('inside <%s>', (balise, kind) => {
    for (const [, texte] of cas) {
      const el = document.createElement('div')
      const marque = document.createElement(balise)
      marque.textContent = texte
      el.append(marque)
      const tokens = parseRichText(prose(el))
      expect(tokens).toHaveLength(1)
      expect(tokens[0].kind).toBe(kind)
      expect(tokens[0].value.replaceAll('\u2060', '')).toBe(texte)
    }
  })

  it('keeps two marks apart when they touch, and a backslash from escaping the next', () => {
    const el = zone('<strong>a=</strong><em>*b</em><mark>=c\\</mark>d=<mark>e</mark>')
    expect(
      parseRichText(prose(el)).map((t: RichTextToken) => [t.kind, t.value.replace('\u2060', '')])
    ).toEqual([
      ['bold', 'a='],
      ['italic', '*b'],
      ['highlight', '=c\\'],
      ['text', 'd='],
      ['highlight', 'e'],
    ])
  })
})

describe('contenusVersFragment', () => {
  it('rebuilds a stored message that reads back the same', () => {
    const contenus: ContenuTexte[] = [
      { type: 'prose', text: 'a **b** *c* ==d== $x^2$ e' },
      { type: 'list', items: ['un', '**deux** $y$'] },
      { type: 'prose', text: '2 \\* 3 et 4\\$' },
    ]
    const el = document.createElement('div')
    el.append(contenusVersFragment(contenus))
    expect(zoneVersContenus(el)).toEqual(contenus)
  })

  it('renders stored text as text, never as HTML', () => {
    const el = document.createElement('div')
    el.append(
      contenusVersFragment([{ type: 'prose', text: '<img src=x onerror=alert(1)> **<b>a</b>**' }])
    )
    expect(el.querySelector('img, b')).toBeNull()
  })
})
