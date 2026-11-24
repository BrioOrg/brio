'use client'

import type { LigneAnalysee } from '@brio/content'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Infobulle } from '@/components/ui/infobulle'
import type { CurseurEtat } from '@/lib/calculatrice-etat'
import { CURVE_BG, type CurveColour } from '@/lib/curve-colours'

import { ChampMath } from './champ-math'
import { BOUTON_ICONE, CURVE_BORDER } from './classes'
import { CurseurConstante } from './curseur-constante'
import { curseurPour, type Ligne } from './lignes'
import { MenuStyle } from './menu-style'
import { Resultat } from './resultat'

// One line of the calculator (spec U4 §3): the pastille that hides or shows its curve, the
// maths field, typeset as it is typed (#417), a calculation's result, the colour and stroke menu,
// delete; under it, the engine's message, a slider, or the offer to add the slider of an unknown
// letter.

export type ActionsLigne = {
  onTexte: (texte: string) => void
  onFocus: () => void
  onBlur: () => void
  onEntree: () => void
  onEffacerVide: () => void
  onSupprimer: () => void
  onMasquer: () => void
  onCouleur: (c: CurveColour) => void
  onStyle: (s: 'plein' | 'pointille') => void
  onAjouterCurseur: (nom: string) => void
  onValeur: (v: number) => void
  onCurseur: (c: CurseurEtat) => void
  onAnimer: (anime: boolean) => void
}

type Props = {
  ligne: Ligne
  numero: number
  analyse: LigneAnalysee
  /**
   * The engine's message is shown after a pause or once the field is left (spec U4 §6); a letter
   * that is not defined is said at once, with its slider to add (#417).
   */
  erreurVisible: boolean
  premiere: boolean
  peutAjouter: boolean
  /** The id of "12 expressions au maximum", when the limit is reached. */
  limiteId?: string
  anime: boolean
  champRef: (el: HTMLElement | null) => void
  curseurRef: (el: HTMLInputElement | null) => void
  actions: ActionsLigne
}

/** The text with its faulty character underlined, where the preview would be. */
function TexteSouligne({ texte, position }: { texte: string; position: number }) {
  const i = Math.max(0, Math.min(position, texte.length))
  const car = texte.slice(i, i + 1)
  return (
    <span
      aria-hidden="true"
      className="col-span-2 col-start-2 min-w-0 break-all font-prose text-base text-ink-muted"
    >
      {texte.slice(0, i)}
      <span className="text-ink underline decoration-feedback-incorrect decoration-wavy underline-offset-4">
        {car === '' || car === ' ' ? ' ' : car}
      </span>
      {texte.slice(i + 1)}
    </span>
  )
}

