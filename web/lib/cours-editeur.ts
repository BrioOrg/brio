// Modèle d'édition d'un cours d'enseignant (piste 4 « le plan, puis le focus »).
//
// Un cours = un chapitre → des sections → des blocs, exactement la forme que <ChapterView/>
// sait déjà afficher (ADR 0019 §1). Ce module ne contient que de la logique pure (fabriques,
// déplacement, persistance locale) pour rester testable sans le DOM. L'écriture vers le serveur
// (créer / enregistrer / publier un brouillon) est une étape suivante — ici on persiste en local.

// Les types de blocs que l'afficheur élève sait rendre AUJOURD'HUI (chapter-view.tsx). On s'y
// limite volontairement : inutile de laisser écrire des blocs qui n'apparaîtraient pas.
export type BlocType =
  'heading' | 'prose' | 'objectives' | 'formula' | 'callout' | 'steps' | 'exercise'

/** Une étape d'un bloc « exemple en étapes » : un texte, et éventuellement une formule. */
export type Etape = { text: string; formula?: string }

export type Bloc = {
  id: string
  type: BlocType
  [champ: string]: unknown
}

export type SectionKind = 'lesson' | 'exercises'

export type Section = {
  id: string
  title: string
  kind: SectionKind
  blocks: Bloc[]
}

export type Brouillon = {
  schemaVersion: number
  id: string
  title: string
  subject?: string
  level?: string
  sections: Section[]
  /** Horodatage local du dernier enregistrement (pour trier « Mes cours » du plus récent). */
  misAJour?: number
}

// Catalogue des blocs proposés dans le « + Ajouter un bloc », dans l'ordre du menu.
export const BLOCS: { type: BlocType; label: string; description: string; icone: string }[] = [
  { type: 'heading', label: 'Titre', description: 'Un intertitre dans la section', icone: 'T' },
  { type: 'objectives', label: 'Objectifs', description: 'Ce que l’élève saura faire', icone: '★' },
  { type: 'prose', label: 'Texte', description: 'Un paragraphe d’explication', icone: '¶' },
  { type: 'formula', label: 'Formule', description: 'Une formule mathématique', icone: '∑' },
  { type: 'callout', label: 'Encadré', description: 'Définition, exemple, attention…', icone: '▣' },
  { type: 'steps', label: 'Étapes', description: 'Un exemple résolu, étape par étape', icone: '≣' },
  { type: 'exercise', label: 'Exercice', description: 'Un exercice sur feuille', icone: '✎' },
]

export const BLOC_LABELS: Record<BlocType, string> = {
  heading: 'Titre',
  objectives: 'Objectifs',
  prose: 'Texte',
  formula: 'Formule',
  callout: 'Encadré',
  steps: 'Étapes',
  exercise: 'Exercice',
}

// Variantes d'encadré reconnues par l'afficheur (CALLOUT dans chapter-view.tsx).
export const CALLOUT_VARIANTES: { valeur: string; label: string }[] = [
  { valeur: 'definition', label: 'Définition' },
  { valeur: 'example', label: 'Exemple' },
  { valeur: 'note', label: 'À noter' },
  { valeur: 'tip', label: 'Astuce' },
  { valeur: 'warning', label: 'Attention' },
]

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  lesson: 'Leçon',
  exercises: 'Exercices',
}

/** Identifiant stable pour une section ou un bloc. */
export function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Repli si crypto.randomUUID n'est pas disponible (très vieux runtime).
  return 'id-' + Math.abs(hashCode(String(performance.now?.() ?? 0) + ':' + counter++)).toString(36)
}
let counter = 0
function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

/** Un bloc neuf du type demandé, avec des valeurs par défaut vides mais valides. */
export function nouveauBloc(type: BlocType): Bloc {
  switch (type) {
    case 'heading':
      return { id: genId(), type, text: '', level: 1 }
    case 'prose':
      return { id: genId(), type, text: '' }
    case 'formula':
      return { id: genId(), type, latex: '', display: 'block' }
    case 'objectives':
      // Objectifs en texte libre : ce que l'élève saura faire à la fin. La grille de
      // compétences codées (référentiel ADR 0009) est un ajout séparé, plus tard.
      return { id: genId(), type, title: '', items: [''] }
    case 'callout':
      return { id: genId(), type, variant: 'definition', title: '', text: '' }
    case 'steps':
      // Un exemple résolu : un titre optionnel et une première étape prête à remplir.
      return { id: genId(), type, title: '', steps: [{ text: '' }] as Etape[] }
    case 'exercise':
      // « Sur feuille » : auto-corrigé, sans note serveur — le seul type dont l'afficheur
      // connaît tous les champs (prompt + statement + solution).
      return { id: genId(), type, exerciseType: 'paper', prompt: '', statement: '', solution: '' }
  }
}

