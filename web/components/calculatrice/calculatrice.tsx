'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  analyserLignes,
  decimalesDuPas,
  formaterNombre,
  pasGraduation,
  type CourbeVue,
  type Fenetre,
  type LigneAnalysee,
  type ModeAngle,
} from '@brio/content'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { InfobulleProvider } from '@/components/ui/infobulle'
import {
  E_MAX,
  LIGNES_MAX,
  adresseAvecEtat,
  encoderEtat,
  type CurseurEtat,
  type EtatCalculatrice,
} from '@/lib/calculatrice-etat'

import { LigneExpression, type ActionsLigne } from './ligne-expression'
import {
  NOMS_COULEURS,
  curseurPour,
  etatDepuisLignes,
  lignesDepuisEtat,
  prochaineCouleur,
  cleDeCourbe,
  surLaGrille,
  texteConstante,
  type Ligne,
} from './lignes'
import { basculerClavier, chargerMathLive } from './mathlive'
import { pauseCss } from './pause'
import { RepereInteractif } from './repere-interactif'

// The graphing calculator (ADR 0049 §3, spec U4 of #421): the list of expressions and the grid.
// Every change is read again by the engine (`analyserLignes`, pure and fast) and drawn at once;
// the state goes to the page's address after a pause, without a history entry per keystroke.

/** Steps of a slider's animation from one end to the other. */
const PAS_ANIMATION = 240

/** Reads the lines again only when a text or the angle unit changed, not for a colour. */
/**
 * Reads the lines again only when a text or the angle unit changed, not for a colour: the memo is
 * keyed on the texts themselves (V1-S3, gate 5: no ref written during render).
 */
function useAnalyse(lignes: readonly Ligne[], angle: ModeAngle): LigneAnalysee[] {
  const cle = JSON.stringify([angle, lignes.map((l) => [l.id, l.texte])])
  return useMemo(() => {
    const [a, saisies] = JSON.parse(cle) as [ModeAngle, [string, string][]]
    return analyserLignes(
      saisies.map(([id, texte]) => ({ id, texte })),
      { angle: a }
    )
  }, [cle])
}

function descriptionFenetre(f: Fenetre): string {
  const dx = decimalesDuPas(pasGraduation(f.xMax - f.xMin, 800)) + 1
  const dy = decimalesDuPas(pasGraduation(f.yMax - f.yMin, 800)) + 1
  const n = (v: number, d: number) => formaterNombre(v, d)
  return `Fenêtre : x de ${n(f.xMin, dx)} à ${n(f.xMax, dx)} ; y de ${n(f.yMin, dy)} à ${n(f.yMax, dy)}.`
}

