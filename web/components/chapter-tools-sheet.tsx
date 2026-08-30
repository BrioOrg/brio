'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { RailContent, type RailSection } from '@/components/chapter-rail'
import { Icon } from '@/components/ui/icon'

type ChapterToolsSheetProps = {
  sections: RailSection[]
  niveau: string
  matiere: string
  slug: string
}

/**
 * Below the desktop breakpoint the rail becomes a bottom sheet: a fixed trigger
 * bar raises a sheet carrying the same summary + tutor space. Nothing is lost.
 */
export function ChapterToolsSheet({ sections, niveau, matiere, slug }: ChapterToolsSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-pill border border-line bg-surface-raised px-5 py-3 font-display text-sm font-extrabold text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name="book-open" size={18} className="text-accent" aria-hidden="true" />
            Sommaire &amp; tuteur
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 motion-safe:data-[state=open]:animate-[fadeIn_var(--duration-slow)_var(--ease-out)]" />
          <Dialog.Content
            aria-label="Sommaire et tuteur"
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-xl border-t border-line bg-surface-panel px-5 pb-8 pt-4 motion-safe:data-[state=open]:animate-[slideUp_var(--duration-slow)_var(--ease-out)] focus-visible:outline-none"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-pill bg-line" aria-hidden="true" />
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="font-display text-base font-extrabold text-ink">
                Ce chapitre
              </Dialog.Title>
              <Dialog.Close
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon name="x" size={18} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <RailContent
              sections={sections}
              niveau={niveau}
              matiere={matiere}
              slug={slug}
              onNavigate={() => setOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