/** Une section neuve (une leçon par défaut) avec un titre vide et aucun bloc. */
export function nouvelleSection(kind: SectionKind = 'lesson'): Section {
  return { id: genId(), title: '', kind, blocks: [] }
}

/** Un brouillon vierge : un titre vide et une première section prête à remplir. */
export function nouveauBrouillon(): Brouillon {
  return {
    schemaVersion: 1,
    id: genId(),
    title: '',
    sections: [nouvelleSection('lesson')],
  }
}

/**
 * Déplace l'élément d'index `from` vers l'index `to`, sans muter la liste d'origine.
 * Renvoie la liste inchangée si un index sort des bornes (utile pour « monter » le 1er élément).
 */
export function deplacer<T>(liste: T[], from: number, to: number): T[] {
  if (from < 0 || from >= liste.length || to < 0 || to >= liste.length || from === to) {
    return liste
  }
  const copie = [...liste]
  const [item] = copie.splice(from, 1)
  copie.splice(to, 0, item)
  return copie
}

/** Résumé court d'un bloc pour l'afficher dans le plan (scommence par son contenu réel). */
export function apercuBloc(bloc: Bloc): string {
  const premiereEtape =
    Array.isArray(bloc.steps) && bloc.steps[0] && typeof (bloc.steps[0] as Etape).text === 'string'
      ? (bloc.steps[0] as Etape).text
      : ''
  const premierItem =
    Array.isArray(bloc.items) && typeof bloc.items[0] === 'string' ? (bloc.items[0] as string) : ''
  const brut =
    (typeof bloc.text === 'string' && bloc.text) ||
    (typeof bloc.prompt === 'string' && bloc.prompt) ||
    (typeof bloc.title === 'string' && bloc.title) ||
    (typeof bloc.latex === 'string' && bloc.latex) ||
    premiereEtape ||
    premierItem ||
    ''
  const nettoye = brut.replace(/[*$]/g, '').trim()
  if (!nettoye) return BLOC_LABELS[bloc.type]
  return nettoye.length > 42 ? nettoye.slice(0, 42) + '…' : nettoye
}

// --- Persistance locale (« Mes cours » : une collection de brouillons, par id) ---
// La publication vers le serveur viendra ensuite ; en attendant, les cours vivent en local.
const CLE_COLLECTION = 'brio.prof.cours'
const CLE_ANCIENNE = 'brio.prof.brouillon' // ancien stockage (un seul brouillon) → migré

function lireCollection(): Brouillon[] {
  if (typeof window === 'undefined') return []
  try {
    const brut = window.localStorage.getItem(CLE_COLLECTION)
    if (brut) {
      const parse = JSON.parse(brut)
      if (Array.isArray(parse)) return parse as Brouillon[]
    }
    // Migration : un ancien brouillon unique devient le premier cours de la collection.
    const ancien = window.localStorage.getItem(CLE_ANCIENNE)
    if (ancien) {
      const b = JSON.parse(ancien) as Brouillon
      if (b && Array.isArray(b.sections)) {
        ecrireCollection([b])
        window.localStorage.removeItem(CLE_ANCIENNE)
        return [b]
      }
    }
  } catch {
    // Stockage illisible : on repart d'une collection vide.
  }
  return []
}

function ecrireCollection(liste: Brouillon[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CLE_COLLECTION, JSON.stringify(liste))
  } catch {
    // Quota plein ou stockage indisponible : on ignore silencieusement.
  }
}

function maintenant(): number {
  return typeof Date !== 'undefined' ? Date.now() : 0
}

/** Tous les cours en brouillon, du plus récemment modifié au plus ancien. */
export function listerBrouillons(): Brouillon[] {
  return [...lireCollection()].sort((a, b) => (b.misAJour ?? 0) - (a.misAJour ?? 0))
}

