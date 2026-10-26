import type { Diapo } from '@brio/content'
import { etatDiapo } from '@/lib/diapos'

/**
 * The end slide's summary (#249): pure, no React. Made only of real data: what the student did in
 * this session, and what `progression` says. A value the backend did not give, or a 0 that would
 * read as a reproach, is left out, and its line is not drawn: never a fabricated 0.
 */

/** The next chapter of the track, in catalogue order. */
export type ChapitreSuivant = { titre: string; href: string }

export type BilanEntree = {
  deck: readonly Diapo[]
  /** This session's exercises, by block id (the interactive shell's state). */
  exercices: Readonly<Record<string, 'a-faire' | 'tente' | 'resolu'>>
  /** The slides opened in this session. */
  vues: ReadonlySet<string>
  sectionTitles: Readonly<Record<string, string>>
  /** The sum of the real XP gains seen since the chapter opened; null when not a student. */
  xpSession: number | null
  /** This chapter's completion when the chapter opened, and as last read; null when unknown. */
  completion: { avant: number | null; actuelle: number | null }
  suivant: ChapitreSuivant | null
}

/**
 * How much the slide celebrates: `sobre` when nothing was solved (the student read), `partiel`
 * when some exercises were, `complet` when every auto-graded exercise of the chapter was.
 */
export type NiveauCelebration = 'sobre' | 'partiel' | 'complet'

export type ExerciceSansReponse = { diapoId: string; libelle: string }

export type Bilan = {
  /** Exercises solved in this session; absent at 0. */
  reussis?: number
  /** XP earned in this session; absent at 0 or when unknown. */
  xp?: number
  /** Completion in %, from the value at the chapter's opening; absent when unknown. */
  completion?: { de: number; a: number }
  sansReponse: ExerciceSansReponse[]
  /** The main action; absent when there is none, or when the path locks it. */
  suivant?: ChapitreSuivant
  niveau: NiveauCelebration
}

function pourcent(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

export function bilan(e: BilanEntree): Bilan {
  const etats = Object.values(e.exercices)
  const reussis = etats.filter((s) => s === 'resolu').length
  const niveau: NiveauCelebration =
    reussis === 0 ? 'sobre' : reussis === etats.length ? 'complet' : 'partiel'

  // Numbered among the chapter's exercise slides: an exercise has no title of its own.
  const sansReponse: ExerciceSansReponse[] = []
  let numero = 0
  for (const diapo of e.deck) {
    if (diapo.kind !== 'exercice') continue
    numero += 1
    if (etatDiapo(diapo, false, e.exercices, e.vues) !== 'sans-reponse') continue
    const section = e.sectionTitles[diapo.sectionId]
    sansReponse.push({
      diapoId: diapo.id,
      libelle: section ? `Exercice ${numero} · ${section}` : `Exercice ${numero}`,
    })
  }

  const out: Bilan = { sansReponse, niveau }
  if (reussis > 0) out.reussis = reussis
  if (e.xpSession !== null && e.xpSession > 0) out.xp = e.xpSession
  const valeur = e.completion.actuelle ?? e.completion.avant
  if (valeur !== null) {
    out.completion = { de: pourcent(e.completion.avant ?? valeur), a: pourcent(valeur) }
  }
  // Every chapter is open (#278): the next one is offered whatever the path says.
  if (e.suivant) out.suivant = e.suivant
  return out
}