export function Calculatrice({
  etatInitial,
  synchroniserAdresse = true,
  hauteur = 'page',
  onEtat,
}: {
  etatInitial: EtatCalculatrice
  /** Writes the state in the page's address; off for a demonstration (the /design page). */
  synchroniserAdresse?: boolean
  /**
   * Side by side, it fills the screen under the top bar, or the box it is set in. `compact`, for
   * a course block (#424): a shorter grid, and the list at its own height, without a scroll of
   * its own inside the chapter's.
   */
  hauteur?: 'page' | 'parent' | 'compact'
  /** Told the current state at each change of the work (a course block links it to Explorer). */
  onEtat?: (etat: EtatCalculatrice) => void
}) {
  const [lignes, setLignes] = useState<Ligne[]>(() => lignesDepuisEtat(etatInitial))
  const [fenetre, setFenetre] = useState<Fenetre | null>(etatInitial.fenetre ?? null)
  const [angle, setAngle] = useState<ModeAngle>(etatInitial.angle ?? 'radians')
  const [orthonorme, setOrthonorme] = useState(etatInitial.orthonorme ?? true)
  // Lines being typed: their error waits for a pause or for the field to be left.
  const [enSaisie, setEnSaisie] = useState<ReadonlySet<string>>(() => new Set())
  const [animes, setAnimes] = useState<ReadonlySet<string>>(() => new Set())
  const [focus, setFocus] = useState<{ id: string; cible: 'champ' | 'curseur' } | null>(null)

  const prochainId = useRef(lignes.length)
  const champs = useRef(new Map<string, HTMLElement>())
  const curseurs = useRef(new Map<string, HTMLInputElement>())
  const minuteries = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const limiteId = useId()
  // The line whose field had the focus last: the « Clavier » button opens the keyboard there.
  const derniere = useRef<string | null>(null)
  const [mathlive, setMathlive] = useState(false)
  useEffect(() => {
    let annule = false
    chargerMathLive()
      .then(() => {
        if (!annule) setMathlive(true)
      })
      .catch(() => undefined)
    return () => {
      annule = true
    }
  }, [])

  const analyse = useAnalyse(lignes, angle)
  const peutAjouter = lignes.length < LIGNES_MAX

  // --- The curves ---------------------------------------------------------------------------------
  const courbes = useMemo<CourbeVue[]>(() => {
    const liste: CourbeVue[] = []
    lignes.forEach((l, i) => {
      const a = analyse[i]
      if (l.masquee || !a) return
      const commun = {
        id: l.id,
        couleur: l.couleur,
        pointille: l.style === 'pointille',
        cle: cleDeCourbe(l.texte, lignes, analyse, angle),
      }
      if (a.genre === 'explicite') liste.push({ ...commun, genre: 'explicite', f: a.f })
      else if (a.genre === 'implicite') liste.push({ ...commun, genre: 'implicite', F: a.F })
    })
    return liste
  }, [lignes, analyse, angle])

  const description = useCallback(
    (f: Fenetre) => {
      const parId = new Map(lignes.map((l) => [l.id, l]))
      const elements = courbes.map((c) => {
        const l = parId.get(c.id)
        // « (en bleu) »: no clause comma glued to a decimal (y = 0,5x + 1,5, en bleu).
        return `${l?.texte.trim() ?? ''} (en ${NOMS_COULEURS[c.couleur]})`
      })
      const fen = descriptionFenetre(f)
      if (elements.length === 0) return `Aucune courbe n’est tracée. ${fen}`
      if (elements.length === 1) return `1 courbe : ${elements[0]}. ${fen}`
      const liste = new Intl.ListFormat('fr', { type: 'conjunction' }).format(elements)
      return `${elements.length} courbes : ${liste}. ${fen}`
    },
    [courbes, lignes]
  )

  // --- The address --------------------------------------------------------------------------------
  // The address the page opened with is not rewritten: only a change of the work is written.
  const ecrit = useRef<string | null>(null)
  useEffect(() => {
    if (!synchroniserAdresse) return
    const encode = encoderEtat(
      etatDepuisLignes(lignes, { ...(fenetre && { fenetre }), angle, orthonorme })
    )
    if (ecrit.current === null) {
      ecrit.current = encode
      return
    }
    // Never an address the page could not read back: past E_MAX the previous one is kept.
    if (encode === ecrit.current || encode.length > E_MAX) return
    const minuterie = setTimeout(() => {
      ecrit.current = encode
      window.history.replaceState(
        window.history.state,
        '',
        adresseAvecEtat(window.location.href, encode)
      )
    }, pauseCss())
    return () => clearTimeout(minuterie)
  }, [lignes, fenetre, angle, orthonorme, synchroniserAdresse])

  // The state, for a caller that shows it elsewhere (« Ouvrir en grand », #424).
  const onEtatRef = useRef(onEtat)
  useEffect(() => {
    onEtatRef.current = onEtat
  })
  useEffect(() => {
    onEtatRef.current?.(
      etatDepuisLignes(lignes, { ...(fenetre && { fenetre }), angle, orthonorme })
    )
  }, [lignes, fenetre, angle, orthonorme])

  // --- Focus after a change of the list -----------------------------------------------------------
  useEffect(() => {
    if (!focus) return
    const el = (focus.cible === 'champ' ? champs : curseurs).current.get(focus.id)
    el?.focus()
    setFocus(null)
  }, [focus])

  useEffect(() => {
    const m = minuteries.current
    return () => m.forEach((t) => clearTimeout(t))
  }, [])

  // --- Editing the list ---------------------------------------------------------------------------
  const nouvelleLigne = (existantes: readonly Ligne[], texte = ''): Ligne => ({
    id: `l${prochainId.current++}`,
    texte,
    couleur: prochaineCouleur(existantes.map((l) => l.couleur)),
    style: 'plein',
    masquee: false,
  })

  const modifier = (id: string, f: (l: Ligne) => Ligne) =>
    setLignes((ls) => ls.map((l) => (l.id === id ? f(l) : l)))

  function ajouter(apres?: string, texte = '', cible: 'champ' | 'curseur' = 'champ') {
    if (lignes.length >= LIGNES_MAX) return
    const nouvelle = nouvelleLigne(lignes, texte)
    const i = apres === undefined ? lignes.length : lignes.findIndex((l) => l.id === apres) + 1
    setLignes([...lignes.slice(0, i), nouvelle, ...lignes.slice(i)])
    setFocus({ id: nouvelle.id, cible })
  }

  function supprimer(id: string, versPrecedente: boolean) {
    const i = lignes.findIndex((l) => l.id === id)
    if (i < 0) return
    if (lignes.length === 1) {
      setLignes([{ ...lignes[0], texte: '', curseur: undefined }])
      setFocus({ id, cible: 'champ' })
      return
    }
    const reste = lignes.filter((l) => l.id !== id)
    const voisine = versPrecedente
      ? (lignes[i - 1] ?? lignes[i + 1])
      : (lignes[i + 1] ?? lignes[i - 1])
    setLignes(reste)
    setAnimes((a) => {
      if (!a.has(id)) return a
      const s = new Set(a)
      s.delete(id)
      return s
    })
    if (voisine) setFocus({ id: voisine.id, cible: 'champ' })
  }

  function marquerSaisie(id: string, oui: boolean) {
    setEnSaisie((s) => {
      if (s.has(id) === oui) return s
      const n = new Set(s)
      if (oui) n.add(id)
      else n.delete(id)
      return n
    })
  }

  function surTexte(id: string, texte: string) {
    modifier(id, (l) => ({ ...l, texte }))
    marquerSaisie(id, true)
    const m = minuteries.current
    clearTimeout(m.get(id))
    m.set(
      id,
      setTimeout(() => {
        m.delete(id)
        marquerSaisie(id, false)
      }, pauseCss())
    )
  }

  function surBlur(id: string) {
    clearTimeout(minuteries.current.get(id))
    minuteries.current.delete(id)
    marquerSaisie(id, false)
  }

  function surValeur(id: string, nom: string, v: number) {
    modifier(id, (l) => ({ ...l, texte: texteConstante(nom, v) }))
  }

  function animer(id: string, oui: boolean) {
    setAnimes((a) => {
      const s = new Set(a)
      if (oui) s.add(id)
      else s.delete(id)
      return s
    })
  }

  // --- The animation of sliders, started by the student only ----------------------------------------
  const etatAnime = useRef({ lignes, analyse })
  useEffect(() => {
    etatAnime.current = { lignes, analyse }
  }, [lignes, analyse])
  const sens = useRef(new Map<string, 1 | -1>())

  useEffect(() => {
    if (animes.size === 0) return
    let cadre = requestAnimationFrame(function pas() {
      const { lignes: ls, analyse: an } = etatAnime.current
      setLignes(
        ls.map((l, i) => {
          const a = an[i]
          if (!animes.has(l.id) || a?.genre !== 'constante' || !a.curseur) return l
          const c = curseurPour(l.curseur, a.valeur)
          let s = sens.current.get(l.id) ?? 1
          const saut = Math.max(c.pas, (c.max - c.min) / PAS_ANIMATION)
          let v = a.valeur + s * saut
          if (v >= c.max || v <= c.min) {
            v = Math.min(c.max, Math.max(c.min, v))
            s = s === 1 ? -1 : 1
          }
          sens.current.set(l.id, s)
          return { ...l, texte: texteConstante(a.nom, surLaGrille(v, c)) }
        })
      )
      cadre = requestAnimationFrame(pas)
    })
    return () => cancelAnimationFrame(cadre)
  }, [animes])

  // --- Rendering ----------------------------------------------------------------------------------
  return (
    <InfobulleProvider>
      <div
        className={[
          '@container',
          hauteur === 'parent' ? 'h-full' : '',
          // A focused control never hides under the sticky top bar (h-14) or, on a phone, the
          // bottom bar (h-16): the browser scrolls it clear (WCAG 2.4.11, U7 at gate 5).
          '[&_:is(input,button,a,math-field)]:scroll-mt-16 [&_:is(input,button,a,math-field)]:scroll-mb-20 sm:[&_:is(input,button,a,math-field)]:scroll-mb-4',
        ].join(' ')}
        onKeyDownCapture={(e) => {
          // Any key stops the animations, but Enter or Space on a play button: it toggles.
          const bascule =
            (e.key === 'Enter' || e.key === ' ') &&
            (e.target as HTMLElement).closest('[data-animation]') !== null
          if (animes.size > 0 && !bascule) setAnimes(new Set())
        }}
      >
        <div
          className={[
            'flex flex-col @4xl:flex-row',
            hauteur === 'parent'
              ? 'h-full'
              : hauteur === 'compact'
                ? '@4xl:h-112'
                : '@4xl:h-[calc(100dvh-var(--spacing)*14)]',
          ].join(' ')}
        >
          <div
            className={[
              'min-w-0 bg-surface-panel @4xl:w-88 @4xl:shrink-0 @4xl:overflow-y-auto @4xl:border-r @4xl:border-line',
              // In a box, stacked: the list scrolls under the grid instead of overflowing.
              hauteur === 'parent' ? 'min-h-0 flex-1 overflow-y-auto @4xl:flex-none' : '',
            ].join(' ')}
          >
            <div className="mx-auto max-w-2xl @4xl:max-w-none">
              <ol aria-label="Expressions">
                {lignes.map((ligne, i) => {
                  const a = analyse[i] ?? { id: ligne.id, genre: 'vide' as const }
                  const actions: ActionsLigne = {
                    onTexte: (t) => surTexte(ligne.id, t),
                    onFocus: () => {
                      derniere.current = ligne.id
                    },
                    onBlur: () => surBlur(ligne.id),
                    onEntree: () => {
                      if (i === lignes.length - 1) ajouter()
                      else setFocus({ id: lignes[i + 1].id, cible: 'champ' })
                    },
                    onEffacerVide: () => {
                      if (lignes.length > 1) supprimer(ligne.id, true)
                    },
                    onSupprimer: () => supprimer(ligne.id, false),
                    onMasquer: () => modifier(ligne.id, (l) => ({ ...l, masquee: !l.masquee })),
                    onCouleur: (couleur) => modifier(ligne.id, (l) => ({ ...l, couleur })),
                    onStyle: (style) => modifier(ligne.id, (l) => ({ ...l, style })),
                    onAjouterCurseur: (nom) => ajouter(ligne.id, `${nom} = 1`, 'curseur'),
                    onValeur: (v) => {
                      if (a.genre === 'constante') surValeur(ligne.id, a.nom, v)
                    },
                    onCurseur: (curseur: CurseurEtat) =>
                      modifier(ligne.id, (l) => ({ ...l, curseur })),
                    onAnimer: (oui) => animer(ligne.id, oui),
                  }
                  return (
                    <LigneExpression
                      key={ligne.id}
                      ligne={ligne}
                      numero={i + 1}
                      analyse={a}
                      erreurVisible={!enSaisie.has(ligne.id)}
                      premiere={i === 0}
                      peutAjouter={peutAjouter}
                      limiteId={peutAjouter ? undefined : limiteId}
                      anime={animes.has(ligne.id)}
                      champRef={(el) => {
                        if (el) champs.current.set(ligne.id, el)
                        else champs.current.delete(ligne.id)
                      }}
                      curseurRef={(el) => {
                        if (el) curseurs.current.set(ligne.id, el)
                        else curseurs.current.delete(ligne.id)
                      }}
                      actions={actions}
                    />
                  )
                })}
              </ol>
              <div className="flex flex-col gap-2 px-3 py-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-11 flex-1"
                    aria-disabled={!peutAjouter || undefined}
                    aria-describedby={peutAjouter ? undefined : limiteId}
                    onClick={() => ajouter()}
                  >
                    <Icon name="plus" size={16} />
                    Ajouter une expression
                  </Button>
                  {mathlive && (
                    // MathLive's virtual keyboard, the maths keypad: its own toggle in each field on
                    // a touch screen, this button with a mouse (#417).
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="hidden min-h-11 pointer-fine:inline-flex"
                      aria-label="Clavier mathématique"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const id = derniere.current ?? lignes[0]?.id
                        const champ = id ? champs.current.get(id) : undefined
                        if (champ) basculerClavier(champ)
                      }}
                    >
                      Clavier
                    </Button>
                  )}
                </div>
                {!peutAjouter && (
                  <p id={limiteId} className="font-prose text-sm text-ink-muted">
                    12 expressions au maximum
                  </p>
                )}
                {synchroniserAdresse && (
                  <p className="font-prose text-xs text-ink-muted">
                    Ton travail est dans l’adresse de la page&nbsp;: copie-la pour le retrouver ou
                    le partager.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div
            className={[
              'relative order-first min-h-64 min-w-0 shrink-0 border-b border-line @4xl:order-none @4xl:h-auto @4xl:flex-1 @4xl:border-b-0',
              hauteur === 'parent' ? 'h-1/2' : hauteur === 'compact' ? 'h-72' : 'h-[55svh]',
            ].join(' ')}
          >
            <RepereInteractif
              fenetre={fenetre}
              orthonorme={orthonorme}
              angle={angle}
              courbes={courbes}
              description={description}
              onFenetre={setFenetre}
              onOrthonorme={setOrthonorme}
              onAngle={setAngle}
              onVueParDefaut={() => {
                setFenetre(null)
                setOrthonorme(true)
              }}
            />
          </div>
        </div>
      </div>
    </InfobulleProvider>
  )
}
