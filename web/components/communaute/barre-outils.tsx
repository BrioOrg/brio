'use client'

import { useRef, useState, type KeyboardEvent } from 'react'

import { Icon } from '@/components/ui/icon'
import type { Marque } from '@/lib/message-blocs'

export type Outil = Marque | 'liste' | 'maths' | 'formule' | 'code' | 'scratch'

type DefinitionOutil = { outil: Outil; label: string; icone: string; court?: string }

// The palette of ADR 0035 §3, nothing else. Blocks and inline maths also show a word: on a phone no
// tooltip explains an icon to a student of 11.
const OUTILS: DefinitionOutil[] = [
  { outil: 'bold', label: 'Gras', icone: 'text-b' },
  { outil: 'italic', label: 'Italique', icone: 'text-italic' },
  { outil: 'highlight', label: 'Surligner', icone: 'highlighter' },
  { outil: 'liste', label: 'Liste à puces', icone: 'list-bullets' },
  { outil: 'maths', label: 'Maths en ligne', icone: 'function', court: 'Maths' },
  { outil: 'formule', label: 'Formule', icone: 'math-operations', court: 'Formule' },
  { outil: 'code', label: 'Code', icone: 'code', court: 'Code' },
  { outil: 'scratch', label: 'Programme Scratch', icone: 'puzzle-piece', court: 'Scratch' },
]

type Props = {
  /** The mark and list state at the caret, for `aria-pressed`. */
  marque: Marque | null
  liste: boolean
  onOutil: (outil: Outil) => void
}

/** The ARIA toolbar pattern: one tab stop, the arrow keys move between the tools. */
export function BarreOutils({ marque, liste, onOutil }: Props) {
  const [actif, setActif] = useState(0)
  const boutons = useRef<(HTMLButtonElement | null)[]>([])

  function surTouche(e: KeyboardEvent<HTMLDivElement>) {
    const dernier = OUTILS.length - 1
    const cibles: Record<string, number> = {
      ArrowRight: actif === dernier ? 0 : actif + 1,
      ArrowLeft: actif === 0 ? dernier : actif - 1,
      Home: 0,
      End: dernier,
    }
    const cible = cibles[e.key]
    if (cible === undefined) return
    e.preventDefault()
    setActif(cible)
    boutons.current[cible]?.focus()
  }

  return (
    <div
      role="toolbar"
      aria-label="Mise en forme"
      onKeyDown={surTouche}
      className="flex flex-wrap items-center gap-1 border-b border-line p-1.5"
    >
      {OUTILS.map(({ outil, label, icone, court }, i) => {
        const bascule =
          outil === 'liste' || outil === 'bold' || outil === 'italic' || outil === 'highlight'
        const presse = outil === 'liste' ? liste : outil === marque
        return (
          <button
            key={outil}
            ref={(el) => {
              boutons.current[i] = el
            }}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={bascule ? presse : undefined}
            tabIndex={i === actif ? 0 : -1}
            // Keeps the student's selection in the text while the tool applies.
            onMouseDown={(e) => e.preventDefault()}
            onFocus={() => setActif(i)}
            onClick={() => onOutil(outil)}
            className={[
              'flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 font-display text-sm font-bold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              bascule && presse
                ? 'bg-accent-soft text-accent-ink'
                : 'text-ink-muted hover:bg-surface-panel hover:text-ink',
            ].join(' ')}
          >
            <Icon name={icone} weight="bold" size={20} />
            {court && <span>{court}</span>}
          </button>
        )
      })}
    </div>
  )
}
