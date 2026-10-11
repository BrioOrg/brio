'use client'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { jouer } from '@/components/chapitre-interactif/sons'
import { dureeSon, sons, type NomSon } from '@/lib/sound-tokens'

/* ── Sound tokens demo (#251) ────────────────────────────────────────────────
   Each sound of the interactive mode, played on demand to be judged by ear.
   It plays whatever the student's stored preference: here the click is the
   request. In a chapter, sound stays off until the student turns it on. */

const SONS: readonly (readonly [NomSon, string])[] = [
  ['appui', 'Bouton enfoncé, changement de diapo'],
  ['selection', 'Option choisie, mot placé'],
  ['juste', 'Bonne réponse, avec la coche'],
  ['xp', 'Gain d’XP réel, à l’arrivée sur le compteur'],
  ['fin-partiel', 'Fin de chapitre, des exercices réussis'],
  ['fin-complet', 'Fin de chapitre, tous les exercices réussis'],
]

export function SoundDemo() {
  return (
    <div className="flex flex-col gap-3">
      {SONS.map(([nom, label]) => (
        <div key={nom} className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-prose text-sm text-ink">
            <strong>{label}</strong>
            <br />
            <code className="text-xs text-ink-muted">
              {nom} · {sons[nom].wave} · {sons[nom].notes.length} note
              {sons[nom].notes.length > 1 ? 's' : ''} · {dureeSon(nom)} ms
            </code>
          </span>
          <Button size="sm" variant="secondary" onClick={() => jouer(nom, true)}>
            <Icon name="speaker-high" size={16} aria-hidden="true" />
            Écouter
          </Button>
        </div>
      ))}
    </div>
  )
}
