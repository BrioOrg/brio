'use client'

import { useId, useMemo, useState } from 'react'

import {
  CALCULATRICE_CONSIGNE_MAX,
  CALCULATRICE_MAX_EXPRESSIONS,
  checkCalculatrice,
} from '@brio/content'

import { CalculatriceBloc } from '@/components/calculatrice/calculatrice-bloc'
import { lireNombre } from '@/components/calculatrice/lignes'
import { marqueChamp, marqueGroupe, useChamp } from '@/components/prof/problemes-du-bloc'
import { type BlocCalculatrice } from '@/lib/calculatrice-bloc'
import { LIGNES_MAX } from '@/lib/calculatrice-etat'
import { type Bloc } from '@/lib/cours-editeur'

// Formulaire du bloc « Calculatrice » (ADR 0049 §6, #424). L'enseignant écrit la consigne, les
// expressions de départ (dans la langue de la calculatrice, pas en LaTeX) et, s'il le veut, la
// fenêtre. Les règles de check-content (calculatrice-rules.ts) sont rejouées à chaque frappe :
// le message d'une expression est celui du moteur. L'aperçu est le bloc que verra l'élève ; il
// repart des expressions écrites à chaque modification.

type Props = {
  bloc: Bloc
  onModifier: (patch: Record<string, unknown>) => void
  onFocusBloc?: () => void
}

type Fenetre = { x: [number, number]; y: [number, number] }
type Bornes = [string, string, string, string]

const etiquette = 'font-display text-xs font-bold uppercase tracking-wide text-ink-muted'
const champTexte = `w-full rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none ${marqueChamp}`
const champBorne = `w-16 rounded-md border border-line bg-surface-page px-2 py-1 text-center font-prose text-sm tabular-nums text-ink focus:border-accent focus:outline-none ${marqueChamp}`
const erreurTexte = 'font-prose text-xs text-danger'

function bornesDe(fenetre: unknown): Bornes {
  const f = fenetre as Partial<Fenetre> | undefined
  const t = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
  return [t(f?.x?.[0]), t(f?.x?.[1]), t(f?.y?.[0]), t(f?.y?.[1])]
}

/** Les quatre bornes saisies : pas de fenêtre si toutes sont vides ; NaN pour une borne illisible. */
function fenetreDe(bornes: Bornes): Fenetre | undefined {
  if (bornes.every((b) => b.trim() === '')) return undefined
  const [a, b, c, d] = bornes.map((v) => lireNombre(v) ?? Number.NaN)
  return { x: [a, b], y: [c, d] }
}

function fenetreLisible(f: unknown): f is Fenetre {
  const ok = (v: unknown) =>
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    v[0] < v[1]
  const g = f as Partial<Fenetre> | undefined
  return !!g && ok(g.x) && ok(g.y)
}

