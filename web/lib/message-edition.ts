import {
  BALISE_MARQUE,
  CURSEUR,
  creerAtomeMaths,
  estAtomeMaths,
  marqueDeBalise,
  type Marque,
} from '@/lib/message-blocs'

/**
 * Edits on the DOM of a composer text zone. `document.execCommand` is not used: it has no highlight
 * a stored message can express, nests bold in italic where the format has one mark per span, and
 * differs per browser. Each function returns the range to select afterwards.
 *
 * Text nodes keep their identity through these edits, which is what lets a selection survive them.
 */

function intervalle(
  debut: Node,
  decalageDebut: number,
  fin: Node = debut,
  decalageFin = decalageDebut
) {
  const range = document.createRange()
  range.setStart(debut, decalageDebut)
  range.setEnd(fin, decalageFin)
  return range
}

export function finDeZone(zone: Element): Range {
  return intervalle(zone, zone.childNodes.length)
}

/** The mark around a node, or null. An element of the zone other than a mark does not count. */
function elementMarque(node: Node, zone: Element): HTMLElement | null {
  for (let n: Node | null = node; n && n !== zone; n = n.parentNode) {
    if (n.nodeType === Node.ELEMENT_NODE && marqueDeBalise((n as Element).tagName)) {
      return n as HTMLElement
    }
  }
  return null
}

export function marqueActive(zone: Element, range: Range): Marque | null {
  const element = elementMarque(range.startContainer, zone)
  return element ? marqueDeBalise(element.tagName) : null
}

export function dansListe(zone: Element, range: Range): boolean {
  for (let n: Node | null = range.startContainer; n && n !== zone; n = n.parentNode) {
    if ((n as Element).tagName === 'LI') return true
  }
  return false
}

function estVide(node: Node): boolean {
  if (estAtomeMaths(node)) return false
  if (node instanceof Element || node instanceof DocumentFragment) {
    if (node.querySelector('[data-latex]')) return false
  }
  return (node.textContent ?? '').replaceAll(CURSEUR, '').trim() === ''
}

/** Whether a zone shows nothing: a bullet still counts, the student asked for it. */
export function zoneVide(zone: Element): boolean {
  return estVide(zone) && zone.querySelector('li') === null
}

/** Takes `node` out of `ancetre`: what stood around it stays in copies of the elements in between. */
function isoler(node: Node, ancetre: Element): void {
  // Read once: `ancetre` itself is replaced on the last turn of the loop.
  const destination = ancetre.parentNode
  while (node.parentNode !== destination) {
    const parent = node.parentNode as Element
    const avant = parent.cloneNode(false) as Element
    const apres = parent.cloneNode(false) as Element
    while (parent.firstChild !== node) avant.append(parent.firstChild as Node)
    while (node.nextSibling) apres.append(node.nextSibling)
    if (avant.hasChildNodes()) parent.before(avant)
    if (apres.hasChildNodes()) parent.after(apres)
    parent.replaceWith(node)
  }
}

function fusionnerVoisins(zone: Element): void {
  const marques = zone.querySelectorAll('strong, b, em, i, mark')
  marques.forEach((element) => {
    const suivant = element.nextSibling
    if (
      suivant?.nodeType === Node.ELEMENT_NODE &&
      marqueDeBalise((suivant as Element).tagName) === marqueDeBalise(element.tagName)
    ) {
      ;(suivant as Element).prepend(...Array.from(element.childNodes))
      element.remove()
    }
  })
}

function textesCouverts(zone: Element, range: Range): Text[] {
  const { startOffset, endOffset } = range
  let { startContainer: debut, endContainer: fin } = range
  if (fin.nodeType === Node.TEXT_NODE && endOffset < (fin as Text).length) {
    ;(fin as Text).splitText(endOffset)
  }
  let decalage = startOffset
  if (debut.nodeType === Node.TEXT_NODE && startOffset > 0) {
    const reste = (debut as Text).splitText(startOffset)
    if (fin === debut) fin = reste
    debut = reste
    decalage = 0
  }
  const couverture = intervalle(
    debut,
    decalage,
    fin,
    fin.nodeType === Node.TEXT_NODE ? (fin as Text).length : endOffset
  )

  const textes: Text[] = []
  const parcours = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT)
  for (let n = parcours.nextNode(); n; n = parcours.nextNode()) {
    const texte = n as Text
    if (texte.parentElement?.closest('[data-latex]') || texte.length === 0) continue
    if (
      couverture.comparePoint(texte, 0) >= 0 &&
      couverture.comparePoint(texte, texte.length) <= 0
    ) {
      textes.push(texte)
    }
  }
  return textes
}

