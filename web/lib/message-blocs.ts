import { parseRichText } from '@brio/content'

import { renderKatex } from '@/lib/katex'

/**
 * Between the DOM of the message composer and the blocks of a Communauté message (ADR 0035 §2-3).
 * The student never sees the markup: this module writes it, and escapes what they type so that a
 * literal `*` or `$` stays a character. The parser allows one mark per span and no mark around a
 * formula, so a run is cut wherever that would happen.
 */

export type Marque = 'bold' | 'italic' | 'highlight'

/** What a text zone holds: paragraphs and bullet lists. */
export type ContenuTexte = { type: 'prose'; text: string } | { type: 'list'; items: string[] }

/** The body the API accepts (`CorpsCommunaute.java`): every block carries a unique id. */
export type BlocMessage =
  | { id: string; type: 'prose'; text: string }
  | { id: string; type: 'formula'; latex: string }
  | { id: string; type: 'code'; code: string; language?: string }
  | { id: string; type: 'list'; items: string[] }

export const BALISE_MARQUE: Record<Marque, string> = {
  bold: 'strong',
  italic: 'em',
  highlight: 'mark',
}

const MARQUE_DE_BALISE: Record<string, Marque> = {
  STRONG: 'bold',
  B: 'bold',
  EM: 'italic',
  I: 'italic',
  MARK: 'highlight',
}

const DELIMITEUR: Record<Marque, string> = { bold: '**', italic: '*', highlight: '==' }

const BLOCS_DE_LIGNE = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE'])

/** The zero-width characters that give the caret a place to sit (see message-edition.ts). */
export const CURSEUR = '\u200B'
const INVISIBLES = /[\u200B\uFEFF]/g
/** Keeps a backslash that ends a run from escaping the delimiter that follows it. */
const SEPARATEUR_INVISIBLE = '\u2060'

export function marqueDeBalise(tagName: string): Marque | null {
  return MARQUE_DE_BALISE[tagName] ?? null
}

export function estAtomeMaths(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.latex !== undefined
}

/** A dollar would close the inline span: the parser has no escape inside `$…$`. */
export function nettoyerLatexEnLigne(latex: string): string {
  return latex.replaceAll('$', '').trim()
}

type Morceau = { marque: Marque | null; text: string } | { latex: string }

function echapper(text: string, marque: Marque | null): string {
  const egal = marque === 'highlight' ? /=/g : /=(?==|$)|(?<=\\)=/g
  const echappe = text.replace(/[*$]/g, '\\$&').replace(egal, '\\=')
  return echappe.endsWith('\\') ? echappe + SEPARATEUR_INVISIBLE : echappe
}

function serialiser(morceaux: Morceau[]): string {
  const fusionnes: Morceau[] = []
  for (const morceau of morceaux) {
    if ('latex' in morceau) {
      const latex = nettoyerLatexEnLigne(morceau.latex)
      if (latex) fusionnes.push({ latex })
      continue
    }
    const text = morceau.text.replace(INVISIBLES, '').replace(/[\u00A0\n\r\t]/g, ' ')
    if (!text) continue
    const dernier = fusionnes.at(-1)
    if (dernier && 'text' in dernier && dernier.marque === morceau.marque) {
      dernier.text += text
    } else {
      fusionnes.push({ marque: morceau.marque, text })
    }
  }

  let sortie = ''
  for (const morceau of fusionnes) {
    if ('latex' in morceau) {
      sortie += `$${morceau.latex}$`
    } else if (morceau.marque === null) {
      sortie += echapper(morceau.text, null)
    } else {
      // A highlight refuses a space next to its delimiter: spaces stay outside every mark.
      const [, avant, coeur, apres] = /^(\s*)(.*?)(\s*)$/s.exec(morceau.text) as RegExpExecArray
      const delimiteur = DELIMITEUR[morceau.marque]
      sortie += avant
      if (coeur) sortie += delimiteur + echapper(coeur, morceau.marque) + delimiteur
      sortie += apres
    }
  }
  return sortie.trim()
}