export function CalculatriceEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const { champ, groupe } = useChamp()
  const base = useId()
  const consigne = typeof bloc.consigne === 'string' ? bloc.consigne : ''
  const expressions = (Array.isArray(bloc.expressions) ? bloc.expressions : []).map((e) =>
    typeof e === 'string' ? e : ''
  )
  // Les bornes telles que tapées (« - », « 2, ») : le bloc ne garde que des nombres.
  const [bornes, setBornes] = useState<Bornes>(() => bornesDe(bloc.fenetre))

  const problemes = useMemo(
    () => checkCalculatrice({ consigne, expressions, fenetre: bloc.fenetre }),
    [consigne, expressions, bloc.fenetre]
  )
  const message = (path: string) => problemes.find((p) => p.path === path)?.message
  const erreurFenetre = problemes.find((p) => p.path.startsWith('fenetre'))?.message

  const majExpressions = (next: string[]) => onModifier({ expressions: next })
  const majBorne = (i: number, v: string) => {
    const next = bornes.map((b, j) => (j === i ? v : b)) as Bornes
    setBornes(next)
    onModifier({ fenetre: fenetreDe(next) })
  }
  const decrit = (props: { 'aria-describedby'?: string }, erreurId?: string) =>
    [props['aria-describedby'], erreurId].filter(Boolean).join(' ') || undefined

  // L'aperçu : ce que verra l'élève, la fenêtre seulement quand elle est lisible.
  const apercu: BlocCalculatrice | null =
    expressions.length > 0
      ? {
          id: `apercu-${bloc.id}`,
          type: 'calculatrice',
          ...(consigne.trim() && { consigne }),
          expressions: expressions.slice(0, LIGNES_MAX),
          ...(fenetreLisible(bloc.fenetre) && { fenetre: bloc.fenetre }),
        }
      : null
  const cleApercu = JSON.stringify([apercu?.expressions, apercu?.fenetre])

  const consigneId = `${base}-consigne`
  const consigneErreur = message('consigne')
  const consigneProps = champ('consigne')
  const nombreErreur = message('expressions')
  const fenetreErreurId = `${base}-fenetre-erreur`
  const nombreErreurId = `${base}-nombre-erreur`

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <span className="mb-3 block font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
        Calculatrice
      </span>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={etiquette}>
              Consigne ({CALCULATRICE_CONSIGNE_MAX} caractères au maximum)
            </span>
            <textarea
              rows={2}
              className={champTexte}
              value={consigne}
              onChange={(e) => onModifier({ consigne: e.target.value })}
              onFocus={onFocusBloc}
              placeholder="Ex. Déplace le curseur $a$. Que se passe-t-il quand $a$ est négatif ?"
              {...consigneProps}
              aria-invalid={consigneErreur ? true : consigneProps['aria-invalid']}
              aria-describedby={decrit(consigneProps, consigneErreur ? consigneId : undefined)}
            />
            {consigneErreur && (
              <span id={consigneId} className={erreurTexte}>
                {consigneErreur}
              </span>
            )}
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className={`mb-1 ${etiquette}`}>
              Expressions ({CALCULATRICE_MAX_EXPRESSIONS} au maximum)
            </legend>
            <ol
              className={`flex flex-col gap-2 ${marqueGroupe}`}
              {...groupe('expressions')}
              aria-describedby={nombreErreur ? nombreErreurId : undefined}
            >
              {expressions.map((texte, i) => {
                const path = `expressions[${i}]`
                const erreur = message(path)
                const erreurId = `${base}-expression-${i}`
                const props = champ(path)
                return (
                  <li key={i} className="flex flex-col gap-1 border-l-2 border-line pl-3">
                    <div className="flex items-center gap-2">
                      <input
                        className={`${champTexte} tabular-nums`}
                        aria-label={`Expression ${i + 1}`}
                        value={texte}
                        onChange={(e) =>
                          majExpressions(expressions.map((x, j) => (j === i ? e.target.value : x)))
                        }
                        onFocus={onFocusBloc}
                        placeholder={
                          i === 0 ? 'Par exemple\u00a0: y = 2x + 1' : 'Écris une expression'
                        }
                        inputMode="text"
                        autoCapitalize="off"
                        autoComplete="off"
                        spellCheck={false}
                        {...props}
                        aria-invalid={erreur ? true : props['aria-invalid']}
                        aria-describedby={decrit(props, erreur ? erreurId : undefined)}
                      />
                      <button
                        type="button"
                        aria-label={`Supprimer l’expression ${i + 1}`}
                        onClick={() => majExpressions(expressions.filter((_, j) => j !== i))}
                        disabled={expressions.length <= 1}
                        className="shrink-0 text-ink-muted hover:text-danger disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </div>
                    {erreur && (
                      <p id={erreurId} className={erreurTexte}>
                        {erreur}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
            {nombreErreur && (
              <p id={nombreErreurId} className={erreurTexte}>
                {nombreErreur}
              </p>
            )}
            <button
              type="button"
              onClick={() => majExpressions([...expressions, ''])}
              disabled={expressions.length >= CALCULATRICE_MAX_EXPRESSIONS}
              className="self-start font-display text-sm font-bold text-accent-ink hover:underline disabled:opacity-30"
            >
              ＋ Ajouter une expression
            </button>
          </fieldset>

          <div
            role="group"
            aria-label="Fenêtre"
            className={`flex flex-col gap-1 ${marqueGroupe}`}
            {...groupe('fenetre')}
            aria-describedby={erreurFenetre ? fenetreErreurId : undefined}
          >
            {/* La phrase de U5, ses quatre nombres saisis à leur place. */}
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-2 font-prose text-sm text-ink">
              <span>Fenêtre&nbsp;: x de</span>
              <input
                className={champBorne}
                aria-label="Minimum de x"
                inputMode="decimal"
                value={bornes[0]}
                onChange={(e) => majBorne(0, e.target.value)}
                onFocus={onFocusBloc}
                {...champ('fenetre.x')}
              />
              <span>à</span>
              <input
                className={champBorne}
                aria-label="Maximum de x"
                inputMode="decimal"
                value={bornes[1]}
                onChange={(e) => majBorne(1, e.target.value)}
                onFocus={onFocusBloc}
                {...champ('fenetre.x')}
              />
              <span>&nbsp;; y de</span>
              <input
                className={champBorne}
                aria-label="Minimum de y"
                inputMode="decimal"
                value={bornes[2]}
                onChange={(e) => majBorne(2, e.target.value)}
                onFocus={onFocusBloc}
                {...champ('fenetre.y')}
              />
              <span>à</span>
              <input
                className={champBorne}
                aria-label="Maximum de y"
                inputMode="decimal"
                value={bornes[3]}
                onChange={(e) => majBorne(3, e.target.value)}
                onFocus={onFocusBloc}
                {...champ('fenetre.y')}
              />
            </p>
            {erreurFenetre && (
              <p id={fenetreErreurId} className={erreurTexte}>
                {erreurFenetre}
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <span className={etiquette}>Aperçu</span>
          <div className="mt-2">
            {apercu && <CalculatriceBloc key={cleApercu} bloc={apercu} nouvelOnglet />}
          </div>
        </div>
      </div>
    </div>
  )
}