function poserMarque(texte: Text, marque: Marque | null, zone: Element): void {
  const actuelle = elementMarque(texte, zone)
  if (actuelle) isoler(texte, actuelle)
  if (marque) {
    const element = document.createElement(BALISE_MARQUE[marque])
    texte.replaceWith(element)
    element.append(texte)
  }
}

function basculerAuCurseur(zone: Element, range: Range, marque: Marque): Range {
  const actuelle = elementMarque(range.startContainer, zone)
  const curseur = document.createTextNode(CURSEUR)

  if (actuelle) {
    const fin = intervalle(range.startContainer, range.startOffset)
    fin.setEndAfter(actuelle)
    const apres = fin.extractContents()
    // At the end of a span, what was cut is an empty copy of the mark.
    if (!estVide(apres)) actuelle.after(apres)
    const memeMarque = marqueDeBalise(actuelle.tagName) === marque
    const nouveau = memeMarque ? curseur : document.createElement(BALISE_MARQUE[marque])
    if (!memeMarque) nouveau.appendChild(curseur)
    actuelle.after(nouveau)
    if (estVide(actuelle)) actuelle.remove()
  } else {
    const element = document.createElement(BALISE_MARQUE[marque])
    element.append(curseur)
    range.insertNode(element)
  }
  return intervalle(curseur, curseur.length)
}

/**
 * Applies a mark to the selection, or takes it off when all the selected text already has it. A
 * span has one mark in the format, so the new mark replaces the others. With no selection, the mark
 * applies to what the student types next.
 */
export function basculerMarque(zone: Element, range: Range, marque: Marque): Range {
  if (range.collapsed) return basculerAuCurseur(zone, range, marque)

  const textes = textesCouverts(zone, range).filter((t) => t.data.replaceAll(CURSEUR, '') !== '')
  if (textes.length === 0) return range

  const dejaMarques = textes
    .filter((t) => t.data.trim() !== '')
    .every((t) => {
      const element = elementMarque(t, zone)
      return element !== null && marqueDeBalise(element.tagName) === marque
    })
  textes.forEach((t) => poserMarque(t, dejaMarques ? null : marque, zone))
  fusionnerVoisins(zone)

  const dernier = textes[textes.length - 1]
  return intervalle(textes[0], 0, dernier, dernier.length)
}

/** Gives every bit of text directly in the zone its own line, so that lines can be moved around. */
export function assurerLignes(zone: Element): void {
  let ligne: HTMLElement | null = null
  Array.from(zone.childNodes).forEach((node) => {
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : null
    if (element && ['DIV', 'P', 'UL', 'OL'].includes(element.tagName)) {
      ligne = null
      return
    }
    if (!ligne) {
      ligne = document.createElement('div')
      node.before(ligne)
    }
    ligne.append(node)
  })
  if (!zone.firstChild) {
    const vide = document.createElement('div')
    vide.append(document.createElement('br'))
    zone.append(vide)
  }
}

/** A boundary on the zone itself points at one of its children, which lines will replace. */
function borne(zone: Element, node: Node, decalage: number, finale: boolean): [Node, number] {
  if (node !== zone) return [node, decalage]
  const enfant = zone.childNodes[finale ? decalage - 1 : decalage] ?? zone.lastChild
  if (!enfant) return [zone, 0]
  return [enfant, finale ? enfant.childNodes.length : 0]
}

/** The lines of a zone: a paragraph, or an item of a list. */
function unites(zone: Element): Element[] {
  return Array.from(zone.children).flatMap((enfant) =>
    enfant.tagName === 'UL' || enfant.tagName === 'OL' ? Array.from(enfant.children) : [enfant]
  )
}

function uniteDe(zone: Element, node: Node): Element | null {
  const lignes = unites(zone)
  for (let n: Node | null = node; n && n !== zone; n = n.parentNode) {
    if (lignes.includes(n as Element)) return n as Element
  }
  return null
}

function remplacerParElement(ancien: Element, balise: string): HTMLElement {
  const nouveau = document.createElement(balise)
  nouveau.append(...Array.from(ancien.childNodes))
  if (!nouveau.hasChildNodes()) nouveau.append(document.createElement('br'))
  return nouveau
}

/**
 * Turns the selected lines into a bullet list, or back into paragraphs when they all are items.
 * The boundaries are read first: moving a text node would throw a live range out of it.
 */