function morceauxDe(node: Node, marque: Marque | null, sortie: Morceau[]): void {
  node.childNodes.forEach((enfant) => {
    if (enfant.nodeType === Node.TEXT_NODE) {
      sortie.push({ marque, text: enfant.nodeValue ?? '' })
    } else if (estAtomeMaths(enfant)) {
      sortie.push({ latex: enfant.dataset.latex ?? '' })
    } else if (enfant.nodeType === Node.ELEMENT_NODE) {
      const element = enfant as HTMLElement
      if (element.tagName === 'BR' || BLOCS_DE_LIGNE.has(element.tagName)) {
        sortie.push({ marque: null, text: ' ' })
      }
      morceauxDe(element, marqueDeBalise(element.tagName) ?? marque, sortie)
    }
  })
}

function itemsDeListe(liste: Element): string[] {
  return Array.from(liste.children)
    .map((item) => {
      const morceaux: Morceau[] = []
      morceauxDe(item, null, morceaux)
      return serialiser(morceaux)
    })
    .filter((item) => item !== '')
}

/**
 * Reads whatever a browser left in the zone: bare text, `div`, `p`, `br`, `span`. Empty paragraphs
 * and list items are dropped, since the server rejects a blank block.
 */
export function zoneVersContenus(zone: Element): ContenuTexte[] {
  const contenus: ContenuTexte[] = []
  let ligne: Morceau[] = []

  const finirLigne = () => {
    const text = serialiser(ligne)
    ligne = []
    if (text) contenus.push({ type: 'prose', text })
  }

  const parcourir = (node: Node, marque: Marque | null) => {
    node.childNodes.forEach((enfant) => {
      if (enfant.nodeType === Node.TEXT_NODE) {
        ligne.push({ marque, text: enfant.nodeValue ?? '' })
      } else if (estAtomeMaths(enfant)) {
        ligne.push({ latex: enfant.dataset.latex ?? '' })
      } else if (enfant.nodeType === Node.ELEMENT_NODE) {
        const element = enfant as HTMLElement
        if (element.tagName === 'BR') {
          finirLigne()
        } else if (element.tagName === 'UL' || element.tagName === 'OL') {
          finirLigne()
          const items = itemsDeListe(element)
          if (items.length > 0) contenus.push({ type: 'list', items })
        } else if (BLOCS_DE_LIGNE.has(element.tagName)) {
          finirLigne()
          parcourir(element, marque)
          finirLigne()
        } else {
          parcourir(element, marqueDeBalise(element.tagName) ?? marque)
        }
      }
    })
  }

  parcourir(zone, null)
  finirLigne()
  return contenus
}

export function creerAtomeMaths(latex: string): HTMLElement {
  const atome = document.createElement('span')
  atome.dataset.latex = latex
  atome.contentEditable = 'false'
  atome.setAttribute('role', 'img')
  atome.setAttribute('aria-label', `Formule : ${latex}`)
  atome.className = 'cursor-pointer rounded-xs hover:bg-accent-soft'
  // renderKatex returns escaped or KaTeX-built HTML, under the limits of lib/katex.ts.
  atome.innerHTML = renderKatex(latex, false)
  return atome
}

function ajouterTexteRiche(parent: Element, text: string): void {
  for (const token of parseRichText(text)) {
    if (token.kind === 'text') {
      parent.append(token.value)
    } else if (token.kind === 'math') {
      parent.append(creerAtomeMaths(token.value), CURSEUR)
    } else {
      const element = document.createElement(BALISE_MARQUE[token.kind])
      element.textContent = token.value
      parent.append(element)
    }
  }
}

/** The way back, to edit a stored message: nothing here goes through `innerHTML` but KaTeX. */
export function contenusVersFragment(contenus: readonly ContenuTexte[]): DocumentFragment {
  const fragment = document.createDocumentFragment()
  for (const contenu of contenus) {
    if (contenu.type === 'prose') {
      const ligne = document.createElement('div')
      ajouterTexteRiche(ligne, contenu.text)
      fragment.append(ligne)
    } else {
      const liste = document.createElement('ul')
      for (const item of contenu.items) {
        const li = document.createElement('li')
        ajouterTexteRiche(li, item)
        liste.append(li)
      }
      fragment.append(liste)
    }
  }
  return fragment
}
