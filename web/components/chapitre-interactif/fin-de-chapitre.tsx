'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { duration } from '@/lib/motion-tokens'
import { bilan, type NiveauCelebration } from '@/lib/bilan'
import { peutAnimer, surTerminer } from './animation'
import { compter, eclater } from './celebration'
import { useModeChapitre } from './mode-context'
import { jouer } from './sons'

/**
 * The end slide (#249): a summary made only of real data. Exercises solved in this session, the
 * XP they really earned, this chapter's completion as `progression` reads it, the exercises left
 * with no answer, the next chapter. A line whose value is unknown, or 0, is not drawn.
 *
 * The celebration is proportionate (MOTION.md "End slide"): the lines arrive as the slide's beats;
 * then the session XP counts up from 0 and the completion moves from its value at the chapter's
 * opening; a chapter where every exercise was solved bursts at the end of the count. Nothing moves
 * under reduced motion: the values are simply there. Any press ends it all (budget rule 4).
 *
 * Each line is a direct child of the slide's frame, so each is one beat.
 */

const TITRE: Record<NiveauCelebration, string> = {
  sobre: 'Fin du chapitre',
  partiel: 'Beau travail !',
  complet: 'Tous les exercices réussis !',
}

/** When the slide's last beat has landed, `n` beats in. */
function finDesTemps(n: number): number {
  return duration.stagger * Math.max(0, n - 1) + duration.beat
}

/**
 * A number shown on the end slide: counted from `depart` to `cible` once the slide opens (after
 * `delaiMs`), then from where it stands whenever a later read changes `cible`. Without animation
 * it is `cible` at once.
 */
