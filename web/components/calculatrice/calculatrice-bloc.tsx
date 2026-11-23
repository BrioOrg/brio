'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { analyserLignes, modeleVue, type CourbeVue } from '@brio/content'

import { RichTextRenderer } from '@/components/blocs/rich-text'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  adresseExplorer,
  consigneEnTexte,
  etatDepuisBloc,
  type BlocCalculatrice,
} from '@/lib/calculatrice-bloc'
import type { EtatCalculatrice } from '@/lib/calculatrice-etat'
import { renderKatex } from '@/lib/katex'

import { Calculatrice } from './calculatrice'
import { lignesDepuisEtat } from './lignes'
import { CouchesRepere, fenetreEffective } from './repere-interactif'

// The course block `calculatrice` (ADR 0049 §6, #424): Explorer's calculator, compact, with the
// author's starting lines, which the student may change. Its state lives in memory only — the
// chapter's address is never written — and « Revenir au départ » brings the starting lines back.
// « Ouvrir en grand » opens Explorer's calculator on the current state. Printed, the expressions
// and the starting curves, without controls.

/** The printed grid: a fixed size, the screen's measure being meaningless on paper. */
const TAILLE_IMPRIMEE = { largeur: 480, hauteur: 320 }

/** Classes of a link that looks like a secondary button (Button's frame, without its press). */
const LIEN_BOUTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-line px-4 py-2 font-display text-sm font-extrabold text-accent-ink transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page'

export function CalculatriceBloc({
  bloc,
  nouvelOnglet = false,
}: {
  bloc: BlocCalculatrice
  /** In the teacher's editor, Explorer opens in a new tab: the course being written stays. */
  nouvelOnglet?: boolean
}) {
  const depart = useMemo(() => etatDepuisBloc(bloc), [bloc])
  // A new key mounts a new calculator: every line, slider and window back to the start.
  const [tour, setTour] = useState(0)
  const [etat, setEtat] = useState<EtatCalculatrice>(depart)

  const consigne = bloc.consigne?.trim() ? bloc.consigne : undefined
  const nom = consigne ? `Calculatrice : ${consigneEnTexte(consigne)}` : 'Calculatrice'

  return (
    <section id={bloc.id} aria-label={nom} className="my-1 flex flex-col gap-3">
      {consigne && (
        <p className="font-prose text-base leading-relaxed text-ink">
          <RichTextRenderer text={consigne} />
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-line print:hidden">
        <Calculatrice
          key={tour}
          etatInitial={depart}
          synchroniserAdresse={false}
          hauteur="compact"
          onEtat={setEtat}
        />
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11"
          aria-label="Revenir aux expressions de départ"
          onClick={() => {
            setTour((t) => t + 1)
            setEtat(depart)
          }}
        >
          <Icon name="arrow-counter-clockwise" size={16} />
          Revenir au départ
        </Button>
        <Link
          href={adresseExplorer(etat)}
          aria-label="Ouvrir cette calculatrice en grand, dans Explorer"
          className={LIEN_BOUTON}
          {...(nouvelOnglet && { target: '_blank', rel: 'noopener' })}
        >
          <Icon name="corners-out" size={16} />
          Ouvrir en grand
        </Link>
      </div>
      <Impression depart={depart} />
    </section>
  )
}

/** What paper shows: the starting expressions in KaTeX, and the starting curves. */
function Impression({ depart }: { depart: EtatCalculatrice }) {
  const { expressions, modele } = useMemo(() => {
    const lignes = lignesDepuisEtat(depart)
    const analyse = analyserLignes(lignes.map((l) => ({ id: l.id, texte: l.texte })))
    const courbes: CourbeVue[] = []
    lignes.forEach((l, i) => {
      const a = analyse[i]
      const commun = { id: l.id, couleur: l.couleur, pointille: l.style === 'pointille' }
      if (a?.genre === 'explicite') courbes.push({ ...commun, genre: 'explicite', f: a.f })
      else if (a?.genre === 'implicite') courbes.push({ ...commun, genre: 'implicite', F: a.F })
    })
    const fenetre = fenetreEffective(
      depart.fenetre ?? null,
      depart.orthonorme ?? true,
      TAILLE_IMPRIMEE
    )
    return {
      expressions: lignes.map((l, i) => {
        const a = analyse[i]
        const latex = a && 'latex' in a ? a.latex : undefined
        return { id: l.id, texte: l.texte, latex }
      }),
      modele: modeleVue(fenetre, TAILLE_IMPRIMEE, courbes),
    }
  }, [depart])

  return (
    <div aria-hidden="true" data-impression className="hidden flex-col gap-2 print:flex">
      <ul className="flex flex-col gap-1 font-prose text-base text-ink">
        {expressions.map((e) => (
          <li key={e.id}>
            {e.latex ? (
              <span dangerouslySetInnerHTML={{ __html: renderKatex(e.latex, false) }} />
            ) : (
              e.texte
            )}
          </li>
        ))}
      </ul>
      <svg
        viewBox={`0 0 ${modele.largeur} ${modele.hauteur}`}
        className="block w-full max-w-120 text-ink"
      >
        <CouchesRepere modele={modele} />
      </svg>
    </div>
  )
}
