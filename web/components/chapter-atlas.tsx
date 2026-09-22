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

// The three real path states (ADR 0022). "neutre" is the honest fallback when we
// don't know the state yet (loading), the student is logged out, or the backend
// sent a state we don't branch on — a reachable node, never a fabricated lock.
type NodeState = 'fait' | 'en_cours' | 'verrouille' | 'neutre'

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
        setStates(new Map(list.map((c) => [c.chapitreId, { etat: c.etat, pourcentage: c.pourcentage }])))
      })
      .catch(() => {
        // Network/parse error → leave neutral rather than guessing a state.
      })
    return () => {
      alive = false
    }
  }, [niveau, matiere])

  function stateOf(slug: string): NodeState {
    const s = states?.get(slug)?.etat
    return s === 'fait' || s === 'en_cours' || s === 'verrouille' ? s : 'neutre'
  }

  const active = chapters.find((c) => stateOf(c.slug) === 'en_cours')
  const allKnownDone =
    states !== null && chapters.length > 0 && chapters.every((c) => stateOf(c.slug) === 'fait')

  const bannerKicker = active
    ? `Chapitre ${active.ordre + 1}`
    : allKnownDone
      ? 'Parcours terminé'
      : matiereLibelle
  const bannerTitle = active ? active.titre : allKnownDone ? 'Bravo, tout est fait ! 🎉' : matiereLibelle

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
          {chapters.map((chapter, i) => (
            <li key={chapter.slug} className={`relative ${ALIGN[i % ALIGN.length]}`}>
              <ChapterNode
                chapter={chapter}
                niveau={niveau}
                matiere={matiere}
                state={stateOf(chapter.slug)}
                pourcentage={states?.get(chapter.slug)?.pourcentage ?? 0}
              />
            </li>
          ))}
        </ol>

        {active && (
          <Mascot
            mood="happy"
            size={92}
            className="pointer-events-none absolute -right-4 top-24 hidden drop-shadow-lg sm:block"
          />
        )}
      </div>
    </div>
  )
}

const STATE_META: Record<
  Exclude<NodeState, 'neutre'>,
  { face: string; edge: string; fg: string; icon: string }
> = {
  fait: { face: 'bg-accent', edge: 'bg-accent-edge', fg: 'text-surface-page', icon: 'check' },
  en_cours: { face: 'bg-accent', edge: 'bg-accent-edge', fg: 'text-surface-page', icon: 'star' },
  verrouille: { face: 'bg-surface-raised', edge: 'bg-line', fg: 'text-ink-muted', icon: 'lock' },
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
  const locked = state === 'verrouille'
  const active = state === 'en_cours'

  const hex =
    state === 'neutre' ? (
      <Hexagon face="bg-accent-soft" edge="bg-line" fg="text-accent-ink">
        <span className="font-display text-base font-black">{chapter.ordre + 1}</span>
      </Hexagon>
    ) : (
      <Hexagon
        face={STATE_META[state].face}
        edge={STATE_META[state].edge}
        fg={STATE_META[state].fg}
        big={active}
        pulse={active}
      >
        <Icon name={STATE_META[state].icon} weight="bold" size={active ? 30 : 26} />
      </Hexagon>
    )

  // A completion bar is shown when the real percentage is known (#82): done
  // chapters read 100 %, in-progress ones their live value. Locked/neutral
  // chapters have no real percentage, so no bar — never a fabricated 0/100.
  const showBar = state === 'fait' || state === 'en_cours'
  const pct = state === 'fait' ? 100 : pourcentage

  // A short status line, also used as the link's accessible name.
  const status =
    state === 'fait'
      ? 'Terminé'
      : state === 'verrouille'
        ? 'Verrouillé'
        : state === 'en_cours'
          ? pourcentage > 0
            ? `${pourcentage} % effectués`
            : 'À commencer'
          : `Lecture ≈ ${chapter.dureeEstimeeMinutes} min`

  const caption = (
    <span className="mt-2 flex max-w-36 flex-col items-center text-center">
      <span
        className={`font-display text-sm font-extrabold leading-tight ${locked ? 'text-ink-muted' : 'text-ink'}`}
      >
        {chapter.titre}
      </span>
      {showBar ? (
        <ProgressBar value={pct} label={status} />
      ) : (
        <span className="mt-0.5 font-prose text-xs text-ink-muted">{status}</span>
      )}
    </span>
  )

  if (locked) {
    return (
      <div
        className="flex flex-col items-center opacity-80"
        aria-disabled="true"
        aria-label={`${chapter.titre} — verrouillé`}
      >
        {hex}
        {caption}
      </div>
    )
  }

  return (
    <Link
      href={href}
      aria-label={`${chapter.titre} — ${status}`}
      className="flex flex-col items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
    >
      {active && (
        <span className="atlas-bubble mb-2 rounded-xl border-2 border-accent-edge bg-accent-soft px-3 py-1.5 font-display text-xs font-extrabold tracking-wide text-accent-ink">
          EN ROUTE
        </span>
      )}
      {hex}
      {caption}
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
    <span className={`relative inline-grid ${size} place-items-center ${pulse ? 'atlas-pulse' : ''}`}>
      <span aria-hidden="true" className={`absolute inset-0 translate-y-1 ${edge}`} style={HEX_CLIP} />
      <span aria-hidden="true" className={`absolute inset-0 ${face}`} style={HEX_CLIP} />
      <span className={`relative ${fg}`}>{children}</span>
    </span>
  )
}
