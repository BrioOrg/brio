'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  CoursApiError,
  enregistrerCours,
  getCoursBrouillon,
  listerCompetences,
  sectionsDuChapitrePublie,
  type Competence,
  type ViolationContenu,
} from '@brio/api-client'

import { ChapterView } from '@/components/chapter-view'
import { Icon } from '@/components/ui/icon'
import { Infobulle, InfobulleProvider } from '@/components/ui/infobulle'
import { BlocEditeur } from '@/components/prof/bloc-editeur'
import { ProblemesDuBlocProvider, marqueChamp } from '@/components/prof/problemes-du-bloc'
import { PublierCours } from '@/components/prof/publier-cours'
import {
  BLOCS,
  SECTION_KIND_LABELS,
  brouillonDepuisContenu,
  brouillonVersApercu,
  cibleAVerifier,
  contenuDepuisBrouillon,
  deplacer,
  ecrireTampon,
  effacerTampon,
  lireTampon,
  nouveauBloc,
  nouvelleSection,
  problemeReference,
  problemesBrouillon,
  problemesDepuisViolations,
  type Bloc,
  type BlocType,
  type Brouillon,
  type ExerciceType,
  type ExercicePreset,
  type Probleme,
  type Section,
  type SectionKind,
} from '@/lib/cours-editeur'
import { apiBaseUrl } from '@/lib/api-base-url'

// Délai d'inactivité avant un enregistrement serveur : assez court pour ne rien perdre, assez
// long pour ne pas écrire à chaque frappe. Le tampon local, lui, est écrit immédiatement.
const DELAI_ENREGISTREMENT_MS = 1500

type EtatEnregistrement = 'repos' | 'enregistrement' | 'enregistre' | 'echec'

/** Résultat de la vérification d'une référence interne (voir problemeReference). */
type CibleVerifiee = string[] | null | 'erreur'

function cleCible(c: { level: string; subject: string; slug: string }): string {
  return `${c.level}/${c.subject}/${c.slug}`
}

// « Aller au problème » : l'élément à atteindre (repères data-* posés par l'éditeur et useChamp).
// Un champ introuvable (ligne supprimée…) retombe sur son parent, puis sur le bloc.
function elementDuProbleme(p: Probleme): HTMLElement | null {
  if (!p.sectionId) return document.querySelector<HTMLElement>('[data-champ-cours]')
  if (!p.blocId) {
    return document.querySelector<HTMLElement>(`[data-champ-partie="${p.champ ?? 'title'}"]`)
  }
  const bloc = document.querySelector<HTMLElement>(`[data-bloc-id="${p.blocId}"]`)
  if (!bloc) return null
  let champ = p.champ
  while (champ) {
    const el = bloc.querySelector<HTMLElement>(`[data-champ="${champ}"]`)
    if (el) return el
    const coupe = Math.max(champ.lastIndexOf('.'), champ.lastIndexOf('['))
    champ = coupe > 0 ? champ.slice(0, coupe) : ''
  }
  return bloc
}

const FOCUSABLE = 'input, textarea, select, button'

// Éditeur de cours côté enseignant — piste A « la page ».
// Thème CLAIR (data-theme="light") : on écrit sur une page blanche, comme un document. Une barre
// d'outils en haut insère une formule, un encadré, un exercice… À gauche, un plan léger pour
// naviguer entre les parties. Le serveur est la source de vérité : on charge le brouillon depuis
// l'API, on écrit chaque frappe dans un tampon local (résilience) et on enregistre côté serveur
// après une courte pause. « Publier » fige une version immuable visible des classes portées.

// Les infobulles des poignées partagent un fournisseur : passer d'un bouton à son voisin
// l'affiche sans attendre de nouveau le délai.
export function EditeurCours({ coursId }: { coursId: string }) {
  return (
    <InfobulleProvider>
      <EditeurCoursContenu coursId={coursId} />
    </InfobulleProvider>
  )
}

