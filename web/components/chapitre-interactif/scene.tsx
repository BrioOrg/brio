'use client'

import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import type { Diapo } from '@brio/content'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Infobulle, InfobulleProvider } from '@/components/ui/infobulle'
import { libelleDiapo } from '@/lib/diapos'
import { useModeChapitre } from './mode-context'

/**
 * The interactive mode's frame (#245): top bar with the position track, side strip of slides,
 * previous / next controls, and the end slide. Each piece renders nothing in reading mode.
 */

/**
 * Reading mode: the switch to the interactive mode. It stays under the site header while the
 * student scrolls, so switching mid-chapter opens the slide they were reading (ADR 0032 §6).
 */
export function BasculeInteractif() {
  const ctx = useModeChapitre()
  if (!ctx || ctx.mode !== 'lecture') return null
  return (
    <div className="pointer-events-none sticky top-[4.5rem] z-20 mb-6 flex justify-end">
      {/* The secondary button is transparent: the backing keeps text from showing through. */}
      <span className="pointer-events-auto rounded-lg bg-surface-panel">
        <Button variant="secondary" size="sm" data-bascule-interactif onClick={ctx.basculer}>
          <Icon name="slideshow" size={16} aria-hidden="true" />
          Mode interactif
        </Button>
      </span>
    </div>
  )
}

