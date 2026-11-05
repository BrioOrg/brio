'use client'

import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'

import { parseScratch } from '@brio/content'

import { marqueChamp, useChamp } from '@/components/prof/problemes-du-bloc'
import { ScratchBlocks } from '@/components/scratch-blocks'
import { CODE_LANGAGES, langageCode, type Bloc } from '@/lib/cours-editeur'
import { messageScratch } from '@/lib/scratch-erreurs'

// Formulaire du bloc « Programme » (bloc `code`, ADR 0031, #233). En « Texte », le code s'affiche
// en police fixe. En « Scratch », il est analysé à chaque frappe par le parseur de l'afficheur
// élève : les erreurs s'affichent avec leur ligne, et l'aperçu dessine les blocs dès qu'il n'en
// reste aucune.

type Props = {
  bloc: Bloc
  onModifier: (patch: Record<string, unknown>) => void
  onFocusBloc?: () => void
}

const etiquette = 'font-display text-xs font-bold uppercase tracking-wide text-ink-muted'

// Un pas d'indentation (ADR 0031 §2 : le corps d'un « répéter » est indenté de 4 espaces).
const PAS = '    '

type Remplacement = { code: string; debut: number; fin: number }

/**
 * Indentation au clavier dans la zone de code. Maj+Tab (désindente) et toute sélection agissent
 * sur les lignes entières qu'elles touchent ; Tab avec un simple curseur insère un pas là où il
 * se trouve. Fonction pure : renvoie le nouveau code et la sélection à y reposer.
 */
export function appliqueIndentation(
  code: string,
  debut: number,
  fin: number,
  desindente: boolean
): Remplacement {
  if (!desindente && debut === fin) {
    const pos = debut + PAS.length
    return { code: code.slice(0, debut) + PAS + code.slice(fin), debut: pos, fin: pos }
  }

  const debutLigne = code.lastIndexOf('\n', debut - 1) + 1
  const avant = code.slice(0, debutLigne)
  const lignes = code.slice(debutLigne, fin).split('\n')
  const apres = code.slice(fin)

  let decalageDebut = 0
  let decalageFin = 0
  const transformees = lignes.map((ligne, i) => {
    // Une sélection qui se termine en début de ligne ne doit pas indenter cette ligne-là.
    if (i === lignes.length - 1 && ligne === '' && lignes.length > 1) return ligne
    if (desindente) {
      const retire = /^ {1,4}/.exec(ligne)?.[0].length ?? 0
      if (i === 0) decalageDebut = -retire
      decalageFin -= retire
      return ligne.slice(retire)
    }
    if (i === 0) decalageDebut = PAS.length
    decalageFin += PAS.length
    return PAS + ligne
  })

  return {
    code: avant + transformees.join('\n') + apres,
    debut: Math.max(debutLigne, debut + decalageDebut),
    fin: Math.max(debutLigne, fin + decalageFin),
  }
}

// Le catalogue de l'ADR 0031 §2, pour l'aide de saisie.
const CATALOGUE = [
  'quand le drapeau vert est cliqué',
  'demander « Choisis un nombre » et attendre',
  'mettre x à (réponse)',
  'ajouter 1 à x',
  'dire ((x * 3) + 4)',
  'avancer de 10 pas',
  'tourner à droite de 90 degrés',
  'répéter 4 fois',
  '    avancer de 50 pas',
  'fin',
]

