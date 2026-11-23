'use client'

import { forwardRef, useEffect, useId, useState } from 'react'

import { formatNumber } from '@brio/content'

import { Curseur } from '@/components/curseur'
import { Icon } from '@/components/ui/icon'
import { Infobulle } from '@/components/ui/infobulle'
import type { CurseurEtat } from '@/lib/calculatrice-etat'

import { BOUTON_ICONE, CHAMP, CHAMP_INVALIDE } from './classes'
import { lireNombre } from './lignes'

// The slider of a constant line (spec U4 §4): the shared Curseur, a play button the student alone
// starts, and its minimum, maximum and step, which the student may edit. A bound is applied when
// the field is left or on Enter, and only if the slider stays valid (min < max, step > 0).

type Borne = 'min' | 'max' | 'pas'

const LIBELLES: Record<Borne, string> = { min: 'Minimum', max: 'Maximum', pas: 'Pas' }

function ChampBorne({
  borne,
  nom,
  valeur,
  onValider,
}: {
  borne: Borne
  nom: string
  valeur: number
  onValider: (v: number) => boolean
}) {
  const id = useId()
  const [texte, setTexte] = useState(formatNumber(valeur))
  const [refuse, setRefuse] = useState(false)

  // A bound changed elsewhere (a widened slider) is shown as it is.
  useEffect(() => {
    setTexte(formatNumber(valeur))
    setRefuse(false)
  }, [valeur])

  function valider(): boolean {
    const v = lireNombre(texte)
    const ok = v !== null && onValider(v)
    setRefuse(!ok)
    return ok
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <label htmlFor={id} className="font-display text-xs font-bold text-ink-muted">
        {LIBELLES[borne]}
        <span className="sr-only"> du curseur {nom}</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={texte}
        aria-invalid={refuse || undefined}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={() => {
          // A refused bound goes back to the one in force: on leaving, the field never shows a
          // value the slider does not use.
          if (!valider()) {
            setTexte(formatNumber(valeur))
            setRefuse(false)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            valider()
          }
        }}
        className={[
          CHAMP,
          refuse ? CHAMP_INVALIDE : 'border-line',
          'min-h-11 w-16 px-2 text-center text-sm tabular-nums',
        ].join(' ')}
      />
    </div>
  )
}

export const CurseurConstante = forwardRef<
  HTMLInputElement,
  {
    nom: string
    valeur: number
    curseur: CurseurEtat
    anime: boolean
    onValeur: (v: number) => void
    onCurseur: (c: CurseurEtat) => void
    onAnimer: (anime: boolean) => void
  }
>(function CurseurConstante({ nom, valeur, curseur, anime, onValeur, onCurseur, onAnimer }, ref) {
  const arreter = () => {
    if (anime) onAnimer(false)
  }

  function valider(borne: Borne, v: number): boolean {
    const suivant = { ...curseur, [borne]: v }
    if (
      !(suivant.max > suivant.min) ||
      !(suivant.pas > 0) ||
      suivant.pas > suivant.max - suivant.min
    ) {
      return false
    }
    onCurseur(suivant)
    return true
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex min-h-11 min-w-0 flex-1 items-center">
          <div className="w-full">
            <Curseur
              ref={ref}
              nom={nom}
              min={curseur.min}
              max={curseur.max}
              pas={curseur.pas}
              valeur={valeur}
              label={`Curseur ${nom}`}
              onChange={onValeur}
              onFocus={arreter}
              onKeyDown={arreter}
              onPointerDown={arreter}
            />
          </div>
        </div>
        <Infobulle label={anime ? 'Mettre en pause' : 'Lancer l’animation'}>
          <button
            type="button"
            data-animation
            onClick={() => onAnimer(!anime)}
            aria-label={
              anime
                ? `Mettre en pause l’animation du curseur ${nom}`
                : `Lancer l’animation du curseur ${nom}`
            }
            className={BOUTON_ICONE}
          >
            <Icon name={anime ? 'pause' : 'play'} size={20} />
          </button>
        </Infobulle>
      </div>
      <div className="flex flex-wrap gap-3">
        {(['min', 'max', 'pas'] as const).map((b) => (
          <ChampBorne
            key={b}
            borne={b}
            nom={nom}
            valeur={curseur[b]}
            onValider={(v) => valider(b, v)}
          />
        ))}
      </div>
    </div>
  )
})
