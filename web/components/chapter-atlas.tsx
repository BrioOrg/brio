'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getParcours } from '@/lib/progression'
import { Icon } from '@/components/ui/icon'
import { Mascot } from '@/components/ui/mascot'

/** A chapter as it comes from the public catalogue (no per-student state). */
export type AtlasChapter = {
  slug: string
  titre: string
  dureeEstimeeMinutes: number
  ordre: number
}

type ChapterAtlasProps = {
  niveau: string
  matiere: string
  matiereLibelle: string
  chapters: AtlasChapter[]
}

// What a node shows (#278). Every chapter is open: there is no lock any more.
// - "fait": the backend says the chapter is complete (ADR 0022), the only "done" claim.
// - "actuel": the first chapter not done, where the mascot stands: the next step.
// - "a_faire": any other chapter not done; it shows its real percentage when it has one.
// - "neutre": no path state (loading, logged out, failed read), never a fabricated one.
// The backend's `en_cours` and `verrouille` both read as "not done" here: the lock it
// still computes is no longer shown.
type NodeState = 'fait' | 'actuel' | 'a_faire' | 'neutre'

const HEX_CLIP = {
  clipPath: 'polygon(25% 2%, 75% 2%, 100% 50%, 75% 98%, 25% 98%, 0 50%)',
}

// Gentle zigzag around the central trail: centre → right → centre → left.
const ALIGN = ['self-center', 'self-end', 'self-center', 'self-start'] as const

