'use client'

import {
  parseExpression,
  type FigureFunction,
  type FigureParameter,
  type FigureReading,
  type FigureSpec,
} from '@brio/content'

import { ChoixTeinte } from '@/components/prof/choix-teinte'
import { marqueChamp, useChamp } from '@/components/prof/problemes-du-bloc'

// Les fonctions d'une figure à repère (ADR 0038) : une courbe par expression, des lectures
// (image, antécédents) et des curseurs pour les paramètres. L'expression est relue à chaque
// frappe : son erreur s'écrit sous le champ, dans les mots de check-content.

type Props = {
  spec: FigureSpec
  patchSpec: (patch: Partial<FigureSpec>) => void
  onFocus?: () => void
}

const champ =
  'rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none'
const selectClass = `${champ} font-display font-bold`
const titreSection = 'font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted'
const boutonAjouter = 'font-display text-sm font-bold text-accent-ink hover:underline'
const petit = 'font-prose text-xs text-ink-muted'

function ChampNombre({
  value,
  onChange,
  onFocus,
  ariaLabel,
  champProps,
}: {
  value: number
  onChange: (n: number) => void
  onFocus?: () => void
  ariaLabel: string
  champProps?: ReturnType<ReturnType<typeof useChamp>['champ']>
}) {
  return (
    <input
      type="number"
      step="any"
      inputMode="decimal"
      aria-label={ariaLabel}
      className={`${champ} ${marqueChamp} w-16`}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      onFocus={onFocus}
      {...champProps}
    />
  )
}

function Supprimer({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="shrink-0 text-ink-muted hover:text-danger"
    >
      ✕
    </button>
  )
}

/** Le premier nom libre parmi f, g, h, puis k, m… */
function nomLibre(pris: Set<string>, candidats: string): string {
  for (const c of candidats) if (!pris.has(c)) return c
  return candidats[0]
}