function EditeurCoursContenu({ coursId }: { coursId: string }) {
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null)
  const [charge, setCharge] = useState(false)
  const [erreurChargement, setErreurChargement] = useState<string | null>(null)
  const [sectionActiveId, setSectionActiveId] = useState<string>('')
  const [blocActifId, setBlocActifId] = useState<string>('')
  const [mode, setMode] = useState<'edition' | 'apercu'>('edition')
  const [etat, setEtat] = useState<EtatEnregistrement>('repos')
  const [statut, setStatut] = useState<string>('brouillon')
  const [versionPubliee, setVersionPubliee] = useState<number | null>(null)
  const [classeIds, setClasseIds] = useState<string[]>([])
  const [publierOuvert, setPublierOuvert] = useState(false)
  // Niveau du cours (ex. « 6e ») : filtre le picker de compétences aux compétences de ce niveau.
  const [niveauCode, setNiveauCode] = useState<string>('')
  const [competences, setCompetences] = useState<Competence[]>([])
  // Validation avant publication : rien n'est signalé avant le premier clic sur « Publier ».
  const [validationDemandee, setValidationDemandee] = useState(false)
  const [ciblesVerifiees, setCiblesVerifiees] = useState<Record<string, CibleVerifiee>>({})
  const [verificationEnCours, setVerificationEnCours] = useState(false)
  const [problemesServeur, setProblemesServeur] = useState<Probleme[]>([])
  const [problemeVise, setProblemeVise] = useState<Probleme | null>(null)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Sauter l'enregistrement déclenché par le tout premier rendu (le chargement lui-même).
  const vientDeCharger = useRef(false)

  // --- Chargement depuis le serveur (le tampon local prime s'il est plus récent) ---
  useEffect(() => {
    let vivant = true
    setCharge(false)
    setErreurChargement(null)
    getCoursBrouillon(apiBaseUrl(), coursId)
      .then((detail) => {
        if (!vivant) return
        const depuisServeur = brouillonDepuisContenu(coursId, detail.titre ?? '', detail.content)
        const tampon = lireTampon(coursId)
        const serveurMs = detail.updatedAt ? Date.parse(detail.updatedAt) : 0
        const b = tampon && (tampon.misAJour ?? 0) > serveurMs ? tampon : depuisServeur
        setBrouillon(b)
        if (b.sections.length > 0) setSectionActiveId(b.sections[0].id)
        setStatut(detail.statut ?? 'brouillon')
        setVersionPubliee(detail.versionPubliee ?? null)
        setClasseIds(detail.classeIds ?? [])
        setNiveauCode(detail.niveauCode ?? '')
        vientDeCharger.current = true
        setCharge(true)
      })
      .catch((e) => {
        if (!vivant) return
        setErreurChargement(
          e instanceof CoursApiError ? e.message : 'Impossible de charger ce cours.'
        )
        setCharge(true)
      })
    return () => {
      vivant = false
    }
  }, [coursId])

  // --- Référentiel de compétences (picker du bloc « objectifs ») ---
  // Chargé une fois ; un échec est silencieux (le picker affiche alors une liste vide plutôt
  // que de bloquer l'édition). Le référentiel est stable, on ne le recharge pas.
  useEffect(() => {
    let vivant = true
    listerCompetences(apiBaseUrl())
      .then((liste) => {
        if (vivant) setCompetences(liste)
      })
      .catch(() => {
        // Le picker reste utilisable sans référentiel : les objectifs en texte libre suffisent.
      })
    return () => {
      vivant = false
    }
  }, [])

  // Compétences proposées au picker : celles du niveau du cours (ou toutes si le niveau est inconnu).
  const competencesDuNiveau = useMemo(
    () => (niveauCode ? competences.filter((c) => c.niveaux?.includes(niveauCode)) : competences),
    [competences, niveauCode]
  )

  const enregistrer = useCallback(
    async (b: Brouillon) => {
      setEtat('enregistrement')
      try {
        await enregistrerCours(apiBaseUrl(), coursId, {
          titre: b.title,
          content: contenuDepuisBrouillon(b),
        })
        setEtat('enregistre')
        effacerTampon(coursId)
      } catch {
        // On garde le tampon : rien n'est perdu, l'enregistrement sera retenté à la frappe suivante.
        setEtat('echec')
      }
    },
    [coursId]
  )

  // --- Tampon local immédiat + enregistrement serveur débouncé ---
  useEffect(() => {
    if (!charge || !brouillon) return
    if (vientDeCharger.current) {
      vientDeCharger.current = false
      return
    }
    ecrireTampon(brouillon)
    setEtat('enregistrement')
    if (timer.current) clearTimeout(timer.current)
    const instantane = brouillon
    timer.current = setTimeout(() => {
      void enregistrer(instantane)
    }, DELAI_ENREGISTREMENT_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [brouillon, charge, enregistrer])

  // Force un enregistrement immédiat (avant la publication).
  const enregistrerMaintenant = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (brouillon) await enregistrer(brouillon)
  }, [brouillon, enregistrer])

  const apercu = useMemo(() => (brouillon ? brouillonVersApercu(brouillon) : null), [brouillon])

  // Un refus du serveur décrit le brouillon d'alors : toute modification le rend caduc.
  useEffect(() => {
    setProblemesServeur([])
  }, [brouillon])

  const problemes = useMemo(() => {
    if (!brouillon || !validationDemandee) return []
    const references = brouillon.sections.flatMap((s) =>
      s.blocks.flatMap((bloc) => {
        const cible = cibleAVerifier(bloc)
        const resultat = cible ? ciblesVerifiees[cleCible(cible)] : undefined
        const p = resultat === undefined ? null : problemeReference(bloc, s.id, resultat)
        return p ? [p] : []
      })
    )
    return [...problemesBrouillon(brouillon), ...references, ...problemesServeur]
  }, [brouillon, validationDemandee, ciblesVerifiees, problemesServeur])

  // Après le rendu qui affiche la bonne partie, on amène le champ fautif à l'écran.
  useEffect(() => {
    if (!problemeVise) return
    const el = elementDuProbleme(problemeVise)
    setProblemeVise(null)
    if (!el) return
    el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    const cible = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE)
    cible?.focus({ preventScroll: true })
  }, [problemeVise])

  // Les références internes se vérifient contre le catalogue à chaque ouverture de « Publier ».
  const verifierReferences = useCallback(async (b: Brouillon) => {
    const cibles = new Map<string, NonNullable<ReturnType<typeof cibleAVerifier>>>()
    for (const bloc of b.sections.flatMap((s) => s.blocks)) {
      const c = cibleAVerifier(bloc)
      if (c) cibles.set(cleCible(c), c)
    }
    if (cibles.size === 0) return
    setVerificationEnCours(true)
    const resultats = await Promise.all(
      [...cibles].map(async ([cle, c]): Promise<[string, CibleVerifiee]> => {
        try {
          return [cle, await sectionsDuChapitrePublie(apiBaseUrl(), c.level, c.subject, c.slug)]
        } catch {
          return [cle, 'erreur']
        }
      })
    )
    setCiblesVerifiees(Object.fromEntries(resultats))
    setVerificationEnCours(false)
  }, [])

  if (!charge) {
    return (
      <div
        data-theme="light"
        className="grid min-h-screen place-items-center bg-surface-page font-prose text-ink-muted"
      >
        Chargement…
      </div>
    )
  }

  if (!brouillon || !apercu) {
    return (
      <div
        data-theme="light"
        className="grid min-h-screen place-items-center bg-surface-page p-6 font-prose text-ink"
      >
        <div className="max-w-md rounded-xl border border-line bg-surface-panel p-6 text-center">
          <p className="font-display text-lg font-extrabold text-ink">Cours indisponible</p>
          <p className="mt-1 font-prose text-sm text-ink-muted">
            {erreurChargement ?? 'Ce cours n’existe pas (ou a été supprimé).'}
          </p>
          <Link
            href="/prof"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 font-display text-sm font-extrabold text-surface-panel"
          >
            Retour à mes cours
          </Link>
        </div>
      </div>
    )
  }

  const indexActif = Math.max(
    0,
    brouillon.sections.findIndex((s) => s.id === sectionActiveId)
  )
  const sectionActive = brouillon.sections[indexActif] ?? brouillon.sections[0]

  const problemesDe = (sectionId: string, blocId?: string) =>
    problemes.filter((p) => p.sectionId === sectionId && p.blocId === blocId)
  const problemesPartie = problemesDe(sectionActive.id)
  const titreCoursEnErreur = problemes.some((p) => !p.sectionId && p.champ === 'title')

  function ouvrirPublication() {
    setValidationDemandee(true)
    setPublierOuvert(true)
    void verifierReferences(brouillon!)
  }

  function allerAuProbleme(p: Probleme) {
    setPublierOuvert(false)
    setMode('edition')
    if (p.sectionId) setSectionActiveId(p.sectionId)
    if (p.blocId) setBlocActifId(p.blocId)
    setProblemeVise(p)
  }

  // --- mises à jour immuables (brouillon garanti non-null ici) ---
  function majSection(id: string, patch: Partial<Section>) {
    setBrouillon({
      ...brouillon!,
      sections: brouillon!.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })
  }

  function majBloc(sectionId: string, blocId: string, patch: Record<string, unknown>) {
    setBrouillon({
      ...brouillon!,
      sections: brouillon!.sections.map((s) =>
        s.id === sectionId
          ? { ...s, blocks: s.blocks.map((bl) => (bl.id === blocId ? { ...bl, ...patch } : bl)) }
          : s
      ),
    })
  }

  function ajouterSection() {
    const s = nouvelleSection('lesson')
    setBrouillon({ ...brouillon!, sections: [...brouillon!.sections, s] })
    setSectionActiveId(s.id)
    setMode('edition')
  }

  function deplacerSection(index: number, direction: -1 | 1) {
    setBrouillon({
      ...brouillon!,
      sections: deplacer(brouillon!.sections, index, index + direction),
    })
  }

  function supprimerSection(id: string) {
    const restantes = brouillon!.sections.filter((s) => s.id !== id)
    const sections = restantes.length > 0 ? restantes : [nouvelleSection('lesson')]
    if (id === sectionActiveId) setSectionActiveId(sections[0].id)
    setBrouillon({ ...brouillon!, sections })
  }

  // Insère un bloc à la position `index` (le « + » entre les blocs le fournit). Sans index, on
  // retombe sur l'ancien comportement : juste après le bloc en cours d'écriture, sinon à la fin.
  function insererBloc(
    type: BlocType,
    exerciseType?: ExerciceType,
    index?: number,
    preset?: ExercicePreset
  ) {
    const bloc = nouveauBloc(type, exerciseType, preset)
    const blocks = [...sectionActive.blocks]
    if (typeof index === 'number') {
      blocks.splice(index, 0, bloc)
    } else {
      const idx = blocks.findIndex((b) => b.id === blocActifId)
      if (idx >= 0) blocks.splice(idx + 1, 0, bloc)
      else blocks.push(bloc)
    }
    majSection(sectionActive.id, { blocks })
    setBlocActifId(bloc.id)
  }

  function deplacerBloc(index: number, direction: -1 | 1) {
    majSection(sectionActive.id, {
      blocks: deplacer(sectionActive.blocks, index, index + direction),
    })
  }

  function dupliquerBloc(bloc: Bloc, index: number) {
    const copie: Bloc = { ...bloc, id: nouveauBloc(bloc.type).id }
    const blocks = [...sectionActive.blocks]
    blocks.splice(index + 1, 0, copie)
    majSection(sectionActive.id, { blocks })
  }

  function supprimerBloc(blocId: string) {
    majSection(sectionActive.id, { blocks: sectionActive.blocks.filter((bl) => bl.id !== blocId) })
  }

  const coursVide =
    !brouillon.title.trim() && brouillon.sections.every((s) => s.blocks.length === 0)

  return (
    <div
      data-theme="light"
      className="flex min-h-screen flex-col bg-surface-page font-prose text-ink"
    >
      {/* -------- En-tête + barre d'outils : une seule région collante (évite un offset magique) -------- */}
      <div className="sticky top-0 z-20">
        {/* -------- En-tête -------- */}
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-panel px-4 py-3">
          <Link
            href="/prof"
            aria-label="Retour à mes cours"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-ink-muted hover:text-ink"
          >
            <Icon name="arrow-right" size={16} className="rotate-180" aria-hidden="true" />
          </Link>

          <input
            className={`min-w-0 flex-1 bg-transparent font-display text-lg font-extrabold text-ink placeholder:text-ink-muted/60 focus:outline-none ${marqueChamp}`}
            value={brouillon.title}
            onChange={(e) => setBrouillon({ ...brouillon, title: e.target.value })}
            placeholder="Titre du cours (ex. Le théorème de Pythagore)"
            aria-label="Titre du cours"
            data-champ-cours="title"
            aria-invalid={titreCoursEnErreur || undefined}
          />

          <EtatEnregistre etat={etat} />

          {statut === 'publie' && versionPubliee != null && (
            <span className="hidden items-center gap-1.5 rounded-pill bg-accent-soft px-2.5 py-0.5 font-display text-[11px] font-extrabold text-accent-ink sm:inline-flex">
              Publié · v{versionPubliee}
            </span>
          )}

          <div className="flex rounded-md border border-line bg-surface-page p-0.5">
            {(['edition', 'apercu'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-[6px] px-3 py-1.5 font-display text-sm font-extrabold ${
                  mode === m ? 'bg-surface-panel text-ink shadow-sm' : 'text-ink-muted'
                }`}
              >
                {m === 'edition' ? 'Écrire' : 'Aperçu élève'}
              </button>
            ))}
          </div>

          {/* Point d'accroche pour le futur assistant IA de rédaction (CDC §8.9) : posé mais
              inactif tant que ce chantier n'est pas lancé — aucune fausse IA. */}
          <button
            type="button"
            disabled
            title="L’aide de l’IA à la rédaction arrivera dans une prochaine version."
            className="hidden cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 font-display text-sm font-bold text-ink-muted/70 sm:inline-flex"
          >
            <span aria-hidden="true">✨</span>
            Aide-moi à rédiger
            <span className="rounded-pill bg-surface-page px-1.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wide text-ink-muted">
              bientôt
            </span>
          </button>

          <button
            type="button"
            onClick={ouvrirPublication}
            className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-extrabold text-surface-panel [box-shadow:var(--shadow-arcade)] hover:-translate-y-0.5"
          >
            Publier
          </button>
        </header>
      </div>

      {/* -------- Corps : plan + page -------- */}
      <div className="grid flex-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Plan */}
        <aside className="border-b border-line bg-surface-panel/60 p-3 lg:border-b-0 lg:border-r">
          <p className="px-2 pb-2 pt-1 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
            Le plan
          </p>
          <ol className="flex flex-col gap-1">
            {brouillon.sections.map((section, i) => (
              <li key={section.id}>
                <PlanSection
                  section={section}
                  problemes={problemes.filter((p) => p.sectionId === section.id)}
                  numero={i + 1}
                  actif={section.id === sectionActive.id}
                  premier={i === 0}
                  dernier={i === brouillon.sections.length - 1}
                  onSelectionner={() => {
                    setSectionActiveId(section.id)
                    setMode('edition')
                  }}
                  onMonter={() => deplacerSection(i, -1)}
                  onDescendre={() => deplacerSection(i, 1)}
                  onSupprimer={() => supprimerSection(section.id)}
                />
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={ajouterSection}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-2 font-display text-sm font-bold text-accent-ink hover:border-accent"
          >
            <span aria-hidden="true">＋</span> Ajouter une partie
          </button>
        </aside>

        {/* Page */}
        <main className="min-w-0 bg-surface-page px-4 py-6 sm:px-8">
          {mode === 'apercu' ? (
            <div className="mx-auto max-w-[70ch] rounded-xl border border-line bg-surface-panel p-6 sm:p-10">
              <p className="mb-4 inline-flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink">
                <Icon name="book-open" size={14} aria-hidden="true" /> Ce que verra l’élève
              </p>
              {coursVide ? (
                <p className="font-prose text-ink-muted">
                  Ton cours est encore vide. Reviens sur « Écrire » pour commencer.
                </p>
              ) : (
                <>
                  {apercu.exercicesMasques > 0 && (
                    <p className="mb-4 font-prose text-sm text-ink-muted">
                      {apercu.exercicesMasques === 1
                        ? '1 exercice incomplet n’est pas affiché dans l’aperçu.'
                        : `${apercu.exercicesMasques} exercices incomplets ne sont pas affichés dans l’aperçu.`}
                    </p>
                  )}
                  <ChapterView chapitre={apercu.chapitre} apercu />
                </>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-[72ch]">
              {/* barre de partie */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Partie {indexActif + 1} / {brouillon.sections.length}
                </span>
                <div className="flex rounded-md border border-line bg-surface-panel p-0.5">
                  {(Object.keys(SECTION_KIND_LABELS) as SectionKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => majSection(sectionActive.id, { kind: k })}
                      aria-pressed={sectionActive.kind === k}
                      className={`rounded-[6px] px-3 py-1 font-display text-xs font-bold ${
                        sectionActive.kind === k ? 'bg-surface-page text-ink' : 'text-ink-muted'
                      }`}
                    >
                      {SECTION_KIND_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>

              {/* la feuille */}
              <div className="rounded-xl border border-line bg-surface-panel px-5 py-7 shadow-sm sm:px-10">
                <input
                  className={`w-full border-0 bg-transparent p-0 font-display text-3xl font-black tracking-tight text-ink placeholder:text-ink-muted/50 focus:outline-none ${marqueChamp}`}
                  value={sectionActive.title}
                  onChange={(e) => majSection(sectionActive.id, { title: e.target.value })}
                  placeholder="Titre de la partie"
                  aria-label="Titre de la partie"
                  data-champ-partie="title"
                  aria-invalid={problemesPartie.some((p) => p.champ === 'title') || undefined}
                  aria-describedby={
                    problemesPartie.length > 0 ? `problemes-${sectionActive.id}` : undefined
                  }
                />
                <div className="mt-1 h-px bg-line" />
                <ListeProblemes id={`problemes-${sectionActive.id}`} problemes={problemesPartie} />

                {sectionActive.blocks.length === 0 ? (
                  <div className="mt-6" data-champ-partie="blocks">
                    <p className="mb-3 font-prose text-ink-muted">
                      Cette partie est encore vide. Ajoute ton premier bloc :
                    </p>
                    <AjoutBloc prominent onInserer={(t, e, p) => insererBloc(t, e, 0, p)} />
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col">
                    <AjoutBloc onInserer={(t, e, p) => insererBloc(t, e, 0, p)} />
                    {sectionActive.blocks.map((bloc, i) => (
                      <Fragment key={bloc.id}>
                        <BlocLigne
                          blocId={bloc.id}
                          problemes={problemesDe(sectionActive.id, bloc.id)}
                          actif={bloc.id === blocActifId}
                          premier={i === 0}
                          dernier={i === sectionActive.blocks.length - 1}
                          onMonter={() => deplacerBloc(i, -1)}
                          onDescendre={() => deplacerBloc(i, 1)}
                          onDupliquer={() => dupliquerBloc(bloc, i)}
                          onSupprimer={() => supprimerBloc(bloc.id)}
                        >
                          <BlocEditeur
                            bloc={bloc}
                            onModifier={(patch) => majBloc(sectionActive.id, bloc.id, patch)}
                            onFocusBloc={() => setBlocActifId(bloc.id)}
                            competences={competencesDuNiveau}
                          />
                        </BlocLigne>
                        <AjoutBloc onInserer={(t, e, p) => insererBloc(t, e, i + 1, p)} />
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* navigation entre parties */}
              <nav className="mt-4 flex items-center justify-between gap-3">
                <NavPartie
                  sens="précédent"
                  section={brouillon.sections[indexActif - 1]}
                  onClick={() => setSectionActiveId(brouillon.sections[indexActif - 1].id)}
                />
                <NavPartie
                  sens="suivant"
                  section={brouillon.sections[indexActif + 1]}
                  onClick={() => setSectionActiveId(brouillon.sections[indexActif + 1].id)}
                />
              </nav>
            </div>
          )}
        </main>
      </div>

      {publierOuvert && (
        <PublierCours
          coursId={coursId}
          brouillon={brouillon}
          problemes={problemes}
          verificationEnCours={verificationEnCours}
          classeIdsInitiales={classeIds}
          onAvantPublicationAction={enregistrerMaintenant}
          onAllerAuProblemeAction={allerAuProbleme}
          onRefusServeurAction={(violations: ViolationContenu[]) =>
            setProblemesServeur(problemesDepuisViolations(violations))
          }
          onPublieAction={(version) => {
            setStatut('publie')
            setVersionPubliee(version)
          }}
          onFermerAction={() => setPublierOuvert(false)}
        />
      )}
    </div>
  )
}

// Petit indicateur d'état d'enregistrement, en remplacement du badge statique « Enregistré ».
function EtatEnregistre({ etat }: { etat: EtatEnregistrement }) {
  const config: Record<EtatEnregistrement, { texte: string; couleur: string }> = {
    repos: { texte: 'Enregistré', couleur: 'bg-success' },
    enregistrement: { texte: 'Enregistrement…', couleur: 'bg-xp' },
    enregistre: { texte: 'Enregistré', couleur: 'bg-success' },
    echec: { texte: 'Échec de l’enregistrement', couleur: 'bg-danger' },
  }
  const { texte, couleur } = config[etat]
  return (
    <span
      role="status"
      className="hidden items-center gap-2 font-display text-xs font-bold text-ink-muted sm:inline-flex"
    >
      <span className={`h-2 w-2 rounded-full ${couleur}`} aria-hidden="true" />
      {texte}
    </span>
  )
}

// Un « + » entre deux blocs : discret (une fine ligne au survol), il ouvre au clic le menu des
// blocs — contenu d'un côté, exercices de l'autre — et insère le bloc choisi juste à cet endroit.
// Remplace l'ancienne barre « Insérer » du haut : on ajoute là où on est, jamais « quelque part ».
function AjoutBloc({
  onInserer,
  prominent,
}: {
  onInserer: (type: BlocType, exerciseType?: ExerciceType, preset?: ExercicePreset) => void
  prominent?: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    function surClic(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    function surTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', surClic)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('mousedown', surClic)
      document.removeEventListener('keydown', surTouche)
    }
  }, [ouvert])

  const contenu = BLOCS.filter((b) => b.type !== 'exercise')
  const exercices = BLOCS.filter((b) => b.type === 'exercise')

  function choisir(type: BlocType, exerciseType?: ExerciceType, preset?: ExercicePreset) {
    onInserer(type, exerciseType, preset)
    setOuvert(false)
  }

  const itemClass =
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-prose text-[13px] text-ink hover:bg-accent-soft'
  const iconClass =
    'grid h-6 w-6 shrink-0 place-items-center rounded border border-line bg-surface-page font-display text-xs text-accent'

  return (
    <div ref={ref} className="relative">
      <div
        className={`group flex items-center gap-2 ${
          prominent ? '' : 'py-0.5 opacity-45 transition-opacity hover:opacity-100'
        } ${ouvert ? 'opacity-100' : ''}`}
      >
        {!prominent && (
          <span className="h-px flex-1 bg-line transition-colors group-hover:bg-accent/40" />
        )}
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-haspopup="menu"
          aria-label="Ajouter un bloc ici"
          className={
            prominent
              ? 'inline-flex items-center gap-2 rounded-lg border border-dashed border-line px-4 py-2.5 font-display text-sm font-bold text-accent-ink hover:border-accent hover:bg-accent-soft'
              : 'grid h-6 w-6 place-items-center rounded-full border border-line bg-surface-panel font-display text-base font-bold leading-none text-ink-muted group-hover:border-accent group-hover:text-accent'
          }
        >
          <span aria-hidden="true">＋</span>
          {prominent && 'Ajouter un bloc'}
        </button>
        {!prominent && (
          <span className="h-px flex-1 bg-line transition-colors group-hover:bg-accent/40" />
        )}
      </div>

      {ouvert && (
        <div
          role="menu"
          className="absolute left-1/2 top-full z-30 mt-1 w-[min(340px,90vw)] -translate-x-1/2 rounded-xl border border-line bg-surface-panel p-2 shadow-lg"
        >
          <p className="px-2 pb-1 pt-1 font-display text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">
            Contenu
          </p>
          <div className="grid grid-cols-2 gap-0.5">
            {contenu.map((b) => (
              <button
                key={b.type}
                type="button"
                role="menuitem"
                title={b.description}
                onClick={() => choisir(b.type, b.exerciseType)}
                className={itemClass}
              >
                <span aria-hidden="true" className={iconClass}>
                  {b.icone}
                </span>
                {b.label}
              </button>
            ))}
          </div>
          <p className="px-2 pb-1 pt-2 font-display text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">
            Exercices
          </p>
          <div className="grid grid-cols-2 gap-0.5">
            {exercices.map((b) => (
              <button
                key={b.label}
                type="button"
                role="menuitem"
                title={b.description}
                onClick={() => choisir(b.type, b.exerciseType, b.preset)}
                className={itemClass}
              >
                <span aria-hidden="true" className={iconClass}>
                  {b.icone}
                </span>
                {b.label}
              </button>
            ))}
          </div>

          {/* Accroche du futur assistant IA (CDC §8.9) : visible mais inactif. */}
          <div
            role="menuitem"
            aria-disabled="true"
            title="L’aide de l’IA à la rédaction arrivera dans une prochaine version."
            className="mt-1 flex items-center gap-2 border-t border-line px-2 pb-1 pt-2 font-prose text-[13px] text-ink-muted/70"
          >
            <span aria-hidden="true" className={iconClass}>
              ✨
            </span>
            Rédiger avec l’IA
            <span className="ml-auto rounded-pill bg-surface-page px-1.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wide text-ink-muted">
              bientôt
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Une ligne de la feuille : le bloc, avec ses poignées. La barre se pose à cheval sur le bord
// haut du bloc (sur la ligne d'insertion au-dessus) pour ne pas masquer le début du texte ; elle
// apparaît au survol, au focus et sur le bloc actif. Au toucher (pas de survol), elle reste
// visible et rentre dans le flux, au-dessus du bloc.
function BlocLigne({
  children,
  blocId,
  problemes,
  actif,
  premier,
  dernier,
  onMonter,
  onDescendre,
  onDupliquer,
  onSupprimer,
}: {
  children: React.ReactNode
  blocId: string
  problemes: Probleme[]
  actif: boolean
  premier: boolean
  dernier: boolean
  onMonter: () => void
  onDescendre: () => void
  onDupliquer: () => void
  onSupprimer: () => void
}) {
  const descriptionId = `problemes-${blocId}`
  const bloquant = problemes.some((p) => p.gravite === 'bloquant')
  const contexte = useMemo(() => ({ problemes, descriptionId }), [problemes, descriptionId])
  return (
    <div
      data-bloc-id={blocId}
      className={`group relative flex flex-col rounded-md border-l-2 py-2.5 pl-4 pr-2 transition-colors ${
        bloquant ? 'border-danger' : actif ? 'border-accent' : 'border-transparent'
      } ${actif ? 'bg-surface-page/60' : 'hover:bg-surface-page/40'}`}
    >
      <ProblemesDuBlocProvider value={contexte}>{children}</ProblemesDuBlocProvider>
      <ListeProblemes id={descriptionId} problemes={problemes} />
      <div
        className={`absolute -top-5 right-2 z-10 flex items-center gap-0.5 rounded-md border border-line bg-surface-panel p-0.5 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:static pointer-coarse:order-first pointer-coarse:mb-2 pointer-coarse:ml-auto pointer-coarse:w-fit pointer-coarse:opacity-100 ${
          actif ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <Poignee label="Monter" icone="arrow-up" onClick={onMonter} disabled={premier} />
        <Poignee label="Descendre" icone="arrow-down" onClick={onDescendre} disabled={dernier} />
        <Poignee label="Dupliquer" icone="copy" onClick={onDupliquer} />
        <Poignee label="Supprimer" icone="trash" onClick={onSupprimer} danger />
      </div>
    </div>
  )
}

// Les problèmes de publication d'un bloc ou d'une partie, sous ce qu'ils concernent. Un même
// libellé n'apparaît qu'une fois (trois cases vides d'un tableau → « Remplis chaque case »).
function ListeProblemes({ id, problemes }: { id: string; problemes: Probleme[] }) {
  if (problemes.length === 0) return null
  const uniques = problemes.filter(
    (p, i) => problemes.findIndex((q) => q.message === p.message) === i
  )
  return (
    <ul id={id} aria-label="À corriger avant de publier" className="mt-2 flex flex-col gap-1">
      {uniques.map((p) => (
        <li
          key={p.message}
          className={`flex items-start gap-1.5 font-prose text-sm ${
            p.gravite === 'bloquant' ? 'text-danger' : 'text-ink'
          }`}
        >
          <span
            aria-hidden="true"
            className={p.gravite === 'bloquant' ? 'text-danger' : 'text-warning'}
          >
            ⚠
          </span>
          <span>
            <span className="sr-only">
              {p.gravite === 'bloquant' ? 'À corriger : ' : 'À vérifier : '}
            </span>
            {p.message}
          </span>
        </li>
      ))}
    </ul>
  )
}

// Bouton d'action à icône seule : l'infobulle nomme l'opération au survol et au focus clavier,
// l'aria-label la nomme aux lecteurs d'écran. Cible de 32 px, 44 px au toucher.
function Poignee({
  label,
  icone,
  onClick,
  disabled,
  danger,
}: {
  label: string
  icone: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <Infobulle label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`grid h-8 w-8 place-items-center rounded-sm text-ink-muted hover:bg-surface-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 disabled:hover:bg-transparent pointer-coarse:h-11 pointer-coarse:w-11 ${
          danger ? 'hover:text-danger' : 'hover:text-ink'
        }`}
      >
        <Icon name={icone} size={18} />
      </button>
    </Infobulle>
  )
}

function PlanSection({
  section,
  problemes,
  numero,
  actif,
  premier,
  dernier,
  onSelectionner,
  onMonter,
  onDescendre,
  onSupprimer,
}: {
  section: Section
  problemes: Probleme[]
  numero: number
  actif: boolean
  premier: boolean
  dernier: boolean
  onSelectionner: () => void
  onMonter: () => void
  onDescendre: () => void
  onSupprimer: () => void
}) {
  return (
    <div
      className={`group rounded-md border ${
        actif ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-surface-page'
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={onSelectionner}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-surface-page font-display text-[11px] font-extrabold text-ink-muted">
            {numero}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[13px] font-extrabold text-ink">
              {section.title.trim() || 'Partie sans titre'}
            </span>
            <span className="block font-prose text-[11px] text-ink-muted">
              {SECTION_KIND_LABELS[section.kind]} · {section.blocks.length} bloc
              {section.blocks.length > 1 ? 's' : ''}
            </span>
            <CompteProblemes problemes={problemes} />
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
          <Poignee
            label="Monter la partie"
            icone="arrow-up"
            onClick={onMonter}
            disabled={premier}
          />
          <Poignee
            label="Descendre la partie"
            icone="arrow-down"
            onClick={onDescendre}
            disabled={dernier}
          />
          <Poignee label="Supprimer la partie" icone="trash" onClick={onSupprimer} danger />
        </div>
      </div>
    </div>
  )
}

// Dans le plan : combien de points restent à corriger (ou à vérifier) dans la partie.
function CompteProblemes({ problemes }: { problemes: Probleme[] }) {
  if (problemes.length === 0) return null
  const bloquants = problemes.filter((p) => p.gravite === 'bloquant').length
  const texte = bloquants > 0 ? `${bloquants} à corriger` : `${problemes.length} à vérifier`
  return (
    <span
      className={`mt-0.5 inline-flex items-center gap-1 font-display text-[11px] font-extrabold ${
        bloquants > 0 ? 'text-danger' : 'text-ink-muted'
      }`}
    >
      <span aria-hidden="true" className={bloquants > 0 ? 'text-danger' : 'text-warning'}>
        ⚠
      </span>
      {texte}
    </span>
  )
}

function NavPartie({
  sens,
  section,
  onClick,
}: {
  sens: 'précédent' | 'suivant'
  section: Section | undefined
  onClick: () => void
}) {
  if (!section) return <span />
  const titre = section.title.trim() || 'Partie sans titre'
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-line bg-surface-panel px-4 py-2 hover:border-accent"
    >
      {sens === 'précédent' && <span aria-hidden="true">‹</span>}
      <span className="flex flex-col text-left">
        <span className="font-prose text-[11px] text-ink-muted">
          {sens === 'précédent' ? 'Précédent' : 'Suivant'}
        </span>
        <span className="font-display text-sm font-extrabold text-ink">{titre}</span>
      </span>
      {sens === 'suivant' && <span aria-hidden="true">›</span>}
    </button>
  )
}
