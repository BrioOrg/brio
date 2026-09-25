'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CoursApiError, enregistrerCours, getCoursBrouillon } from '@brio/api-client'

import { ChapterView, type ChapitreResponse } from '@/components/chapter-view'
import { Icon } from '@/components/ui/icon'
import { BlocEditeur } from '@/components/prof/bloc-editeur'
import { PublierCours } from '@/components/prof/publier-cours'
import {
  BLOCS,
  SECTION_KIND_LABELS,
  brouillonDepuisContenu,
  contenuDepuisBrouillon,
  deplacer,
  ecrireTampon,
  effacerTampon,
  lireTampon,
  nouveauBloc,
  nouvelleSection,
  type Bloc,
  type BlocType,
  type Brouillon,
  type ExerciceType,
  type Section,
  type SectionKind,
} from '@/lib/cours-editeur'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

// Délai d'inactivité avant un enregistrement serveur : assez court pour ne rien perdre, assez
// long pour ne pas écrire à chaque frappe. Le tampon local, lui, est écrit immédiatement.
const DELAI_ENREGISTREMENT_MS = 1500

type EtatEnregistrement = 'repos' | 'enregistrement' | 'enregistre' | 'echec'

// Éditeur de cours côté enseignant — piste A « la page ».
// Thème CLAIR (data-theme="light") : on écrit sur une page blanche, comme un document. Une barre
// d'outils en haut insère une formule, un encadré, un exercice… À gauche, un plan léger pour
// naviguer entre les parties. Le serveur est la source de vérité : on charge le brouillon depuis
// l'API, on écrit chaque frappe dans un tampon local (résilience) et on enregistre côté serveur
// après une courte pause. « Publier » fige une version immuable visible des classes portées.

export function EditeurCours({ coursId }: { coursId: string }) {
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

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Sauter l'enregistrement déclenché par le tout premier rendu (le chargement lui-même).
  const vientDeCharger = useRef(false)

  // --- Chargement depuis le serveur (le tampon local prime s'il est plus récent) ---
  useEffect(() => {
    let vivant = true
    setCharge(false)
    setErreurChargement(null)
    getCoursBrouillon(API_URL, coursId)
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

  const enregistrer = useCallback(
    async (b: Brouillon) => {
      setEtat('enregistrement')
      try {
        await enregistrerCours(API_URL, coursId, {
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

  const apercu = useMemo(
    () => (brouillon ? (brouillon as unknown as ChapitreResponse) : null),
    [brouillon]
  )

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

  // Insère un bloc juste après celui en cours d'écriture (sinon à la fin de la partie).
  function insererBloc(type: BlocType, exerciseType?: ExerciceType) {
    const bloc = nouveauBloc(type, exerciseType)
    const blocks = [...sectionActive.blocks]
    const idx = blocks.findIndex((b) => b.id === blocActifId)
    if (idx >= 0) blocks.splice(idx + 1, 0, bloc)
    else blocks.push(bloc)
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
            className="min-w-0 flex-1 bg-transparent font-display text-lg font-extrabold text-ink placeholder:text-ink-muted/60 focus:outline-none"
            value={brouillon.title}
            onChange={(e) => setBrouillon({ ...brouillon, title: e.target.value })}
            placeholder="Titre du cours (ex. Le théorème de Pythagore)"
            aria-label="Titre du cours"
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

          <button
            type="button"
            onClick={() => setPublierOuvert(true)}
            className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-extrabold text-surface-panel [box-shadow:var(--shadow-arcade)] hover:-translate-y-0.5"
          >
            Publier
          </button>
        </header>

        {/* -------- Barre d'outils (insertion) -------- */}
        {mode === 'edition' && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line bg-surface-panel/95 px-4 py-2 backdrop-blur">
            <span className="mr-1 shrink-0 font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
              Insérer :
            </span>
            {BLOCS.map((b) => (
              <button
                key={b.exerciseType ?? b.type}
                type="button"
                title={b.description}
                onClick={() => insererBloc(b.type, b.exerciseType)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface-page px-2.5 py-1.5 font-display text-[13px] font-bold text-ink transition-colors hover:border-accent hover:bg-accent-soft"
              >
                <span aria-hidden="true" className="text-accent">
                  {b.icone}
                </span>
                {b.label}
              </button>
            ))}
          </div>
        )}
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
                <ChapterView chapitre={apercu} />
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
                  className="w-full border-0 bg-transparent p-0 font-display text-3xl font-black tracking-tight text-ink placeholder:text-ink-muted/50 focus:outline-none"
                  value={sectionActive.title}
                  onChange={(e) => majSection(sectionActive.id, { title: e.target.value })}
                  placeholder="Titre de la partie"
                  aria-label="Titre de la partie"
                />
                <div className="mt-1 h-px bg-line" />

                {sectionActive.blocks.length === 0 ? (
                  <p className="mt-6 font-prose text-ink-muted">
                    Commence à écrire, ou utilise la barre « Insérer » en haut pour ajouter une
                    formule, un exemple, un exercice…
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col">
                    {sectionActive.blocks.map((bloc, i) => (
                      <BlocLigne
                        key={bloc.id}
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
                        />
                      </BlocLigne>
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
          classeIdsInitiales={classeIds}
          onAvantPublicationAction={enregistrerMaintenant}
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

// Une ligne de la feuille : le bloc, avec des poignées discrètes qui apparaissent au survol.
function BlocLigne({
  children,
  actif,
  premier,
  dernier,
  onMonter,
  onDescendre,
  onDupliquer,
  onSupprimer,
}: {
  children: React.ReactNode
  actif: boolean
  premier: boolean
  dernier: boolean
  onMonter: () => void
  onDescendre: () => void
  onDupliquer: () => void
  onSupprimer: () => void
}) {
  return (
    <div
      className={`group relative rounded-md border-l-2 py-2.5 pl-4 pr-2 transition-colors ${
        actif ? 'border-accent bg-surface-page/60' : 'border-transparent hover:bg-surface-page/40'
      }`}
    >
      {children}
      <div
        className={`absolute right-1 top-1 flex items-center gap-0.5 rounded-md border border-line bg-surface-panel p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100`}
      >
        <Poignee label="Monter" onClick={onMonter} disabled={premier}>
          ↑
        </Poignee>
        <Poignee label="Descendre" onClick={onDescendre} disabled={dernier}>
          ↓
        </Poignee>
        <Poignee label="Dupliquer" onClick={onDupliquer}>
          ⧉
        </Poignee>
        <Poignee label="Supprimer" onClick={onSupprimer} danger>
          <Icon name="x" size={13} aria-hidden="true" />
        </Poignee>
      </div>
    </div>
  )
}

function Poignee({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-6 w-6 place-items-center rounded font-display text-xs font-extrabold disabled:opacity-30 ${
        danger ? 'text-ink-muted hover:text-danger' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function PlanSection({
  section,
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
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Poignee label="Monter la partie" onClick={onMonter} disabled={premier}>
            ↑
          </Poignee>
          <Poignee label="Descendre la partie" onClick={onDescendre} disabled={dernier}>
            ↓
          </Poignee>
          <Poignee label="Supprimer la partie" onClick={onSupprimer} danger>
            <Icon name="x" size={12} aria-hidden="true" />
          </Poignee>
        </div>
      </div>
    </div>
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