export function FonctionsEditeur({ spec, patchSpec, onFocus }: Props) {
  const { champ: champDe } = useChamp()
  const functions = spec.functions ?? []
  const readings = spec.readings ?? []
  const parameters = spec.parameters ?? []
  const variables = ['x', ...parameters.map((p) => p.name)]
  const sansVide = <T,>(liste: T[]): T[] | undefined => (liste.length > 0 ? liste : undefined)

  const majFonction = (i: number, patch: Partial<FigureFunction>) =>
    patchSpec({ functions: functions.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const majLecture = (i: number, lecture: FigureReading) =>
    patchSpec({ readings: readings.map((r, j) => (j === i ? lecture : r)) })
  const majParametre = (i: number, patch: Partial<FigureParameter>) =>
    patchSpec({ parameters: parameters.map((p, j) => (j === i ? { ...p, ...patch } : p)) })

  return (
    <div className="mt-2 flex flex-col gap-4">
      {/* Fonctions */}
      <section>
        <p className={`${titreSection} mb-1.5`}>Fonctions</p>
        <ul className="flex flex-col gap-2.5">
          {functions.map((fn, i) => {
            const lu = parseExpression(fn.expr, { variables })
            const erreurId = `fonction-${i}-erreur`
            const nomAffiche =
              typeof fn.label === 'string' ? 'texte' : fn.label === true ? 'courbe' : 'aucun'
            return (
              <li key={i} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    aria-label={`Nom de la fonction ${i + 1}`}
                    className={`${champ} ${marqueChamp} w-10 italic`}
                    value={fn.name}
                    onChange={(e) => majFonction(i, { name: e.target.value.trim() })}
                    onFocus={onFocus}
                    {...champDe(`spec.functions[${i}].name`)}
                  />
                  <span className={petit}>(x) =</span>
                  <input
                    aria-label={`Expression de ${fn.name || `la fonction ${i + 1}`}`}
                    aria-describedby={lu.ok ? undefined : erreurId}
                    aria-invalid={lu.ok ? undefined : true}
                    className={`${champ} ${marqueChamp} min-w-0 flex-1`}
                    value={fn.expr}
                    placeholder="2x + 1"
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => majFonction(i, { expr: e.target.value })}
                    onFocus={onFocus}
                    {...champDe(`spec.functions[${i}].expr`)}
                  />
                  <Supprimer
                    label={`Supprimer la fonction ${fn.name || i + 1}`}
                    onClick={() =>
                      patchSpec({
                        functions: sansVide(functions.filter((_, j) => j !== i)),
                        readings: sansVide(readings.filter((r) => r.function !== fn.name)),
                      })
                    }
                  />
                </div>
                {!lu.ok && (
                  <p id={erreurId} className="font-prose text-xs text-danger">
                    {lu.error.message}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className={`flex items-center gap-1 ${petit}`}>
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={fn.domain !== undefined}
                      onChange={(e) =>
                        majFonction(i, {
                          domain: e.target.checked
                            ? [spec.axes?.x.from ?? 0, spec.axes?.x.to ?? 1]
                            : undefined,
                        })
                      }
                    />
                    tracer seulement de
                  </label>
                  {fn.domain && (
                    <>
                      <ChampNombre
                        value={fn.domain[0]}
                        onChange={(a) => majFonction(i, { domain: [a, fn.domain![1]] })}
                        onFocus={onFocus}
                        ariaLabel={`Début du tracé de ${fn.name}`}
                        champProps={champDe(`spec.functions[${i}].domain`)}
                      />
                      <span className={petit}>à</span>
                      <ChampNombre
                        value={fn.domain[1]}
                        onChange={(b) => majFonction(i, { domain: [fn.domain![0], b] })}
                        onFocus={onFocus}
                        ariaLabel={`Fin du tracé de ${fn.name}`}
                        champProps={champDe(`spec.functions[${i}].domain`)}
                      />
                    </>
                  )}
                  <select
                    aria-label={`Nom écrit près de la courbe de ${fn.name}`}
                    className={`${selectClass} w-36`}
                    value={nomAffiche}
                    onChange={(e) =>
                      majFonction(i, {
                        label:
                          e.target.value === 'courbe'
                            ? true
                            : e.target.value === 'texte'
                              ? `Courbe de ${fn.name}`
                              : undefined,
                      })
                    }
                  >
                    <option value="aucun">sans nom</option>
                    <option value="courbe">𝒞{fn.name}</option>
                    <option value="texte">un texte…</option>
                  </select>
                  {typeof fn.label === 'string' && (
                    <input
                      aria-label={`Texte écrit près de la courbe de ${fn.name}`}
                      className={`${champ} w-32`}
                      value={fn.label}
                      onChange={(e) => majFonction(i, { label: e.target.value })}
                      onFocus={onFocus}
                    />
                  )}
                  <label className={`flex items-center gap-1 ${petit}`}>
                    <input
                      type="checkbox"
                      className="accent-accent"
                      aria-label={`Courbe de ${fn.name} en pointillés`}
                      checked={fn.style === 'dashed'}
                      onChange={(e) =>
                        majFonction(i, { style: e.target.checked ? 'dashed' : undefined })
                      }
                    />
                    pointillés
                  </label>
                  <ChoixTeinte
                    tone={fn.tone}
                    onChange={(tone) => majFonction(i, { tone })}
                    ariaLabel={`Teinte de la courbe de ${fn.name}`}
                  />
                </div>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          className={`mt-1.5 ${boutonAjouter}`}
          onClick={() =>
            patchSpec({
              functions: [
                ...functions,
                { name: nomLibre(new Set(functions.map((f) => f.name)), 'fghkmpqruv'), expr: 'x' },
              ],
            })
          }
        >
          ＋ Fonction
        </button>
      </section>

      {/* Lectures */}
      {functions.length > 0 && (
        <section>
          <p className={`${titreSection} mb-1.5`}>Lectures</p>
          <ul className="flex flex-col gap-1.5">
            {readings.map((r, i) => {
              const sorte = r.x !== undefined ? 'image' : 'antecedents'
              const valeur = r.x ?? r.y ?? 0
              return (
                <li key={i} className="flex flex-wrap items-center gap-1.5">
                  <select
                    aria-label={`Lecture ${i + 1} — type`}
                    className={`${selectClass} w-44`}
                    value={sorte}
                    onChange={(e) =>
                      majLecture(
                        i,
                        e.target.value === 'image'
                          ? { function: r.function, x: valeur }
                          : { function: r.function, y: valeur }
                      )
                    }
                  >
                    <option value="image">image de x =</option>
                    <option value="antecedents">antécédents de y =</option>
                  </select>
                  <ChampNombre
                    value={valeur}
                    onChange={(v) =>
                      majLecture(
                        i,
                        sorte === 'image'
                          ? { function: r.function, x: v }
                          : { function: r.function, y: v }
                      )
                    }
                    onFocus={onFocus}
                    ariaLabel={`Lecture ${i + 1} — valeur`}
                    champProps={champDe(`spec.readings[${i}].${sorte === 'image' ? 'x' : 'y'}`)}
                  />
                  <span className={petit}>par</span>
                  <select
                    aria-label={`Lecture ${i + 1} — fonction`}
                    className={`${selectClass} ${marqueChamp} w-16`}
                    value={r.function}
                    onChange={(e) =>
                      majLecture(
                        i,
                        r.x !== undefined
                          ? { function: e.target.value, x: r.x }
                          : { function: e.target.value, y: r.y ?? 0 }
                      )
                    }
                    {...champDe(`spec.readings[${i}].function`)}
                  >
                    {functions.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <Supprimer
                    label={`Supprimer la lecture ${i + 1}`}
                    onClick={() =>
                      patchSpec({ readings: sansVide(readings.filter((_, j) => j !== i)) })
                    }
                  />
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className={`mt-1.5 ${boutonAjouter}`}
            onClick={() =>
              patchSpec({ readings: [...readings, { function: functions[0].name, x: 1 }] })
            }
          >
            ＋ Lecture
          </button>
        </section>
      )}

      {/* Curseurs */}
      {functions.length > 0 && (
        <section>
          <p className={`${titreSection} mb-1.5`}>Curseurs</p>
          <p className={`${petit} mb-1.5`}>
            Une lettre de l’expression que l’élève fait varier ; l’impression garde la valeur.
          </p>
          <ul className="flex flex-col gap-1.5">
            {parameters.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1.5">
                <input
                  aria-label={`Nom du paramètre ${i + 1}`}
                  className={`${champ} ${marqueChamp} w-10 italic`}
                  value={p.name}
                  maxLength={1}
                  onChange={(e) => majParametre(i, { name: e.target.value.trim() })}
                  onFocus={onFocus}
                  {...champDe(`spec.parameters[${i}].name`)}
                />
                <span className={petit}>de</span>
                <ChampNombre
                  value={p.min}
                  onChange={(min) => majParametre(i, { min })}
                  onFocus={onFocus}
                  ariaLabel={`Paramètre ${p.name} — minimum`}
                  champProps={champDe(`spec.parameters[${i}].min`)}
                />
                <span className={petit}>à</span>
                <ChampNombre
                  value={p.max}
                  onChange={(max) => majParametre(i, { max })}
                  onFocus={onFocus}
                  ariaLabel={`Paramètre ${p.name} — maximum`}
                  champProps={champDe(`spec.parameters[${i}].max`)}
                />
                <span className={petit}>pas</span>
                <ChampNombre
                  value={p.step}
                  onChange={(step) => majParametre(i, { step })}
                  onFocus={onFocus}
                  ariaLabel={`Paramètre ${p.name} — pas`}
                  champProps={champDe(`spec.parameters[${i}].step`)}
                />
                <span className={petit}>valeur</span>
                <ChampNombre
                  value={p.value}
                  onChange={(value) => majParametre(i, { value })}
                  onFocus={onFocus}
                  ariaLabel={`Paramètre ${p.name} — valeur`}
                  champProps={champDe(`spec.parameters[${i}].value`)}
                />
                <Supprimer
                  label={`Supprimer le paramètre ${p.name || i + 1}`}
                  onClick={() =>
                    patchSpec({ parameters: sansVide(parameters.filter((_, j) => j !== i)) })
                  }
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`mt-1.5 ${boutonAjouter}`}
            onClick={() =>
              patchSpec({
                parameters: [
                  ...parameters,
                  {
                    name: nomLibre(new Set(parameters.map((p) => p.name)), 'abcmkpq'),
                    min: -3,
                    max: 3,
                    step: 0.5,
                    value: 1,
                  },
                ],
              })
            }
          >
            ＋ Curseur
          </button>
        </section>
      )}
    </div>
  )
}
