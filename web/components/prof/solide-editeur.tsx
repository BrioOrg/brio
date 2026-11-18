'use client'

import type { SolidSpec } from '@brio/content'

import { marqueChamp, useChamp } from '@/components/prof/problemes-du-bloc'
import { SolidRenderer } from '@/components/solid-renderer'
import { SOLIDE_SORTES, solideDeSorte, solidePourApercu, type Bloc } from '@/lib/cours-editeur'

// Formulaire du bloc « Solide » (ADR 0039). L'enseignant choisit une sorte et ses dimensions ;
// le moteur (packages/content) calcule arêtes cachées, sections et repères. Les règles de
// check-content sont rejouées avant la publication ; l'aperçu est le même <SolidRenderer/> que
// celui de l'élève, dessiné seulement quand le solide respecte les règles.

type Props = {
  bloc: Bloc
  onModifier: (patch: Record<string, unknown>) => void
  onFocusBloc?: () => void
}

const etiquette = 'font-display text-xs font-bold uppercase tracking-wide text-ink-muted'
const champTexte = `w-full rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none ${marqueChamp}`

/** Une saisie à la française (virgule décimale) en nombre, ou undefined. */
function nombre(saisie: string): number | undefined {
  const t = saisie.trim().replace(',', '.').replace('−', '-')
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function texteNombre(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v).replace('.', ',') : ''
}

/** « 0 0 ; 4 0 ; 0 3 » ↔ [{x: 0, y: 0}, …] : les sommets d'une base, séparés par « ; ». */
function texteBase(v: unknown): string {
  if (!Array.isArray(v)) return ''
  return (v as Array<{ x: number; y: number }>)
    .map((p) => `${texteNombre(p.x)} ${texteNombre(p.y)}`)
    .join(' ; ')
}