export function CodeEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const { champ } = useChamp()
  const langage = langageCode(bloc)
  const code = typeof bloc.code === 'string' ? bloc.code : ''
  const idErreurs = useId()
  const idAide = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  // Sélection à reposer après qu'une (dés)indentation a réécrit le code (React reconstruit la zone).
  const selectionAReposer = useRef<{ debut: number; fin: number } | null>(null)
  // Après Échap, le prochain Tab sort du champ au lieu d'indenter ; toute autre frappe le réarme.
  const sortieParTab = useRef(false)
  const [annonce, setAnnonce] = useState('')

  const analyse = useMemo(
    () => (langage === 'scratch' && code.trim() !== '' ? parseScratch(code) : null),
    [langage, code]
  )
  const erreurs = analyse && !analyse.ok ? analyse.errors : []
  const lignesEnErreur = new Set(erreurs.map((e) => e.line))
  const nombreDeLignes = Math.max(1, code.split('\n').length)

  // La zone grandit avec le programme : la gouttière des numéros reste alignée sans défilement.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    if (selectionAReposer.current) {
      el.focus()
      el.setSelectionRange(selectionAReposer.current.debut, selectionAReposer.current.fin)
      selectionAReposer.current = null
    }
  }, [code])

  function surTouche(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      sortieParTab.current = true
      setAnnonce('La touche Tab quitte le champ.')
      return
    }
    if (e.key === 'Tab') {
      if (sortieParTab.current) {
        sortieParTab.current = false // laisse le focus sortir normalement
        return
      }
      e.preventDefault()
      const el = e.currentTarget
      const r = appliqueIndentation(code, el.selectionStart, el.selectionEnd, e.shiftKey)
      if (r.code === code) return
      selectionAReposer.current = { debut: r.debut, fin: r.fin }
      onModifier({ code: r.code })
      return
    }
    // Toute frappe utile réarme l'indentation et efface l'annonce (pas les simples modificateurs).
    if (sortieParTab.current && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      sortieParTab.current = false
      setAnnonce('')
    }
  }

  const champCode = champ('code')
  const decritPar =
    [champCode['aria-describedby'], idAide, erreurs.length > 0 ? idErreurs : undefined]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          Programme
        </span>
        <div
          role="group"
          aria-label="Langage du programme"
          className="flex rounded-md border border-line bg-surface-page p-0.5"
        >
          {CODE_LANGAGES.map((l) => (
            <button
              key={l.valeur}
              type="button"
              onClick={() =>
                onModifier({ language: l.valeur === 'scratch' ? 'scratch' : undefined })
              }
              aria-pressed={langage === l.valeur}
              className={`rounded-md px-3 py-1 font-display text-xs font-bold ${
                langage === l.valeur ? 'bg-surface-panel text-ink shadow-sm' : 'text-ink-muted'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className={langage === 'scratch' ? 'grid gap-4 lg:grid-cols-2' : ''}>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex overflow-hidden rounded-md border border-line bg-surface-page font-mono text-sm leading-relaxed text-ink focus-within:border-accent">
            <div
              aria-hidden="true"
              className="shrink-0 select-none border-r border-line px-2 py-2 text-right text-ink-muted"
            >
              {Array.from({ length: nombreDeLignes }, (_, i) => (
                <div key={i} className={lignesEnErreur.has(i + 1) ? 'font-bold text-danger' : ''}>
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              ref={ref}
              rows={1}
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label={langage === 'scratch' ? 'Programme Scratch' : 'Code'}
              {...champCode}
              aria-describedby={decritPar}
              value={code}
              onChange={(e) => onModifier({ code: e.target.value })}
              onKeyDown={surTouche}
              onFocus={onFocusBloc}
              placeholder={
                langage === 'scratch'
                  ? 'quand le drapeau vert est cliqué\ndire « Bonjour »'
                  : 'Le code, tel qu’il doit s’afficher'
              }
              className={`min-w-0 flex-1 resize-none overflow-y-hidden whitespace-pre bg-transparent px-2 py-2 placeholder:text-ink-muted/60 focus:outline-none ${marqueChamp}`}
            />
          </div>

          <p id={idAide} className="sr-only">
            Tab ajoute une indentation, Maj+Tab la retire. Pour quitter le champ au clavier, appuie
            sur Échap puis Tab.
          </p>
          <span role="status" aria-live="polite" className="sr-only">
            {annonce}
          </span>

          {langage === 'scratch' && (
            <>
              {erreurs.length > 0 && (
                <ul id={idErreurs} className="flex flex-col gap-1 font-prose text-sm text-danger">
                  {erreurs.map((e, i) => (
                    <li key={i}>
                      <span className="font-bold">Ligne {e.line}</span> : {messageScratch(e)}
                    </li>
                  ))}
                </ul>
              )}
              <details className="font-prose text-xs text-ink-muted">
                <summary className="cursor-pointer font-display font-bold">
                  Instructions reconnues
                </summary>
                <p className="mt-1.5">
                  Une instruction par ligne. Le corps d’un « répéter » est indenté de 4 espaces
                  (touche Tab, Maj+Tab pour revenir) et fermé par « fin ». Un texte s’écrit entre
                  « », un calcul entre parenthèses, une paire par opérateur : ((x * 3) + 4).
                </p>
                <pre className="mt-1.5 overflow-x-auto rounded-md border border-line bg-surface-page p-2 font-mono text-ink">
                  {CATALOGUE.join('\n')}
                </pre>
              </details>
            </>
          )}
        </div>

        {langage === 'scratch' && (
          <div className="min-w-0">
            <p className={`${etiquette} mb-1.5`}>Aperçu</p>
            {analyse?.ok ? (
              <ScratchBlocks id={`${bloc.id}-apercu`} code={code} script={analyse.script} />
            ) : (
              <p className="rounded-md border border-dashed border-line bg-surface-page p-4 text-center font-prose text-xs text-ink-muted">
                {analyse
                  ? 'Les blocs s’afficheront quand le programme ne contiendra plus d’erreur.'
                  : 'Écris un programme pour voir ses blocs.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
