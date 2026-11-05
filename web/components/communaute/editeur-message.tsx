'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import { BlocsCommunaute, blocCommunaute } from '@/components/blocs/blocs-communaute'
import { BarreOutils, type Outil } from '@/components/communaute/barre-outils'
import { ZoneTexte, type PoigneeZone } from '@/components/communaute/zone-texte'
import { ChampFormule } from '@/components/maths/champ-formule'
import { CodeEditeur } from '@/components/prof/code-editeur'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import type { Bloc } from '@/lib/cours-editeur'
import {
  nettoyerLatexEnLigne,
  zoneVersContenus,
  type BlocMessage,
  type ContenuTexte,
  type Marque,
} from '@/lib/message-blocs'
import {
  basculerListe,
  basculerMarque,
  couperApres,
  dansListe,
  finDeZone,
  insererAtome,
  joindreZones,
  latexDeLaSelection,
  marqueActive,
} from '@/lib/message-edition'

// The server's limits (CorpsCommunaute.java), checked here so that a student reads why in French
// instead of losing their message to a refused request.
const MAX_BLOCS = 50
const MAX_ELEMENTS_LISTE = 50
const MAX_CARACTERES = 20_000
const MAX_TITRE = 200

const CHAMP_FORMULE =
  'w-full rounded-md border border-line bg-surface-page px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none'

type Mode = 'question' | 'reponse' | 'commentaire'

const COPIE: Record<
  Mode,
  { corps: string; suite: string; placeholder: string; envoyer: string; vide: string }
> = {
  question: {
    corps: 'Ta question',
    suite: 'Suite de ta question',
    placeholder: 'Explique ce que tu cherches à comprendre…',
    envoyer: 'Publier ma question',
    vide: 'Écris ta question avant de la publier.',
  },
  reponse: {
    corps: 'Ta réponse',
    suite: 'Suite de ta réponse',
    placeholder: 'Écris ta réponse…',
    envoyer: 'Publier ma réponse',
    vide: 'Écris ta réponse avant de la publier.',
  },
  commentaire: {
    corps: 'Ton commentaire',
    suite: 'Suite de ton commentaire',
    placeholder: 'Écris ton commentaire…',
    envoyer: 'Publier mon commentaire',
    vide: 'Écris ton commentaire avant de le publier.',
  },
}

/** What the composer hands over: `titre` only for a question, `corps` in the API's format. */
export type MessageEcrit = { titre?: string; corps: BlocMessage[] }

type BlocEditeur = { cle: string } & (
  | { kind: 'texte'; initial: readonly ContenuTexte[] | DocumentFragment }
  | { kind: 'formule'; latex: string }
  | { kind: 'code'; code: string; language?: string }
)

type Props = {
  mode: Mode
  /** An existing message, to edit it. Anything outside the palette is left out. */
  valeurInitiale?: { titre?: string; corps?: readonly unknown[] }
  /** May reject: the composer then keeps the text and tells the student. */
  onEnvoyer: (message: MessageEcrit) => Promise<void> | void
  onAnnuler?: () => void
  /** Overrides the send button's label, for an edit. */
  libelleEnvoyer?: string
}

function blocsInitiaux(corps: readonly unknown[], nouvelleCle: () => string): BlocEditeur[] {
  const blocs = corps.flatMap((brut) => {
    const parsed = blocCommunaute.safeParse(brut)
    return parsed.success ? [parsed.data] : []
  })
  const resultat: BlocEditeur[] = []
  let contenus: ContenuTexte[] = []
  const finirTexte = () => {
    resultat.push({ cle: nouvelleCle(), kind: 'texte', initial: contenus })
    contenus = []
  }
  for (const bloc of blocs) {
    if (bloc.type === 'prose' || bloc.type === 'list') {
      contenus.push(bloc)
    } else {
      finirTexte()
      resultat.push(
        bloc.type === 'formula'
          ? { cle: nouvelleCle(), kind: 'formule', latex: bloc.latex }
          : { cle: nouvelleCle(), kind: 'code', code: bloc.code, language: bloc.language }
      )
    }
  }
  finirTexte()
  return resultat
}

type SansId =
  | ContenuTexte
  | { type: 'formula'; latex: string }
  | { type: 'code'; code: string; language?: string }

type PanneauMaths = { cle: string; range: Range; latex: string }

/**
 * Writes a Communauté question, answer or comment (ADR 0035 §2). The student types, and adds a
 * formula or code from the toolbar: no markup is ever visible, unlike a Markdown field.
 */