export function basculerListe(zone: Element, range: Range): Range {
  const [debut, decalageDebut] = borne(zone, range.startContainer, range.startOffset, false)
  const [fin, decalageFin] = borne(zone, range.endContainer, range.endOffset, true)
  assurerLignes(zone)

  const lignes = unites(zone)
  const premiere = uniteDe(zone, debut) ?? lignes[0]
  const derniere = uniteDe(zone, fin) ?? premiere
  const choisies = lignes.slice(lignes.indexOf(premiere), lignes.indexOf(derniere) + 1)
  const toutesEnListe = choisies.every((ligne) => ligne.tagName === 'LI')
  const remplacees = new Map<Node, Node>()

  if (toutesEnListe) {
    Array.from(zone.children)
      .filter((enfant) => choisies.some((ligne) => ligne.parentNode === enfant))
      .forEach((liste) => {
        const suite: Element[] = []
        let courante: Element | null = null
        Array.from(liste.children).forEach((item) => {
          if (choisies.includes(item)) {
            const ligne = remplacerParElement(item, 'div')
            remplacees.set(item, ligne)
            suite.push(ligne)
            courante = null
          } else {
            if (!courante) {
              courante = document.createElement('ul')
              suite.push(courante)
            }
            courante.append(item)
          }
        })
        liste.replaceWith(...suite)
      })
  } else {
    choisies
      .filter((ligne) => ligne.tagName !== 'LI')
      .forEach((ligne) => {
        const item = remplacerParElement(ligne, 'li')
        remplacees.set(ligne, item)
        const liste = document.createElement('ul')
        liste.append(item)
        ligne.replaceWith(liste)
      })
    Array.from(zone.children).forEach((enfant) => {
      const precedent = enfant.previousElementSibling
      if (enfant.tagName === 'UL' && precedent?.tagName === 'UL') {
        enfant.prepend(...Array.from(precedent.childNodes))
        precedent.remove()
      }
    })
  }

  const resoudre = (node: Node, decalage: number): [Node, number] => {
    const nouveau = remplacees.get(node)
    if (nouveau) return [nouveau, Math.min(decalage, nouveau.childNodes.length)]
    return node === zone
      ? [choisies[0] && (remplacees.get(choisies[0]) ?? choisies[0]), 0]
      : [node, decalage]
  }
  const [a, b] = resoudre(debut, decalageDebut)
  const [c, d] = resoudre(fin, decalageFin)
  return intervalle(a, b, c, d)
}

/** Replaces the selection with an inline formula. The invisible character lets the caret follow it. */
export function insererAtome(range: Range, latex: string): Range {
  const curseur = document.createTextNode(CURSEUR)
  range.deleteContents()
  range.insertNode(curseur)
  range.insertNode(creerAtomeMaths(latex))
  return intervalle(curseur, curseur.length)
}

/** Pasted text stays text: a line break opens a new line, whatever the source's formatting. */
export function insererTexte(range: Range, texte: string): Range {
  range.deleteContents()
  const fragment = document.createDocumentFragment()
  let dernier: Node | null = null
  texte.split(/\r?\n/).forEach((ligne, i) => {
    if (i > 0) fragment.append(document.createElement('br'))
    dernier = document.createTextNode(ligne)
    fragment.append(dernier)
  })
  range.insertNode(fragment)
  return dernier ? intervalle(dernier, (dernier as Text).length) : range
}

/** The latex to start from when the student opens the inline maths field over a selection. */
export function latexDeLaSelection(range: Range): string {
  const copie = range.cloneContents()
  const atome = copie.querySelector('[data-latex]') as HTMLElement | null
  if (atome) return atome.dataset.latex ?? ''
  return (copie.textContent ?? '').replaceAll(CURSEUR, '').trim()
}

function retirerLignesVides(zone: Element): void {
  Array.from(zone.childNodes).forEach((node) => {
    if (estVide(node)) node.remove()
  })
}

/**
 * Cuts the zone where a block is inserted: what stands after the selection moves to the zone that
 * follows the block. Partly selected lines, lists and marks are split, not lost.
 */
export function couperApres(zone: Element, range: Range): DocumentFragment {
  const coupe = range.cloneRange()
  coupe.collapse(false)
  coupe.setEnd(zone, zone.childNodes.length)
  const reste = coupe.extractContents()
  retirerLignesVides(zone)
  Array.from(reste.childNodes).forEach((node) => {
    if (estVide(node)) node.remove()
  })
  return reste
}

/** Joins two zones when the block between them goes away: the lines of each stay separate. */
export function joindreZones(zone: Element, suivante: Element): void {
  retirerLignesVides(zone)
  assurerLignes(suivante)
  retirerLignesVides(suivante)
  if (zone.hasChildNodes()) assurerLignes(zone)
  zone.append(...Array.from(suivante.childNodes))
}
