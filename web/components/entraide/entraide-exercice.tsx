'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { EntraidePanel } from '@/components/entraide/entraide-panel'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

/**
 * The class's questions about one exercise, in a dialog. The panel mounts on open, so a
 * thread read after submitting the exercise comes back unlocked (ADR 0023).
 */
export function EntraideExercice({ exerciceId }: { exerciceId: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="sm" className="-ml-3 mt-3">
          <Icon name="chat-circle" size={16} aria-hidden="true" />
          Questions de la classe
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 motion-safe:data-[state=open]:animate-[fadeIn_var(--duration-slow)_var(--ease-out)]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-xl border-t border-line bg-surface-panel px-5 pb-8 pt-4 focus-visible:outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border motion-safe:data-[state=open]:animate-[fadeIn_var(--duration-slow)_var(--ease-out)]">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="font-display text-base font-extrabold text-ink">
              Entraide sur cet exercice
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon name="x" size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Les questions posées par ta classe sur cet exercice.
          </Dialog.Description>
          <EntraidePanel portee="exercice" porteeRef={exerciceId} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