/** Un cours par son id, ou null s'il n'existe pas (encore). */
export function chargerBrouillon(id: string): Brouillon | null {
  return lireCollection().find((b) => b.id === id) ?? null
}

/** Crée ou met à jour un cours dans la collection, en l'horodatant. */
export function enregistrerBrouillon(brouillon: Brouillon): void {
  const horodate: Brouillon = { ...brouillon, misAJour: maintenant() }
  const liste = lireCollection()
  const i = liste.findIndex((b) => b.id === brouillon.id)
  if (i >= 0) liste[i] = horodate
  else liste.push(horodate)
  ecrireCollection(liste)
}

/** Retire définitivement un cours de la collection locale. */
export function supprimerBrouillon(id: string): void {
  ecrireCollection(lireCollection().filter((b) => b.id !== id))
}

/** Petit résumé d'un cours pour la carte « Mes cours ». */
export function resumeBrouillon(b: Brouillon): { parties: number; blocs: number } {
  return {
    parties: b.sections.length,
    blocs: b.sections.reduce((n, s) => n + s.blocks.length, 0),
  }
}

// --- Pont avec le serveur (ADR 0019 §1) -------------------------------------
// Le contenu d'un cours est un document du même schéma que <ChapterView/>. On envoie ce
// document au serveur et on le relit tel quel : les champs de tenue locale (misAJour…) ne
// font pas partie du schéma et ne voyagent donc pas.

/** Le document de contenu tel que le serveur le stocke et que l'afficheur élève le rend. */
export type CoursContent = {
  schemaVersion: number
  id: string
  title: string
  subject?: string
  level?: string
  sections: Section[]
}

/** Extrait du brouillon le seul document de contenu (sans les champs de tenue locale). */
export function contenuDepuisBrouillon(b: Brouillon): CoursContent {
  return {
    schemaVersion: b.schemaVersion,
    id: b.id,
    title: b.title,
    ...(b.subject ? { subject: b.subject } : {}),
    ...(b.level ? { level: b.level } : {}),
    sections: b.sections,
  }
}

/**
 * Reconstruit un brouillon éditable depuis le contenu renvoyé par le serveur. `coursId` (l'id
 * serveur) devient l'id du document ; `titre` fait foi (il vit dans une colonne à part). Un
 * contenu vide (cours fraîchement créé) démarre sur une première partie prête à remplir.
 */
export function brouillonDepuisContenu(
  coursId: string,
  titre: string,
  content: unknown
): Brouillon {
  const doc = (content && typeof content === 'object' ? content : {}) as Partial<CoursContent>
  const sections =
    Array.isArray(doc.sections) && doc.sections.length > 0
      ? (doc.sections as Section[])
      : [nouvelleSection('lesson')]
  return {
    schemaVersion: typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1,
    id: coursId,
    title: titre,
    subject: doc.subject,
    level: doc.level,
    sections,
  }
}

// --- Tampon local par cours (résilience) ------------------------------------
// À côté de l'enregistrement serveur (débounce), on écrit chaque frappe dans un tampon local
// indexé par l'id serveur du cours. Il survit à un rechargement entre deux enregistrements et
// n'est effacé qu'une fois la synchronisation serveur confirmée.
const CLE_TAMPON = 'brio.prof.tampon.'

/** Le brouillon en tampon pour ce cours, ou null. */
export function lireTampon(coursId: string): Brouillon | null {
  if (typeof window === 'undefined') return null
  try {
    const brut = window.localStorage.getItem(CLE_TAMPON + coursId)
    if (!brut) return null
    const b = JSON.parse(brut) as Brouillon
    return b && Array.isArray(b.sections) ? b : null
  } catch {
    return null
  }
}

/** Écrit (horodaté) le brouillon en tampon pour ce cours. */
export function ecrireTampon(b: Brouillon): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CLE_TAMPON + b.id, JSON.stringify({ ...b, misAJour: maintenant() }))
  } catch {
    // Quota plein ou stockage indisponible : on ignore (le serveur reste la source de vérité).
  }
}

/** Efface le tampon d'un cours (après une synchronisation serveur réussie). */
export function effacerTampon(coursId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CLE_TAMPON + coursId)
  } catch {
    // Ignoré.
  }
}