export function ChapterAtlas({ niveau, matiere, matiereLibelle, chapters }: ChapterAtlasProps) {
  const [states, setStates] = useState<Map<string, { etat: string; pourcentage: number }> | null>(
    null
  )

  useEffect(() => {
    let alive = true
    getParcours(niveau, matiere)
      .then((list) => {
        if (!alive || !list) return // null = logged out → neutral atlas
        setStates(
          new Map(list.map((c) => [c.chapitreId, { etat: c.etat, pourcentage: c.pourcentage }]))
        )
      })
      .catch(() => {
        // Network/parse error → leave neutral rather than guessing a state.
      })
    return () => {
      alive = false
    }
  }, [niveau, matiere])

  const isDone = (slug: string) => states?.get(slug)?.etat === 'fait'

  // Where the student stands: the first chapter not done. Once every chapter is done,
  // the mascot waits by the last one, at the finish.
  const current = states ? chapters.find((c) => !isDone(c.slug)) : undefined
  const allKnownDone = states !== null && chapters.length > 0 && current === undefined
  const mascotAt = current ?? (allKnownDone ? chapters[chapters.length - 1] : undefined)

  function stateOf(slug: string): NodeState {
    if (!states) return 'neutre'
    if (isDone(slug)) return 'fait'
    return slug === current?.slug ? 'actuel' : 'a_faire'
  }

  const bannerKicker = current
    ? `Chapitre ${current.ordre + 1}`
    : allKnownDone
      ? 'Parcours terminé'
      : matiereLibelle
  const bannerTitle = current
    ? current.titre
    : allKnownDone
      ? 'Bravo, tout est fait ! 🎉'
      : matiereLibelle

  return (
    <div>
      {/* Region banner */}
      <div className="flex items-center gap-3 rounded-2xl bg-accent p-4 [box-shadow:0_5px_0_var(--color-accent-edge)]">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs font-extrabold uppercase tracking-widest text-surface-page/80">
            {bannerKicker}
          </p>
          <p className="mt-0.5 truncate font-display text-lg font-black text-surface-page">
            {bannerTitle}
          </p>
        </div>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-page/15 text-surface-page"
          aria-hidden="true"
        >
          <Icon name="compass" weight="bold" size={22} />
        </span>
      </div>

      {/* Trail */}
      <div className="relative mx-auto mt-8 max-w-xs">
        <ol className="atlas-trail relative flex flex-col items-center gap-7 py-2">
          {chapters.map((chapter, i) => {
            const align = ALIGN[i % ALIGN.length]
            return (
              <li key={chapter.slug} className={`relative ${align}`}>
                <ChapterNode
                  chapter={chapter}
                  niveau={niveau}
                  matiere={matiere}
                  state={stateOf(chapter.slug)}
                  pourcentage={states?.get(chapter.slug)?.pourcentage ?? 0}
                />
                {mascotAt?.slug === chapter.slug && (
                  // Beside its node, on the side of the trail that has room for it.
                  <span
                    data-mascotte=""
                    aria-hidden="true"
                    className={`pointer-events-none absolute top-0 hidden drop-shadow-lg sm:block ${
                      align === 'self-end' ? 'right-full mr-2' : 'left-full ml-2'
                    }`}
                  >
                    <Mascot mood="happy" size={92} />
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function ChapterNode({
  chapter,
  niveau,
  matiere,
  state,
  pourcentage,
}: {
  chapter: AtlasChapter
  niveau: string
  matiere: string
  state: NodeState
  pourcentage: number
}) {
  const href = `/${niveau}/${matiere}/${chapter.slug}`
  const done = state === 'fait'
  const current = state === 'actuel'

  // Done: the mockup's solid green hexagon with a check. Current: the big pulsing star.
  // Every other chapter: a soft hexagon with its number, as open as the rest.
  const hex = done ? (
    <Hexagon face="bg-accent" edge="bg-accent-edge" fg="text-surface-page">
      <Icon name="check" weight="bold" size={26} />
    </Hexagon>
  ) : current ? (
    <Hexagon face="bg-accent" edge="bg-accent-edge" fg="text-surface-page" big pulse>
      <Icon name="star" weight="bold" size={30} />
    </Hexagon>
  ) : (
    <Hexagon face="bg-accent-soft" edge="bg-line" fg="text-accent-ink">
      <span className="font-display text-base font-black">{chapter.ordre + 1}</span>
    </Hexagon>
  )

  // A completion bar only for a real percentage (#82): done chapters read 100 %, the
  // others their live value once started. No path state → no bar, never a fabricated 0/100.
  const started = state !== 'neutre' && !done && pourcentage > 0
  const showBar = done || started
  const pct = done ? 100 : pourcentage

  // A short status line, also used as the link's accessible name.
  const status = done
    ? 'Terminé'
    : started
      ? `${pourcentage} % effectués`
      : current
        ? 'À commencer'
        : `Lecture ≈ ${chapter.dureeEstimeeMinutes} min`

  return (
    <Link
      href={href}
      aria-label={`${chapter.titre} — ${status}`}
      className="flex flex-col items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
    >
      {current && (
        <span className="atlas-bubble mb-2 rounded-xl border-2 border-accent-edge bg-accent-soft px-3 py-1.5 font-display text-xs font-extrabold tracking-wide text-accent-ink">
          EN ROUTE
        </span>
      )}
      {hex}
      <span className="mt-2 flex max-w-36 flex-col items-center text-center">
        <span className="font-display text-sm font-extrabold leading-tight text-ink">
          {chapter.titre}
        </span>
        {showBar ? (
          <ProgressBar value={pct} label={status} />
        ) : (
          <span className="mt-0.5 font-prose text-xs text-ink-muted">{status}</span>
        )}
      </span>
    </Link>
  )
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <span className="mt-1.5 flex w-full flex-col items-center gap-1">
      <span
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avancement ${value} %`}
      >
        <span className="block h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </span>
      <span className="font-prose text-xs text-ink-muted">{label}</span>
    </span>
  )
}

function Hexagon({
  face,
  edge,
  fg,
  big,
  pulse,
  children,
}: {
  face: string
  edge: string
  fg: string
  big?: boolean
  pulse?: boolean
  children: React.ReactNode
}) {
  const size = big ? 'h-20 w-20' : 'h-16 w-16'
  return (
    <span
      className={`relative inline-grid ${size} place-items-center ${pulse ? 'atlas-pulse' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-0 translate-y-1 ${edge}`}
        style={HEX_CLIP}
      />
      <span aria-hidden="true" className={`absolute inset-0 ${face}`} style={HEX_CLIP} />
      <span className={`relative ${fg}`}>{children}</span>
    </span>
  )
}