export function LigneExpression({
  ligne,
  numero,
  analyse,
  erreurVisible,
  premiere,
  peutAjouter,
  limiteId,
  anime,
  champRef,
  curseurRef,
  actions,
}: Props) {
  const messageId = `ligne-${ligne.id}-message`
  const tracable = analyse.genre !== 'calcul' && analyse.genre !== 'constante'
  const erreur =
    analyse.genre === 'erreur' && (erreurVisible || analyse.erreur.curseurPropose !== undefined)
      ? analyse.erreur
      : null
  const lettre = erreur?.curseurPropose
  const latex = analyse.genre !== 'vide' && analyse.genre !== 'erreur' ? analyse.latex : null
  const resultat = analyse.genre === 'calcul' || (analyse.genre === 'constante' && !analyse.curseur)
  const invalide = erreur !== null && lettre === undefined

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 border-b border-line px-3 py-3">
      {/* 1. Pastille: shows or hides the curve; a number on a line that draws nothing. */}
      {tracable ? (
        <Infobulle label={ligne.masquee ? 'Afficher la courbe' : 'Masquer la courbe'}>
          <button
            type="button"
            onClick={actions.onMasquer}
            aria-pressed={!ligne.masquee}
            // A stable name; aria-pressed says whether the curve is shown (U7, gate 5).
            aria-label={`Afficher la courbe ${numero}`}
            className="grid size-11 cursor-pointer place-items-center rounded-md transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
          >
            <span
              data-pastille={ligne.couleur}
              className={[
                'grid size-6 place-items-center rounded-pill transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
                ligne.masquee
                  ? `border-2 bg-transparent ${CURVE_BORDER[ligne.couleur]}`
                  : CURVE_BG[ligne.couleur],
              ].join(' ')}
            >
              {ligne.masquee && <Icon name="eye-slash" size={14} className="text-ink-muted" />}
            </span>
          </button>
        </Infobulle>
      ) : (
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center font-display text-sm font-extrabold text-ink-muted"
        >
          {numero}
        </span>
      )}

      {/* 2. The field. */}
      <ChampMath
        texte={ligne.texte}
        latex={latex}
        numero={numero}
        placeholder={premiere ? 'Par exemple : y = 2x + 1' : 'Écris une expression'}
        invalide={invalide}
        describedBy={erreur ? messageId : undefined}
        champRef={champRef}
        onTexte={actions.onTexte}
        onFocus={actions.onFocus}
        onBlur={actions.onBlur}
        onEntree={actions.onEntree}
        onEffacerVide={actions.onEffacerVide}
      />

      {/* 3. A calculation's result, under the field. */}
      {resultat && (
        <div className="col-span-2 col-start-2 flex min-h-6 min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {analyse.genre === 'calcul' && (
            <Resultat
              key={ligne.texte}
              valeur={analyse.valeur}
              exact={analyse.exact}
              arrondi={analyse.arrondi}
            />
          )}
          {analyse.genre === 'constante' && !analyse.curseur && (
            <Resultat
              key={ligne.texte}
              valeur={analyse.valeur}
              exact={null}
              arrondi={analyse.arrondi ?? true}
            />
          )}
        </div>
      )}
      {/* 5 and 6. Colour and stroke, delete: on the first row, after the result in the focus order. */}
      <div className="col-start-3 row-start-1 flex">
        {tracable ? (
          <MenuStyle
            numero={numero}
            couleur={ligne.couleur}
            style={ligne.style}
            onCouleur={actions.onCouleur}
            onStyle={actions.onStyle}
          />
        ) : (
          <span aria-hidden="true" className="size-11" />
        )}
        <Infobulle label="Supprimer">
          <button
            type="button"
            onClick={actions.onSupprimer}
            aria-label={`Supprimer l’expression ${numero}`}
            className={BOUTON_ICONE}
          >
            <Icon name="x" size={20} />
          </button>
        </Infobulle>
      </div>

      {erreur && <TexteSouligne texte={ligne.texte} position={erreur.position} />}

      {/* The engine's message, or the slider. */}
      {erreur && lettre === undefined && (
        <p
          id={messageId}
          className="col-span-2 col-start-2 flex items-start gap-1.5 font-prose text-sm text-ink"
        >
          <Icon
            name="warning-circle"
            size={16}
            className="mt-0.5 shrink-0 text-feedback-incorrect"
          />
          <span>{erreur.message}</span>
        </p>
      )}
      {erreur && lettre !== undefined && (
        <div className="col-span-2 col-start-2 flex flex-col items-start gap-2">
          <p id={messageId} className="font-prose text-sm text-ink-muted">
            {erreur.message}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            aria-disabled={!peutAjouter || undefined}
            aria-describedby={!peutAjouter ? limiteId : undefined}
            onClick={() => {
              if (peutAjouter) actions.onAjouterCurseur(lettre)
            }}
          >
            <Icon name="plus" size={16} />
            Ajouter un curseur {lettre}
          </Button>
        </div>
      )}
      {analyse.genre === 'constante' && analyse.curseur && (
        <div className="col-span-2 col-start-2">
          <CurseurConstante
            ref={curseurRef}
            nom={analyse.nom}
            valeur={analyse.valeur}
            curseur={curseurPour(ligne.curseur, analyse.valeur)}
            anime={anime}
            onValeur={actions.onValeur}
            onCurseur={actions.onCurseur}
            onAnimer={actions.onAnimer}
          />
        </div>
      )}
    </li>
  )
}