function lireBase(saisie: string): Array<{ x: number; y: number }> {
  return saisie
    .split(';')
    .map((s) => s.trim().split(/\s+/))
    .filter((parts) => parts.length === 2)
    .map(([x, y]) => ({ x: nombre(x) ?? NaN, y: nombre(y) ?? NaN }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
}

/** « 45 ; −30 » ↔ [45, -30] : latitudes ou longitudes, séparées par « ; ». */
function texteListe(v: unknown): string {
  return Array.isArray(v) ? (v as number[]).map(texteNombre).join(' ; ') : ''
}

function lireListe(saisie: string): number[] | undefined {
  const valeurs = saisie
    .split(';')
    .map(nombre)
    .filter((n): n is number => n !== undefined)
  return valeurs.length > 0 ? valeurs : undefined
}

export function SolideEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const { champ } = useChamp()
  const sorte = SOLIDE_SORTES.find((s) => s.valeur === bloc.kind) ?? SOLIDE_SORTES[0]
  const section = (bloc.section ?? null) as { parallelTo?: string; at?: number } | null
  const apercu = solidePourApercu(bloc)
  const noms = Array.isArray(bloc.names) ? (bloc.names as string[]).join(' ') : ''

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          Solide
        </span>
        <label className="flex items-center gap-2">
          <span className={etiquette}>Sorte</span>
          <select
            className={champTexte}
            value={sorte.valeur}
            onChange={(e) => onModifier(solideDeSorte(e.target.value as SolidSpec['kind']))}
            onFocus={onFocusBloc}
          >
            {SOLIDE_SORTES.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={etiquette}>
              Texte alternatif <span className="text-danger">*</span>
            </span>
            <input
              className={champTexte}
              value={(bloc.alt as string) ?? ''}
              onChange={(e) => onModifier({ alt: e.target.value })}
              onFocus={onFocusBloc}
              placeholder="Ex. Un cône de sommet S et de base le disque de centre O"
              {...champ('alt')}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {sorte.dimensions.map((d) => (
              <label key={d.champ} className="flex w-24 flex-col gap-1">
                <span className={etiquette}>{d.label}</span>
                <input
                  className={champTexte}
                  inputMode="decimal"
                  defaultValue={texteNombre(bloc[d.champ])}
                  key={`${sorte.valeur}-${d.champ}`}
                  onChange={(e) => onModifier({ [d.champ]: nombre(e.target.value) })}
                  onFocus={onFocusBloc}
                  {...champ(d.champ)}
                />
              </label>
            ))}
          </div>

          {(sorte.valeur === 'prisme' || sorte.valeur === 'pyramide') && (
            <label className="flex flex-col gap-1">
              <span className={etiquette}>
                {sorte.valeur === 'prisme'
                  ? 'Base avant, en vraie grandeur (x y ; x y ; …)'
                  : 'Base vue de dessus (x y ; x y ; …)'}
              </span>
              <input
                className={champTexte}
                defaultValue={texteBase(bloc.base)}
                key={`${sorte.valeur}-base`}
                onChange={(e) => onModifier({ base: lireBase(e.target.value) })}
                onFocus={onFocusBloc}
                {...champ('base')}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className={etiquette}>Noms (facultatif) : {sorte.noms}</span>
            <input
              className={champTexte}
              value={noms}
              onChange={(e) => {
                const liste = e.target.value.split(/\s+/).filter(Boolean)
                onModifier({ names: liste.length > 0 ? liste : undefined })
              }}
              onFocus={onFocusBloc}
              placeholder="Ex. A B C D E F G H"
              {...champ('names')}
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <label className="flex items-center gap-2 font-prose text-sm text-ink">
              <input
                type="checkbox"
                checked={section !== null}
                onChange={(e) =>
                  onModifier({
                    section: e.target.checked
                      ? sorte.valeur === 'boule'
                        ? { at: 1 }
                        : { parallelTo: sorte.sections[0]?.valeur ?? 'base', at: 1 }
                      : undefined,
                  })
                }
              />
              Montrer une section plane
            </label>
            {section && (
              <div className="flex flex-wrap items-end gap-2">
                {sorte.sections.length > 0 && (
                  <label className="flex flex-col gap-1">
                    <span className={etiquette}>Parallèle</span>
                    <select
                      className={champTexte}
                      value={section.parallelTo ?? 'base'}
                      onChange={(e) =>
                        onModifier({ section: { ...section, parallelTo: e.target.value } })
                      }
                    >
                      {sorte.sections.map((s) => (
                        <option key={s.valeur} value={s.valeur}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex w-28 flex-col gap-1">
                  <span className={etiquette}>
                    {sorte.valeur === 'boule' ? 'Distance au centre' : 'Distance'}
                  </span>
                  <input
                    className={champTexte}
                    inputMode="decimal"
                    defaultValue={texteNombre(section.at)}
                    onChange={(e) =>
                      onModifier({ section: { ...section, at: nombre(e.target.value) } })
                    }
                    {...champ('section')}
                  />
                </label>
              </div>
            )}
          </fieldset>

          {sorte.valeur === 'boule' && (
            <fieldset className="flex flex-col gap-2">
              <label className="flex items-center gap-2 font-prose text-sm text-ink">
                <input
                  type="checkbox"
                  checked={bloc.equator === true}
                  onChange={(e) => onModifier({ equator: e.target.checked || undefined })}
                />
                Tracer l’équateur
              </label>
              <label className="flex flex-col gap-1">
                <span className={etiquette}>Parallèles, latitudes en degrés (45 ; −30)</span>
                <input
                  className={champTexte}
                  defaultValue={texteListe(bloc.parallels)}
                  onChange={(e) => onModifier({ parallels: lireListe(e.target.value) })}
                  {...champ('parallels')}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={etiquette}>Méridiens, longitudes en degrés (0 ; 60)</span>
                <input
                  className={champTexte}
                  defaultValue={texteListe(bloc.meridians)}
                  onChange={(e) => onModifier({ meridians: lireListe(e.target.value) })}
                  {...champ('meridians')}
                />
              </label>
            </fieldset>
          )}
        </div>

        <div className="min-w-0">
          {apercu ? (
            <SolidRenderer
              spec={apercu}
              alt={(bloc.alt as string) || 'Aperçu du solide'}
            />
          ) : (
            <p className="font-prose text-sm text-ink-muted">
              L’aperçu apparaîtra quand le solide sera complet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