/** Top bar: back to reading, the position in the deck (never a completion), the strip toggle. */
export function BarreScene() {
  const ctx = useModeChapitre()
  if (!ctx || ctx.mode !== 'interactif') return null
  const { deck, index, basculer, bandeRepliee, setBandeRepliee, setTiroirOuvert } = ctx
  const position = `Diapo ${index + 1} sur ${deck.length}`

  return (
    <InfobulleProvider>
      <div className="sticky top-0 z-30 border-b border-line bg-surface-panel">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Infobulle label="Mode lecture (Échap)" side="bottom">
            <button
              type="button"
              onClick={basculer}
              aria-label="Revenir au mode lecture"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon name="x" size={20} aria-hidden="true" />
            </button>
          </Infobulle>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-raised"
              aria-hidden="true"
            >
              <div
                className="h-full w-full origin-left rounded-pill bg-accent transition-transform duration-[var(--duration-slide-in)] ease-[var(--ease-in)]"
                style={{ transform: `scaleX(${(index + 1) / deck.length})` }}
              />
            </div>
            <span className="shrink-0 font-display text-xs font-extrabold tabular-nums text-ink-muted">
              <span className="sr-only">{position}</span>
              <span aria-hidden="true">
                {index + 1} / {deck.length}
              </span>
            </span>
          </div>

          <Infobulle
            label={bandeRepliee ? 'Afficher les diapos' : 'Replier les diapos'}
            side="bottom"
          >
            <button
              type="button"
              onClick={() => setBandeRepliee(!bandeRepliee)}
              aria-label={bandeRepliee ? 'Afficher les diapos' : 'Replier les diapos'}
              aria-expanded={!bandeRepliee}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:flex"
            >
              <Icon name="sidebar-simple" size={20} aria-hidden="true" />
            </button>
          </Infobulle>
          <button
            type="button"
            onClick={() => setTiroirOuvert(true)}
            aria-label="Toutes les diapos"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            <Icon name="list" size={20} aria-hidden="true" />
          </button>
        </div>
        {/* Announces each new slide; the bar above is decorative. */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {position}
        </p>
      </div>
    </InfobulleProvider>
  )
}

const ICONE: Record<Diapo['kind'], string> = {
  debut: 'flag',
  lecon: 'book-open',
  exercice: 'pencil-simple',
  fin: 'flag-checkered',
}

/** The slides grouped as the strip draws them: the opening, each section, the end. */
function groupes(deck: readonly Diapo[]): { cle: string; sectionId?: string; indices: number[] }[] {
  const out: { cle: string; sectionId?: string; indices: number[] }[] = []
  deck.forEach((diapo, i) => {
    const sectionId = 'sectionId' in diapo ? diapo.sectionId : undefined
    const dernier = out[out.length - 1]
    if (sectionId !== undefined && dernier?.sectionId === sectionId) dernier.indices.push(i)
    else out.push({ cle: sectionId ?? diapo.id, sectionId, indices: [i] })
  })
  return out
}

/** One icon per slide, a divider between sections; hovering or focusing names where it leads. */
function ListeDiapos({ onChoisir }: { onChoisir?: () => void }) {
  const ctx = useModeChapitre()
  if (!ctx) return null
  const { deck, index, sectionTitles, chemin, aller } = ctx

  return (
    <InfobulleProvider>
      <div className="flex flex-col items-center gap-2">
        {groupes(deck).map((groupe, g) => (
          <div key={groupe.cle} className="flex flex-col items-center gap-2">
            {g > 0 && <hr className="w-6 border-line" />}
            <ol
              className="flex flex-col items-center gap-1.5"
              aria-label={groupe.sectionId ? sectionTitles[groupe.sectionId] : undefined}
            >
              {groupe.indices.map((i) => {
                const diapo = deck[i]
                const courante = i === index
                const libelle = libelleDiapo(diapo, i, deck.length, sectionTitles)
                return (
                  <li key={diapo.id}>
                    <Infobulle label={libelle} side="right">
                      <a
                        href={`${chemin}?diapo=${encodeURIComponent(diapo.id)}`}
                        aria-label={libelle}
                        aria-current={courante ? 'step' : undefined}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                          e.preventDefault()
                          onChoisir?.()
                          aller(i)
                        }}
                        className={[
                          'flex h-9 w-9 items-center justify-center rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          courante
                            ? 'border-accent-edge bg-accent-soft text-accent-ink'
                            : 'border-transparent text-ink-muted hover:bg-surface-raised hover:text-ink',
                        ].join(' ')}
                      >
                        <Icon
                          name={ICONE[diapo.kind]}
                          size={18}
                          weight={courante ? 'bold' : 'regular'}
                          aria-hidden="true"
                        />
                      </a>
                    </Infobulle>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>
    </InfobulleProvider>
  )
}

/** Desktop: the strip in the left column; it folds away. Below `lg` it lives in a drawer. */
export function BandeDiapos() {
  const ctx = useModeChapitre()
  if (!ctx || ctx.mode !== 'interactif' || ctx.bandeRepliee) return null
  return (
    <nav aria-label="Diapos du chapitre" className="hidden lg:block">
      <div className="sticky top-20 z-10 max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
        <ListeDiapos />
      </div>
    </nav>
  )
}

export function TiroirDiapos() {
  const ctx = useModeChapitre()
  if (!ctx || ctx.mode !== 'interactif') return null
  const { tiroirOuvert, setTiroirOuvert } = ctx
  return (
    <Dialog.Root open={tiroirOuvert} onOpenChange={setTiroirOuvert}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed bottom-0 left-0 top-0 z-50 overflow-y-auto border-r border-line bg-surface-panel px-3 pb-8 pt-4 focus-visible:outline-none lg:hidden"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="font-display text-base font-extrabold text-ink">
              Diapos
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon name="x" size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <nav aria-label="Diapos du chapitre">
            <ListeDiapos onChoisir={() => setTiroirOuvert(false)} />
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Previous and next, under the slide. */
export function CommandesScene() {
  const ctx = useModeChapitre()
  if (!ctx || ctx.mode !== 'interactif') return null
  const { deck, index, suivante, precedente } = ctx
  return (
    <div className="sticky bottom-0 z-20 mt-10 flex items-center justify-between gap-3 border-t border-line bg-surface-page py-3">
      <Button variant="ghost" size="sm" onClick={precedente} disabled={index === 0}>
        <Icon name="arrow-left" size={16} aria-hidden="true" />
        Précédent
      </Button>
      <Button size="sm" onClick={suivante} disabled={index === deck.length - 1}>
        Suivant
        <Icon name="arrow-right" size={16} aria-hidden="true" />
      </Button>
    </div>
  )
}

/**
 * The end slide, until #249 brings its real summary. It says only what is true: the student
 * reached the end of the slides, not that the chapter is done.
 */
export function FinDeChapitre() {
  const ctx = useModeChapitre()
  if (!ctx) return null
  return (
    <div className="flex flex-col items-start gap-4">
      <h2
        data-diapo-titre
        tabIndex={-1}
        className="font-display text-2xl font-black tracking-tight text-ink focus:outline-none"
      >
        Fin du chapitre
      </h2>
      <p className="font-prose text-base leading-relaxed text-ink">
        Tu as parcouru toutes les diapos de ce chapitre.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href={ctx.parcoursHref}>
          <Button size="sm">Revenir au parcours</Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={ctx.basculer}>
          Relire en mode lecture
        </Button>
      </div>
    </div>
  )
}