function useCompte(cible: number, depart: number, ouverte: boolean, delaiMs: number): number {
  const ctx = useModeChapitre()
  const reduit = ctx?.reducedMotion ?? true
  const [affiche, setAffiche] = useState<number | null>(null)
  const dejaOuverte = useRef(false)
  const courant = useRef(cible)

  useEffect(() => {
    if (!ouverte) {
      dejaOuverte.current = false
      setAffiche(null)
      return
    }
    const entree = !dejaOuverte.current
    dejaOuverte.current = true
    if (!peutAnimer(reduit)) return
    const de = entree ? depart : courant.current
    if (de === cible) return
    setAffiche(de)
    const controls = compter(
      de,
      cible,
      (v) => {
        courant.current = v
        setAffiche(v)
      },
      { duree: 'finale', delaiMs: entree ? delaiMs : 0 }
    )
    if (!controls) return
    void controls.finished.then(() => setAffiche(null))
    // A later read starts a new count from where this one stands.
    return () => controls.stop()
    // `depart` and `delaiMs` matter only on entry, read then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte, cible, reduit])

  courant.current = affiche ?? cible
  return affiche ?? cible
}

export function FinDeChapitre() {
  const ctx = useModeChapitre()
  const eclats = useRef<HTMLSpanElement>(null)

  const ouverte = ctx?.mode === 'interactif' && ctx.deck[ctx.index]?.kind === 'fin'
  const b = ctx
    ? bilan({
        deck: ctx.deck,
        exercices: ctx.exercices,
        vues: ctx.vues,
        sectionTitles: ctx.sectionTitles,
        xpSession: ctx.bilanSession.xpSession,
        completion: ctx.bilanSession.completion,
        suivant: ctx.suivant,
        etatSuivant: ctx.bilanSession.etatSuivant,
      })
    : null

  // The beats before the counts: the title, then each line drawn.
  const temps = b ? 1 + (b.reussis ? 1 : 0) + (b.xp ? 1 : 0) + (b.completion ? 1 : 0) : 0
  const debutCompte = finDesTemps(temps)
  const xp = useCompte(b?.xp ?? 0, 0, ouverte, debutCompte)
  const completion = useCompte(b?.completion?.a ?? 0, b?.completion?.de ?? 0, ouverte, debutCompte)

  // The burst, once per opening, at the end of the count; without XP, at the end of the beats.
  const reduit = ctx?.reducedMotion ?? true
  const complet = b?.niveau === 'complet'
  const avecXp = b?.xp !== undefined
  useEffect(() => {
    if (!ouverte || !complet || !peutAnimer(reduit)) return
    const delai = avecXp ? debutCompte + duration.finale : debutCompte
    const effacer = eclater(eclats.current, delai, true)
    const desinscrire = surTerminer(effacer)
    return () => {
      desinscrire()
      effacer()
    }
    // Once per opening: a value read later does not burst again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte])

  // The sound (#251), as proportionate: none for a chapter only read through, the arpeggio when
  // some exercises were solved, the long one when all were. It lands with the burst, at the end
  // of the count; without animation, at once. A press plays it then. Once per opening.
  const niveau = b?.niveau
  useEffect(() => {
    if (!ouverte || niveau === undefined || niveau === 'sobre') return
    const son = niveau === 'complet' ? 'fin-complet' : 'fin-partiel'
    const delai = !peutAnimer(reduit) ? 0 : avecXp ? debutCompte + duration.finale : debutCompte
    let joue = false
    const jouerFin = () => {
      if (joue) return
      joue = true
      clearTimeout(minuteur)
      jouer(son)
    }
    const minuteur = setTimeout(jouerFin, delai)
    const desinscrire = surTerminer(jouerFin)
    return () => {
      desinscrire()
      clearTimeout(minuteur)
    }
    // Once per opening, like the burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte])

  if (!ctx || !b) return null
  const { chemin, deck, aller, parcoursHref, basculer } = ctx

  return (
    <>
      <div className="relative">
        <h2
          data-diapo-titre
          tabIndex={-1}
          className="font-display text-2xl font-black tracking-tight text-ink focus:outline-none"
        >
          {TITRE[b.niveau]}
        </h2>
        {b.niveau === 'sobre' && (
          <p className="mt-2 font-prose text-base leading-relaxed text-ink">
            Tu as parcouru toutes les diapos de ce chapitre.
          </p>
        )}
        <span
          ref={eclats}
          data-eclats-fin
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2"
        />
      </div>

      {b.reussis !== undefined && (
        <p
          data-bilan="reussis"
          className="flex items-center gap-2 font-display text-lg font-extrabold text-ink"
        >
          <Icon
            name="check"
            weight="bold"
            size={22}
            className="text-accent"
            aria-hidden="true"
          />
          {b.reussis} exercice{b.reussis > 1 ? 's' : ''} réussi{b.reussis > 1 ? 's' : ''}
        </p>
      )}

      {b.xp !== undefined && (
        <p
          data-bilan="xp"
          className="flex items-center gap-2 font-display text-lg font-extrabold text-ink"
        >
          <Icon name="star" weight="bold" size={22} className="text-xp" aria-hidden="true" />
          <span aria-hidden="true" className="tabular-nums">
            +{xp} XP
          </span>
          <span className="sr-only">+{b.xp} XP</span>
          <span className="font-prose text-base font-normal text-ink-muted">gagnés</span>
        </p>
      )}

      {b.completion !== undefined && (
        <div data-bilan="completion" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between font-display text-xs font-extrabold uppercase tracking-widest">
            <span className="text-ink-muted">
              {b.completion.a >= 100 ? 'Chapitre terminé' : 'Ton avancée dans le chapitre'}
            </span>
            <span aria-hidden="true" className="tabular-nums text-accent">
              {completion} %
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={b.completion.a}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progression du chapitre : ${b.completion.a} %`}
            className="h-2 overflow-hidden rounded-pill bg-surface-raised"
          >
            <div
              className="h-full w-full origin-left rounded-pill bg-accent"
              style={{ transform: `scaleX(${completion / 100})` }}
            />
          </div>
        </div>
      )}

      {b.sansReponse.length > 0 && (
        <div data-bilan="sans-reponse" className="flex flex-col gap-2">
          <h3 className="font-display text-base font-extrabold text-ink">Tu veux y revenir ?</h3>
          <ul className="flex flex-col gap-1">
            {b.sansReponse.map(({ diapoId, libelle }) => (
              <li key={diapoId}>
                <a
                  href={`${chemin}?diapo=${encodeURIComponent(diapoId)}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                    e.preventDefault()
                    aller(deck.findIndex((d) => d.id === diapoId))
                  }}
                  className="inline-flex items-center gap-2 rounded-md font-prose text-base text-accent-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Icon name="pencil-simple" size={16} aria-hidden="true" />
                  {libelle}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {b.suivant ? (
          <>
            <Link href={b.suivant.href}>
              <Button size="sm">
                Chapitre suivant : {b.suivant.titre}
                <Icon name="arrow-right" size={16} aria-hidden="true" />
              </Button>
            </Link>
            <Link href={parcoursHref}>
              <Button variant="secondary" size="sm">
                Revenir au parcours
              </Button>
            </Link>
          </>
        ) : (
          <Link href={parcoursHref}>
            <Button size="sm">Revenir au parcours</Button>
          </Link>
        )}
        <Button variant="secondary" size="sm" onClick={basculer}>
          Relire en mode lecture
        </Button>
      </div>
    </>
  )
}
