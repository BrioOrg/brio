'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type Ref,
} from 'react'

import { contenusVersFragment, type ContenuTexte, type Marque } from '@/lib/message-blocs'
import { finDeZone, insererTexte, zoneVide } from '@/lib/message-edition'

export type PoigneeZone = {
  element: () => HTMLDivElement | null
  /** Records an edit made outside typing, as its own undo step. */
  apresEdition: () => void
}

type Props = {
  ref: Ref<PoigneeZone>
  initial: readonly ContenuTexte[] | DocumentFragment
  label: string
  placeholder: string
  onRaccourci: (marque: Marque) => void
  onClicAtome: (atome: HTMLElement) => void
}

const STYLE = [
  'min-h-12 whitespace-pre-wrap break-words rounded-md px-1 py-1 font-prose text-base leading-relaxed text-ink',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  'data-[vide]:before:pointer-events-none data-[vide]:before:text-ink-muted data-[vide]:before:content-[attr(data-placeholder)]',
  '[&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic',
  '[&_mark]:rounded-xs [&_mark]:bg-warning/25 [&_mark]:px-0.5 [&_mark]:text-ink',
  '[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ul]:marker:text-ink-muted',
].join(' ')

const PAUSE_ENTRE_ETAPES_MS = 800
const ETAPES_MAX = 100

/** A text zone of the composer. Its content lives in the DOM: React renders it once, empty. */
export function ZoneTexte({ ref, initial, label, placeholder, onRaccourci, onClicAtome }: Props) {
  const zone = useRef<HTMLDivElement>(null)
  const rempli = useRef(false)
  // Edits go through the DOM, which the browser's own undo does not follow: the zone keeps its own.
  const passe = useRef<string[]>([])
  const futur = useRef<string[]>([])
  const courant = useRef('')
  const derniereFrappe = useRef(0)

  const majVide = useCallback(() => {
    const el = zone.current
    if (el) el.toggleAttribute('data-vide', zoneVide(el))
  }, [])

  const memoriser = useCallback(
    (etapeDistincte: boolean) => {
      const el = zone.current
      if (!el) return
      majVide()
      const html = el.innerHTML
      if (html === courant.current) return
      const maintenant = Date.now()
      if (etapeDistincte || maintenant - derniereFrappe.current > PAUSE_ENTRE_ETAPES_MS) {
        passe.current.push(courant.current)
        if (passe.current.length > ETAPES_MAX) passe.current.shift()
        futur.current = []
      }
      courant.current = html
      derniereFrappe.current = maintenant
    },
    [majVide]
  )

  useImperativeHandle(
    ref,
    () => ({ element: () => zone.current, apresEdition: () => memoriser(true) }),
    [memoriser]
  )

  useLayoutEffect(() => {
    const el = zone.current
    if (!el || rempli.current) return
    rempli.current = true
    el.append(initial instanceof DocumentFragment ? initial : contenusVersFragment(initial))
    courant.current = el.innerHTML
    majVide()
  }, [initial, majVide])

  const rejouer = useCallback(
    (depuis: string[], vers: string[]) => {
      const el = zone.current
      const html = depuis.pop()
      if (!el || html === undefined) return
      vers.push(courant.current)
      // Only ever what this zone held: pasted content comes in as text (see below).
      el.innerHTML = html
      courant.current = html
      majVide()
      const selection = document.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(finDeZone(el))
    },
    [majVide]
  )

  const coller = useCallback(
    (texte: string) => {
      const selection = document.getSelection()
      const el = zone.current
      if (!selection || !el || !texte) return
      const range =
        selection.rangeCount > 0 && el.contains(selection.getRangeAt(0).startContainer)
          ? selection.getRangeAt(0)
          : finDeZone(el)
      const apres = insererTexte(range, texte)
      selection.removeAllRanges()
      selection.addRange(apres)
      memoriser(true)
    },
    [memoriser]
  )

  // Not React's onBeforeInput, which has no inputType. This catches what the keyboard handler
  // cannot: the phone's format menu and paste, and the browser's Edit menu.
  useEffect(() => {
    const el = zone.current
    if (!el) return
    const surAvantSaisie = (e: InputEvent) => {
      switch (e.inputType) {
        case 'formatBold':
          e.preventDefault()
          onRaccourci('bold')
          return
        case 'formatItalic':
          e.preventDefault()
          onRaccourci('italic')
          return
        case 'historyUndo':
          e.preventDefault()
          rejouer(passe.current, futur.current)
          return
        case 'historyRedo':
          e.preventDefault()
          rejouer(futur.current, passe.current)
          return
        case 'insertFromPaste':
        case 'insertFromDrop':
        case 'insertFromYank':
          e.preventDefault()
          coller(e.dataTransfer?.getData('text/plain') ?? e.data ?? '')
          return
        default:
          if (e.inputType.startsWith('format')) e.preventDefault()
      }
    }
    el.addEventListener('beforeinput', surAvantSaisie)
    return () => el.removeEventListener('beforeinput', surAvantSaisie)
  }, [coller, onRaccourci, rejouer])

  return (
    <div
      ref={zone}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      data-vide=""
      contentEditable
      suppressContentEditableWarning
      spellCheck
      className={STYLE}
      onInput={() => memoriser(false)}
      onPaste={(e) => {
        e.preventDefault()
        coller(e.clipboardData.getData('text/plain'))
      }}
      onDrop={(e) => e.preventDefault()}
      onClick={(e) => {
        const atome = (e.target as Element).closest<HTMLElement>('[data-latex]')
        if (atome) onClicAtome(atome)
      }}
      onKeyDown={(e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return
        const touche = e.key.toLowerCase()
        if (touche === 'b' || touche === 'i') {
          e.preventDefault()
          onRaccourci(touche === 'b' ? 'bold' : 'italic')
        } else if (touche === 'z' || touche === 'y') {
          e.preventDefault()
          if (touche === 'z' && !e.shiftKey) rejouer(passe.current, futur.current)
          else rejouer(futur.current, passe.current)
        }
      }}
    />
  )
}