export function EditeurMessage({
  mode,
  valeurInitiale,
  onEnvoyer,
  onAnnuler,
  libelleEnvoyer,
}: Props) {
  const copie = COPIE[mode]
  const idBase = useId()
  const compteur = useRef(0)
  const nouvelleCle = useCallback(() => `${idBase}-${(compteur.current += 1)}`, [idBase])

  const [blocs, setBlocs] = useState<BlocEditeur[]>(() =>
    blocsInitiaux(valeurInitiale?.corps ?? [], nouvelleCle)
  )
  const [titre, setTitre] = useState(valeurInitiale?.titre ?? '')
  const [erreurTitre, setErreurTitre] = useState<string>()
  const [erreur, setErreur] = useState<string>()
  const [envoi, setEnvoi] = useState(false)
  const [apercu, setApercu] = useState<MessageEcrit | null>(null)
  const [maths, setMaths] = useState<PanneauMaths | null>(null)
  const [etat, setEtat] = useState<{ marque: Marque | null; liste: boolean }>({
    marque: null,
    liste: false,
  })

  const zones = useRef(new Map<string, PoigneeZone>())
  const conteneur = useRef<HTMLDivElement>(null)
  const panneauMaths = useRef<HTMLDivElement>(null)
  const selectionMemorisee = useRef<{ cle: string; range: Range } | null>(null)
  const aFocaliser = useRef<string | null>(null)

  const zoneDeNoeud = useCallback((node: Node | null) => {
    for (const [cle, poignee] of zones.current) {
      const element = poignee.element()
      if (element && node && element.contains(node)) return { cle, element }
    }
    return null
  }, [])

  useEffect(() => {
    const surSelection = () => {
      const selection = document.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      const zone = zoneDeNoeud(range.startContainer)
      if (!zone) return
      selectionMemorisee.current = { cle: zone.cle, range: range.cloneRange() }
      const marque = marqueActive(zone.element, range)
      const liste = dansListe(zone.element, range)
      setEtat((e) => (e.marque === marque && e.liste === liste ? e : { marque, liste }))
    }
    document.addEventListener('selectionchange', surSelection)
    return () => document.removeEventListener('selectionchange', surSelection)
  }, [zoneDeNoeud])

  // The selection the tools act on. The focus may be in the toolbar, or nowhere yet on a first tap.
  const zoneCourante = useCallback(() => {
    const memorisee = selectionMemorisee.current
    const poignee = memorisee && zones.current.get(memorisee.cle)
    const element = poignee?.element()
    if (memorisee && element && element.contains(memorisee.range.startContainer)) {
      return { cle: memorisee.cle, element, range: memorisee.range.cloneRange() }
    }
    const derniere = Array.from(zones.current.entries()).at(-1)
    const zone = derniere?.[1].element()
    return derniere && zone ? { cle: derniere[0], element: zone, range: finDeZone(zone) } : null
  }, [])

  const appliquer = useCallback(
    (modifier: (zone: HTMLElement, range: Range) => Range) => {
      const courante = zoneCourante()
      if (!courante) return
      courante.element.focus()
      const apres = modifier(courante.element, courante.range)
      const selection = document.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(apres)
      selectionMemorisee.current = { cle: courante.cle, range: apres.cloneRange() }
      zones.current.get(courante.cle)?.apresEdition()
      setEtat({
        marque: marqueActive(courante.element, apres),
        liste: dansListe(courante.element, apres),
      })
    },
    [zoneCourante]
  )

  const surRaccourci = useCallback(
    (marque: Marque) => appliquer((zone, range) => basculerMarque(zone, range, marque)),
    [appliquer]
  )

  const ouvrirMaths = useCallback(
    (range: Range, cle: string) => setMaths({ cle, range, latex: latexDeLaSelection(range) }),
    []
  )

  const surClicAtome = useCallback(
    (atome: HTMLElement) => {
      const zone = zoneDeNoeud(atome)
      if (!zone) return
      const range = document.createRange()
      range.selectNode(atome)
      ouvrirMaths(range, zone.cle)
    },
    [ouvrirMaths, zoneDeNoeud]
  )

  useEffect(() => {
    if (maths) panneauMaths.current?.querySelector('input')?.focus()
    // Only on opening: `maths` changes on every key typed in the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maths === null])

  useEffect(() => {
    const cle = aFocaliser.current
    if (!cle) return
    aFocaliser.current = null
    const zone = zones.current.get(cle)?.element()
    const bloc = conteneur.current?.querySelector<HTMLElement>(`[data-bloc="${CSS.escape(cle)}"]`)
    ;(zone ?? bloc?.querySelector<HTMLElement>('input, textarea'))?.focus()
  }, [blocs])

  function fermerMaths() {
    const panneau = maths
    setMaths(null)
    if (panneau) zones.current.get(panneau.cle)?.element()?.focus()
  }

  function insererMaths() {
    if (!maths) return
    const latex = nettoyerLatexEnLigne(maths.latex)
    if (!latex) return
    const poignee = zones.current.get(maths.cle)
    const element = poignee?.element()
    setMaths(null)
    if (!poignee || !element) return
    element.focus()
    const apres = insererAtome(maths.range, latex)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(apres)
    selectionMemorisee.current = { cle: maths.cle, range: apres.cloneRange() }
    poignee.apresEdition()
  }

  function ajouterBloc(nouveau: BlocEditeur) {
    const courante = zoneCourante()
    if (!courante) return
    const reste = couperApres(courante.element, courante.range)
    zones.current.get(courante.cle)?.apresEdition()
    selectionMemorisee.current = null
    aFocaliser.current = nouveau.cle
    setBlocs((actuels) => {
      const i = actuels.findIndex((b) => b.cle === courante.cle)
      const suite: BlocEditeur = { cle: nouvelleCle(), kind: 'texte', initial: reste }
      return [...actuels.slice(0, i + 1), nouveau, suite, ...actuels.slice(i + 1)]
    })
  }

  function surOutil(outil: Outil) {
    switch (outil) {
      case 'bold':
      case 'italic':
      case 'highlight':
        surRaccourci(outil)
        return
      case 'liste':
        appliquer(basculerListe)
        return
      case 'maths': {
        const courante = zoneCourante()
        if (courante) ouvrirMaths(courante.range, courante.cle)
        return
      }
      case 'formule':
        ajouterBloc({ cle: nouvelleCle(), kind: 'formule', latex: '' })
        return
      case 'code':
        ajouterBloc({ cle: nouvelleCle(), kind: 'code', code: '' })
        return
      case 'scratch':
        ajouterBloc({ cle: nouvelleCle(), kind: 'code', code: '', language: 'scratch' })
        return
    }
  }

  function retirerBloc(cle: string) {
    const i = blocs.findIndex((b) => b.cle === cle)
    const avant = blocs[i - 1]
    const apres = blocs[i + 1]
    const zoneAvant = avant?.kind === 'texte' ? zones.current.get(avant.cle)?.element() : null
    const zoneApres = apres?.kind === 'texte' ? zones.current.get(apres.cle)?.element() : null
    const fusion = Boolean(zoneAvant && zoneApres)
    if (zoneAvant && zoneApres) {
      joindreZones(zoneAvant, zoneApres)
      zones.current.get(avant.cle)?.apresEdition()
    }
    selectionMemorisee.current = null
    if (avant?.kind === 'texte') aFocaliser.current = avant.cle
    setBlocs((actuels) =>
      actuels.filter((b) => b.cle !== cle && !(fusion && apres && b.cle === apres.cle))
    )
  }

  function modifierBloc(cle: string, patch: Partial<Omit<BlocEditeur, 'cle' | 'kind'>>) {
    setBlocs((actuels) =>
      actuels.map((b) => (b.cle === cle ? ({ ...b, ...patch } as BlocEditeur) : b))
    )
  }

  function composer(): BlocMessage[] {
    const contenus = blocs.flatMap((bloc): SansId[] => {
      if (bloc.kind === 'texte') {
        const element = zones.current.get(bloc.cle)?.element()
        return element ? zoneVersContenus(element) : []
      }
      if (bloc.kind === 'formule') {
        const latex = bloc.latex.trim()
        return latex ? [{ type: 'formula', latex }] : []
      }
      if (bloc.code.trim() === '') return []
      const code = bloc.code.replace(/\s+$/, '')
      return [
        bloc.language ? { type: 'code', code, language: bloc.language } : { type: 'code', code },
      ]
    })
    return contenus.map((contenu, i) => ({ ...contenu, id: `b${i + 1}` }) as BlocMessage)
  }

  const message = (): MessageEcrit => ({
    ...(mode === 'question' ? { titre: titre.trim() } : {}),
    corps: composer(),
  })

  async function envoyer() {
    const ecrit = message()
    const titreManquant = mode === 'question' && !ecrit.titre
    const titreTropLong = (ecrit.titre?.length ?? 0) > MAX_TITRE
    setErreurTitre(
      titreManquant
        ? 'Donne un titre à ta question.'
        : titreTropLong
          ? `Ton titre est trop long : ${MAX_TITRE} caractères au maximum.`
          : undefined
    )
    let probleme: string | undefined
    if (ecrit.corps.length === 0) {
      probleme = copie.vide
    } else if (
      ecrit.corps.length > MAX_BLOCS ||
      ecrit.corps.some((b) => b.type === 'list' && b.items.length > MAX_ELEMENTS_LISTE) ||
      JSON.stringify(ecrit.corps).length > MAX_CARACTERES
    ) {
      probleme = 'Ton message est trop long : raccourcis-le avant de le publier.'
    }
    setErreur(probleme)
    if (titreManquant || titreTropLong || probleme) return

    setEnvoi(true)
    try {
      await onEnvoyer(ecrit)
    } catch {
      setErreur('Ton message n’a pas pu être publié. Réessaie : ton texte est toujours là.')
    } finally {
      setEnvoi(false)
    }
  }

  const premiereZone = useMemo(() => blocs.find((b) => b.kind === 'texte')?.cle, [blocs])

  const surToucheMaths = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      fermerMaths()
    } else if (e.key === 'Enter' && (e.target as Element).tagName === 'INPUT') {
      e.preventDefault()
      insererMaths()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {apercu ? (
        <section aria-label="Aperçu de ton message" className="flex flex-col gap-3">
          {apercu.titre && (
            <p className="font-display text-lg font-extrabold text-ink">{apercu.titre}</p>
          )}
          {apercu.corps.length > 0 ? (
            <BlocsCommunaute blocs={apercu.corps} />
          ) : (
            <p className="font-prose text-sm text-ink-muted">Rien à afficher pour l’instant.</p>
          )}
        </section>
      ) : null}

      {/* Hidden, not unmounted: the text of each zone lives in its DOM. */}
      <div ref={conteneur} hidden={apercu !== null} className="flex min-w-0 flex-col gap-3">
        {mode === 'question' && (
          <TextInput
            label="Titre de ta question"
            value={titre}
            error={erreurTitre}
            onChange={(e) => setTitre(e.target.value)}
          />
        )}

        <div className="min-w-0 rounded-lg border-2 border-line bg-surface-raised focus-within:border-accent">
          <BarreOutils marque={etat.marque} liste={etat.liste} onOutil={surOutil} />

          {maths && (
            <div
              ref={panneauMaths}
              role="group"
              aria-label="Maths en ligne"
              onKeyDown={surToucheMaths}
              className="flex flex-col gap-2 border-b border-line p-3"
            >
              <ChampFormule
                value={maths.latex}
                onChange={(latex) => setMaths((m) => (m ? { ...m, latex } : m))}
                displayMode={false}
                ariaLabel="Formule à insérer dans le texte"
                placeholder="Par exemple : x^2 + 1"
                inputClassName={CHAMP_FORMULE}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={insererMaths}
                  disabled={!nettoyerLatexEnLigne(maths.latex)}
                >
                  Insérer
                </Button>
                <Button size="sm" variant="ghost" onClick={fermerMaths}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-3 p-3">
            {blocs.map((bloc) => {
              if (bloc.kind === 'texte') {
                const premiere = bloc.cle === premiereZone
                return (
                  <ZoneTexte
                    key={bloc.cle}
                    ref={(poignee) => {
                      if (poignee) zones.current.set(bloc.cle, poignee)
                      else zones.current.delete(bloc.cle)
                    }}
                    initial={bloc.initial}
                    label={premiere ? copie.corps : copie.suite}
                    placeholder={premiere ? copie.placeholder : 'Continue ici si tu veux…'}
                    onRaccourci={surRaccourci}
                    onClicAtome={surClicAtome}
                  />
                )
              }
              const libelleRetirer =
                bloc.kind === 'formule'
                  ? 'Retirer cette formule'
                  : bloc.language === 'scratch'
                    ? 'Retirer ce programme Scratch'
                    : 'Retirer ce code'
              return (
                <div key={bloc.cle} data-bloc={bloc.cle} className="flex min-w-0 flex-col gap-1">
                  {bloc.kind === 'formule' ? (
                    <div className="rounded-lg border border-line bg-surface-panel p-4">
                      <ChampFormule
                        value={bloc.latex}
                        onChange={(latex) => modifierBloc(bloc.cle, { latex })}
                        ariaLabel="Formule"
                        placeholder="Par exemple : BC^2 = AB^2 + AC^2"
                        inputClassName={CHAMP_FORMULE}
                      />
                    </div>
                  ) : (
                    <CodeEditeur
                      bloc={
                        {
                          id: bloc.cle.replaceAll(':', ''),
                          type: 'code',
                          code: bloc.code,
                          language: bloc.language,
                        } as Bloc
                      }
                      onModifier={(patch) => modifierBloc(bloc.cle, patch)}
                    />
                  )}
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => retirerBloc(bloc.cle)}>
                      {libelleRetirer}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {erreur && (
        <p role="alert" className="font-prose text-sm text-feedback-incorrect">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button loading={envoi} onClick={envoyer}>
          {libelleEnvoyer ?? copie.envoyer}
        </Button>
        <Button
          variant="secondary"
          aria-pressed={apercu !== null}
          onClick={() => setApercu((a) => (a ? null : message()))}
        >
          {apercu ? 'Continuer d’écrire' : 'Aperçu'}
        </Button>
        {onAnnuler && (
          <Button variant="ghost" onClick={onAnnuler}>
            Annuler
          </Button>
        )}
      </div>
    </div>
  )
}
