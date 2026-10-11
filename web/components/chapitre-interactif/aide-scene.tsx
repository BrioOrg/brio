'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { TuteurEtEntraide } from '@/components/chapter-rail'
import { Icon } from '@/components/ui/icon'
import type { TutorTarget } from '@/lib/api'
import { indexDiapo } from '@/lib/diapos'
import { useModeChapitre } from './mode-context'

type AideSceneProps = {
  target: Extract<TutorTarget, { kind: 'chapitre' }>
  /** Each exercise's `exerciceId`, by block id (`exercicesParBloc`). */
  exercices: Readonly<Record<string, string>>
}

/**
 * The tutor and the class entraide of the interactive mode (#250), whose rail is hidden. A drawer,
 * opened by the floating button or `T`, scoped to the current slide: on an exercise slide the
 * tutor is told which exercise and the entraide shows that exercise's threads; elsewhere both are
 * about the chapter. Closing it leaves the student on the slide they were on.
 */
export function AideScene({ target, exercices }: AideSceneProps) {
  const ctx = useModeChapitre()
  if (!ctx || ctx.mode !== 'interactif') return null
  const { deck, index, aller, aideOuverte, setAideOuverte } = ctx
  const blocs = deck[index].blockIds as readonly string[]
  const exerciceId = blocs.map((id) => exercices[id]).find(Boolean) ?? null

  return (
    <Dialog.Root open={aideOuverte} onOpenChange={setAideOuverte}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 motion-safe:data-[state=open]:animate-[fadeIn_var(--duration-slow)_var(--ease-out)]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-xl border-t border-line bg-surface-panel px-5 pb-8 pt-4 focus-visible:outline-none motion-safe:data-[state=open]:animate-[slideUp_var(--duration-slow)_var(--ease-out)] lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-full lg:max-w-sm lg:rounded-none lg:border-l lg:border-t-0 lg:motion-safe:data-[state=open]:animate-[slideInRight_var(--duration-slow)_var(--ease-out)]">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-display text-base font-extrabold text-ink">
              Besoin d’aide ?
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon name="x" size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Le tuteur et les questions de ta classe, sans quitter la diapo.
          </Dialog.Description>
          <TuteurEtEntraide
            tuteur={{
              target,
              exerciceId,
              // Only an exercise reaches the backend: elsewhere the tutor reads the whole chapter.
              contexte: exerciceId
                ? 'Ta question porte sur cet exercice.'
                : 'Ta question porte sur tout le chapitre.',
              onCitation: (blockId) => {
                setAideOuverte(false)
                aller(indexDiapo(deck, blockId))
              },
            }}
            entraide={
              exerciceId
                ? { portee: 'exercice', porteeRef: exerciceId }
                : { portee: 'chapitre', porteeRef: target.slug }
            }
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** The floating button that opens the drawer, just above the bottom bar. */
export function BoutonAide() {
  const ctx = useModeChapitre()
  if (!ctx || ctx.mode !== 'interactif') return null
  return (
    <button
      type="button"
      onClick={() => ctx.setAideOuverte(true)}
      aria-keyshortcuts="T"
      className="flex items-center gap-2 rounded-pill border border-line bg-surface-raised px-4 py-2.5 font-display text-sm font-extrabold text-ink shadow-lg hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Icon name="chat-circle" size={18} className="text-accent" aria-hidden="true" />
      Aide
    </button>
  )
}
