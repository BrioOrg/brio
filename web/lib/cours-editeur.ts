// Modèle d'édition d'un cours d'enseignant (piste 4 « le plan, puis le focus »).
//
// Un cours = un chapitre → des sections → des blocs, exactement la forme que <ChapterView/>
// sait déjà afficher (ADR 0019 §1). Ce module ne contient que de la logique pure (fabriques,
// déplacement, persistance locale) pour rester testable sans le DOM. L'écriture vers le serveur
// (créer / enregistrer / publier un brouillon) est une étape suivante — ici on persiste en local.

import type { ChapitreResponse } from '@/components/chapter-view'

// Les types de blocs que l'afficheur élève sait rendre AUJOURD'HUI (chapter-view.tsx). On s'y
// limite volontairement : inutile de laisser écrire des blocs qui n'apparaîtraient pas.
export type BlocType =
  | 'heading'
  | 'prose'
  | 'objectives'
  | 'formula'
  | 'callout'
  | 'steps'
  | 'table'
  | 'reference'
  | 'figure'
  | 'exercise'

/** Une étape d'un bloc « exemple en étapes » : un texte, et éventuellement une formule. */
export type Etape = { text: string; formula?: string }

/** Une proposition d'un QCM : un texte montré à l'élève et un drapeau « bonne réponse ». */
export type Choix = { id: string; text: string; correct: boolean }

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

// Les types d'exercice que l'afficheur élève sait rendre ET que le serveur sait corriger :
// QCM, réponse courte, numérique, texte à trous (schéma « $defs » + evaluators du module
// exercices). « paper » (sur feuille, `$defs/paperFields`) est auto-évalué côté élève. Les champs
// de correction sont retirés à la publication par l'ExerciceExtractor (ADR 0019 §4).
export type ExerciceType = 'multiple-choice' | 'short-answer' | 'numeric' | 'fill-blank' | 'paper'

// Un « préréglage » d'exercice : même `exerciseType` côté schéma, mais pré-rempli pour un usage
// courant. `true-false` = un QCM à deux propositions « Vrai » / « Faux » — aucun changement de
// schéma ni de correction côté serveur, c'est un QCM comme un autre.
export type ExercicePreset = 'true-false'

// Catalogue des blocs proposés dans la barre « Insérer », dans l'ordre du menu. Un bloc
// « exercise » porte en plus un `exerciseType` : chaque type a sa propre entrée (pas de
// sélecteur caché dans le bloc), pour qu'insérer un QCM ou une réponse courte soit un seul geste.
export const BLOCS: {
  type: BlocType
  exerciseType?: ExerciceType
  preset?: ExercicePreset
  label: string
  description: string
  icone: string
}[] = [
  { type: 'heading', label: 'Titre', description: 'Un intertitre dans la section', icone: 'T' },
  { type: 'objectives', label: 'Objectifs', description: 'Ce que l’élève saura faire', icone: '★' },
  { type: 'prose', label: 'Texte', description: 'Un paragraphe d’explication', icone: '¶' },
  { type: 'formula', label: 'Formule', description: 'Une formule mathématique', icone: '∑' },
  { type: 'callout', label: 'Encadré', description: 'Définition, exemple, attention…', icone: '▣' },
  { type: 'steps', label: 'Étapes', description: 'Un exemple résolu, étape par étape', icone: '≣' },
  {
    type: 'table',
    label: 'Tableau',
    description: 'Un tableau de données ou de conversion',
    icone: '▦',
  },
  {
    type: 'reference',
    label: 'Référence',
    description: 'Un lien vers un autre chapitre ou une ressource externe',
    icone: '❝',
  },
  {
    type: 'figure',
    label: 'Figure',
    description: 'Une figure géométrique ou une droite graduée',
    icone: '△',
  },
  {
    type: 'exercise',
    exerciseType: 'multiple-choice',
    label: 'QCM',
    description: 'Une question à choix, corrigée automatiquement',
    icone: '◉',
  },
  {
    type: 'exercise',
    exerciseType: 'multiple-choice',
    preset: 'true-false',
    label: 'Vrai / Faux',
    description: 'Un QCM à deux choix : Vrai / Faux',
    icone: '✓✗',
  },
  {
    type: 'exercise',
    exerciseType: 'short-answer',
    label: 'Réponse courte',
    description: 'Un mot ou une expression à saisir, corrigé automatiquement',
    icone: '✍',
  },
  {
    type: 'exercise',
    exerciseType: 'numeric',
    label: 'Numérique',
    description: 'Une valeur numérique, corrigée automatiquement',
    icone: '#',
  },
  {
    type: 'exercise',
    exerciseType: 'fill-blank',
    label: 'Texte à trous',
    description: 'Une phrase à compléter avec des étiquettes, corrigée automatiquement',
    icone: '⎵',
  },
  {
    type: 'exercise',
    exerciseType: 'paper',
    label: 'Sur feuille',
    description: 'Un exercice résolu sur feuille, en auto-évaluation',
    icone: '✎',
  },
]

export const BLOC_LABELS: Record<BlocType, string> = {
  heading: 'Titre',
  objectives: 'Objectifs',
  prose: 'Texte',
  formula: 'Formule',
  callout: 'Encadré',
  steps: 'Étapes',
  table: 'Tableau',
  reference: 'Référence',
  figure: 'Figure',
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
export function nouveauBloc(
  type: BlocType,
  exerciseType?: ExerciceType,
  preset?: ExercicePreset
): Bloc {
  switch (type) {
    case 'heading':
      return { id: genId(), type, text: '', level: 1 }
    case 'prose':
      return { id: genId(), type, text: '' }
    case 'formula':
      return { id: genId(), type, latex: '', display: 'block' }
    case 'objectives':
      // Deux facettes indépendantes (schéma) : `items` en texte libre (ce que l'élève saura
      // faire) et `competencies`, des codes du référentiel (ADR 0009) choisis via le picker.
      return { id: genId(), type, title: '', items: [''], competencies: [] }
    case 'callout':
      return { id: genId(), type, variant: 'definition', title: '', text: '' }
    case 'steps':
      // Un exemple résolu : un titre optionnel et une première étape prête à remplir.
      return { id: genId(), type, title: '', steps: [{ text: '' }] as Etape[] }
    case 'table':
      // Une grille 2×1 prête à remplir : une ligne d'en-têtes (facultative dans le schéma, mais
      // proposée par défaut) et une première ligne de corps. Le schéma exige au moins une ligne
      // d'au moins une cellule. Une ligne d'en-têtes laissée vide est retirée à l'enregistrement
      // (blocServi) ; une cellule de corps vide est signalée avant publication.
      return { id: genId(), type, headers: ['', ''], rows: [['', '']] }
    case 'reference':
      // Externe par défaut (le cas le plus courant : renvoyer vers une ressource en ligne).
      // Passer en « interne » ajoute la cible level/subject/slug, validée à la publication.
      return { id: genId(), type, scope: 'external', title: '', url: '' }
    case 'figure':
      // Figure déclarative (ADR 0013) : `alt` obligatoire (rempli par l'enseignant, vérifié à la
      // publication) et une `spec` vide mais valide, que le constructeur remplit primitive à primitive.
      return { id: genId(), type, alt: '', spec: { points: [], segments: [] } }
    case 'exercise':
      return nouvelExercice(exerciseType ?? 'paper', preset)
  }
}

// Chaque type d'exercice démarre avec ses seuls champs du schéma, vides mais de la bonne forme.
// Les champs de correction (choices.correct, acceptedAnswers, answer/tolerance) sont saisis ici
// puis retirés à la publication : ils n'atteignent jamais un client élève (ADR 0019 §4).
function nouvelExercice(exerciseType: ExerciceType, preset?: ExercicePreset): Bloc {
  const base = { id: genId(), type: 'exercise' as const, exerciseType, prompt: '' }
  switch (exerciseType) {
    case 'multiple-choice': {
      // Préréglage « Vrai / Faux » : deux propositions déjà nommées, aucune cochée bonne (le prof
      // choisit). Sinon, deux propositions vides à remplir. Dans les deux cas, un vrai QCM.
      const choices: Choix[] =
        preset === 'true-false'
          ? [
              { id: genId(), text: 'Vrai', correct: false },
              { id: genId(), text: 'Faux', correct: false },
            ]
          : [
              { id: genId(), text: '', correct: false },
              { id: genId(), text: '', correct: false },
            ]
      return { ...base, multiple: false, choices }
    }
    case 'short-answer':
      return { ...base, acceptedAnswers: [''], caseSensitive: false }
    case 'numeric':
      // `answer` et `unit` sont ajoutés à la saisie : un `answer` absent (et non 0) distingue
      // « pas encore rempli » de « la réponse est zéro » ; une `unit` vide n'est pas dans le schéma.
      return { ...base, tolerance: 0 }
    case 'fill-blank':
      // Pas de trou au départ : `expected` et `bank` suivent la phrase (voir synchroniserTrous).
      return { ...base, template: '', bank: [], expected: [], caseSensitive: false }
    case 'paper':
      // `statement` (facultatif) n'est ajouté qu'à la saisie : une chaîne vide n'est pas du
      // richText valide. `solution` est montré à l'élève : ce n'est pas un champ de correction.
      return { ...base, solution: '' }
  }
}

// --- Texte à trous ------------------------------------------------------------
// Un trou est un marqueur `{}` dans la phrase ; `expected[i]` est la bonne étiquette du i-ème
// trou. La banque contient toujours les réponses attendues (l'élève ne peut glisser que des
// étiquettes de la banque, chacune une seule fois) plus les distracteurs de l'enseignant : elle
// n'est jamais saisie directement, on la recompose, ce qui rend l'incohérence impossible.

export const MARQUEUR_TROU = '{}'

export function compterTrous(template: string): number {
  return template.split(MARQUEUR_TROU).length - 1
}

/** Retire de `liste` une occurrence de chaque élément de `aRetirer` (différence de multiensembles). */
function sansOccurrences(liste: string[], aRetirer: string[]): string[] {
  const reste = [...liste]
  for (const x of aRetirer) {
    const i = reste.indexOf(x)
    if (i >= 0) reste.splice(i, 1)
  }
  return reste
}

function chaines(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Les distracteurs : ce qui, dans la banque, n'est pas une réponse attendue. */
export function distracteursDe(bloc: Bloc): string[] {
  return sansOccurrences(
    chaines(bloc.bank),
    chaines(bloc.expected).filter((e) => e !== '')
  )
}

/**
 * Applique une modification à un texte à trous et renvoie le patch complet et cohérent :
 * `expected` a exactement une entrée par `{}` (les réponses déjà saisies gardent leur rang), et
 * `bank` = réponses attendues non vides + distracteurs, dans l'ordre de saisie. L'ordre montré à
 * l'élève est fixé plus tard, par contenuDepuisBrouillon.
 */
export function synchroniserTrous(
  bloc: Bloc,
  modif: { template?: string; expected?: string[]; distracteurs?: string[] }
): { template: string; expected: string[]; bank: string[] } {
  const template = modif.template ?? (typeof bloc.template === 'string' ? bloc.template : '')
  const distracteurs = modif.distracteurs ?? distracteursDe(bloc)
  const saisies = modif.expected ?? chaines(bloc.expected)
  const expected = Array.from({ length: compterTrous(template) }, (_, i) => saisies[i] ?? '')
  return { template, expected, bank: [...expected.filter((e) => e !== ''), ...distracteurs] }
}

/**
 * La banque telle que l'élève la verra : sans étiquette vide, et triée par ordre alphabétique —
 * l'ordre de saisie (réponses d'abord, dans l'ordre des trous) donnerait la solution.
 */
function banqueServie(bank: unknown): string[] {
  return chaines(bank)
    .filter((t) => t.trim() !== '')
    .sort((a, b) => a.localeCompare(b, 'fr'))
}

const vide = (v: unknown) => typeof v === 'string' && v.trim() === ''

// Champs facultatifs du schéma qui, présents, doivent être non vides (`minLength: 1`). Les
// formulaires les initialisent à '' : laissés vides, on les retire plutôt que d'envoyer un
// document que le validateur refuserait. Le `title` d'une référence est requis : il reste, et
// le validateur le signale s'il est vide.
const CHAMPS_FACULTATIFS = ['title', 'caption', 'source', 'unit', 'explanation', 'statement']

function sansChampsVides(bloc: Bloc): Bloc {
  const propre: Bloc = { ...bloc }
  for (const champ of CHAMPS_FACULTATIFS) {
    if (champ === 'title' && bloc.type === 'reference') continue
    if (vide(propre[champ])) delete propre[champ]
  }
  return propre
}

/**
 * Le bloc tel qu'il est enregistré et servi : sans champ facultatif vide, sans ligne vide
 * (objectifs, en-têtes de tableau entièrement vides, formule d'étape vide), et avec la banque du
 * texte à trous triée. Appliqué à chaque enregistrement, il répare aussi un brouillon ancien.
 */
function blocServi(bloc: Bloc): Bloc {
  const b = sansChampsVides(bloc)
  switch (b.type) {
    case 'objectives':
      if (Array.isArray(b.items)) b.items = (b.items as unknown[]).filter((i) => !vide(i))
      return b
    case 'steps':
      if (Array.isArray(b.steps)) {
        b.steps = (b.steps as Etape[]).map((e) => (vide(e.formula) ? { text: e.text } : e))
      }
      return b
    case 'table':
      if (Array.isArray(b.headers) && (b.headers as unknown[]).every(vide)) delete b.headers
      return b
    case 'exercise':
      return b.exerciseType === 'fill-blank' ? { ...b, bank: banqueServie(b.bank) } : b
    default:
      return b
  }
}

// --- Validation avant publication ------------------------------------------------
// Les règles que le serveur applique à la publication (schéma de contenu, PublicationValidator,
// ADR 0019 §4), rejouées ici sur le document tel qu'il serait envoyé (blocServi) pour prévenir
// l'enseignant sur le bloc concerné. Le serveur reste l'autorité : un problème qu'il trouverait
// encore revient sous la même forme (problemesDepuisViolations) et le même libellé.
//
// Les codes sont ceux de ContentViolation côté serveur, plus quelques règles que le serveur ne
// vérifie pas (QCM sans bonne réponse…). Un problème « bloquant » empêche l'envoi ; un
// « avertissement » est signalé sans bloquer, pour un contenu accepté mais sans doute fautif.

export type Gravite = 'bloquant' | 'avertissement'

export type Probleme = {
  code: string
  gravite: Gravite
  /** La partie concernée (absente pour un problème du cours entier). */
  sectionId?: string
  /** Le bloc concerné (absent pour un problème de partie ou de cours). */
  blocId?: string
  /** Le champ à corriger, relatif au bloc (ou à la partie, ou au cours) : `prompt`, `choices[1].text`… */
  champ?: string
  /** Libellé en français, prêt à afficher. */
  message: string
}

// Codes propres au web : règles que le serveur n'impose pas (encore).
const AUCUNE_BONNE_REPONSE = 'NO_CORRECT_CHOICE'
const TROP_DE_BONNES_REPONSES = 'TOO_MANY_CORRECT_CHOICES'
const OBJECTIFS_VIDES = 'EMPTY_OBJECTIVES'
const REPONSES_EN_DOUBLE = 'DUPLICATE_ANSWERS'
const REFERENCE_NON_VERIFIEE = 'REFERENCE_UNVERIFIED'

const LIBELLES_CHAMPS: Record<string, string> = {
  title: 'le titre',
  text: 'le texte',
  latex: 'la formule',
  prompt: 'l’énoncé',
  choices: 'les propositions',
  acceptedAnswers: 'les réponses acceptées',
  answer: 'la réponse attendue',
  template: 'la phrase à trous',
  expected: 'les réponses des trous',
  bank: 'les étiquettes',
  solution: 'la solution',
  url: 'l’adresse',
  target: 'la cible',
  alt: 'le texte alternatif',
  rows: 'les cases du tableau',
  headers: 'les en-têtes du tableau',
  steps: 'les étapes',
  items: 'les objectifs',
  competencies: 'les compétences',
}

/** Le premier segment d'un chemin de champ : `choices[1].text` → `choices`. */
function teteDeChamp(champ: string): string {
  return champ.split(/[.[]/)[0]
}

/** Le rang (à partir de 1) du premier index d'un chemin : `choices[1].text` → 2. */
function rangDansChamp(champ: string): number | null {
  const m = /\[(\d+)]/.exec(champ)
  return m ? Number(m[1]) + 1 : null
}

/**
 * Le libellé français d'un problème, à partir de son code et de son champ — le même pour une
 * règle vérifiée ici et pour une violation renvoyée par le serveur.
 */
export function libelleProbleme(code: string, champ?: string, niveau?: 'cours' | 'partie'): string {
  const tete = champ ? teteDeChamp(champ) : ''
  const rang = champ ? rangDansChamp(champ) : null
  switch (code) {
    case 'REQUIRED':
    case 'EMPTY':
      if (niveau === 'cours')
        return tete === 'sections' ? 'Ajoute au moins une partie.' : 'Donne un titre au cours.'
      if (niveau === 'partie') {
        return tete === 'blocks'
          ? 'Ajoute au moins un bloc à cette partie.'
          : 'Donne un titre à cette partie.'
      }
      if (tete === 'choices') {
        return rang ? `Remplis la proposition ${rang}.` : 'Ajoute au moins deux propositions.'
      }
      if (tete === 'steps') return rang ? `Remplis l’étape ${rang}.` : 'Ajoute au moins une étape.'
      if (tete === 'rows' || tete === 'headers') return 'Remplis chaque case du tableau.'
      if (tete === 'acceptedAnswers') {
        return rang
          ? `Remplis la réponse acceptée ${rang}.`
          : 'Donne au moins une réponse acceptée.'
      }
      if (tete === 'expected') {
        return rang
          ? `Donne la réponse du trou ${rang}.`
          : 'Ajoute au moins un trou {} dans la phrase.'
      }
      if (tete === 'template') return 'Ajoute au moins un trou {} dans la phrase.'
      if (tete === 'bank') return 'Il faut au moins deux étiquettes : ajoute un distracteur.'
      if (tete === 'answer') return 'Donne la réponse attendue.'
      if (tete === 'target') return 'Précise le niveau, la matière et le chapitre cités.'
      if (tete === 'alt') return 'Décris la figure dans le texte alternatif.'
      return `Remplis ${LIBELLES_CHAMPS[tete] ?? 'ce champ'}.`
    case 'INVALID_FORMAT':
      if (tete === 'url') return 'L’adresse doit commencer par https://.'
      if (tete === 'target') {
        return 'Le chapitre et la partie cités s’écrivent en minuscules, chiffres et tirets.'
      }
      return `${capitaliser(LIBELLES_CHAMPS[tete] ?? 'ce champ')} n’est pas valide.`
    case 'MISSING_ALT':
      return 'Décris la figure dans le texte alternatif.'
    case 'BLANK_COUNT_MISMATCH':
      return 'Donne une réponse pour chaque trou.'
    case 'ANSWER_NOT_IN_BANK':
      return 'Chaque réponse attendue doit figurer parmi les étiquettes.'
    case 'REFERENCE_CHAPTER_NOT_FOUND':
      return 'Aucun chapitre publié ne correspond à cette référence.'
    case 'REFERENCE_ANCHOR_NOT_FOUND':
      return 'Cette partie n’existe pas dans le chapitre cité.'
    case REFERENCE_NON_VERIFIEE:
      return 'Impossible de vérifier cette référence pour l’instant.'
    case 'UNKNOWN_COMPETENCY':
    case 'DEPRECATED_COMPETENCY':
      return 'Une compétence citée n’existe pas ou plus dans le référentiel : retire-la.'
    case 'EMPTY_COURSE':
      return 'Le cours est vide : ajoute au moins un bloc.'
    case AUCUNE_BONNE_REPONSE:
      return 'Coche au moins une bonne réponse.'
    case TROP_DE_BONNES_REPONSES:
      return 'Plusieurs propositions sont cochées : autorise plusieurs réponses ou n’en garde qu’une.'
    case OBJECTIFS_VIDES:
      return 'Ce bloc est vide : ajoute un objectif ou une compétence.'
    case REPONSES_EN_DOUBLE:
      return 'Deux réponses acceptées sont identiques (aux accents et majuscules près).'
    default:
      return 'Ce point empêche la publication.'
  }
}

function capitaliser(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Identifiant lisible du schéma (`$defs/nodeId`) : chapitre et partie cités par une référence.
const NODE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Normalisation d'une réponse courte, celle du correcteur (ADR 0012) : espaces de bord retirés,
 * accents retirés, minuscules sauf `caseSensitive`, ponctuation finale ignorée.
 */
function normaliserReponse(reponse: string, sensibleCasse: boolean): string {
  const sansAccents = reponse.trim().normalize('NFD').replace(/\p{M}/gu, '')
  return (sensibleCasse ? sansAccents : sansAccents.toLowerCase()).replace(/[\s.!?;]+$/, '')
}

type ProblemeBrut = { code: string; champ?: string; gravite?: Gravite }

/** Les problèmes d'un bloc tel qu'il serait servi (après blocServi). */
function problemesDuBlocServi(b: Bloc): ProblemeBrut[] {
  const p: ProblemeBrut[] = []
  const exiger = (champ: string, v: unknown) => {
    if (!texteRempli(v)) p.push({ code: 'EMPTY', champ })
  }
  switch (b.type) {
    case 'heading':
    case 'prose':
    case 'callout':
      exiger('text', b.text)
      break
    case 'formula':
      exiger('latex', b.latex)
      break
    case 'steps': {
      const etapes = Array.isArray(b.steps) ? (b.steps as Etape[]) : []
      if (etapes.length === 0) p.push({ code: 'EMPTY', champ: 'steps' })
      etapes.forEach((e, i) => exiger(`steps[${i}].text`, e?.text))
      break
    }
    case 'table': {
      const lignes = Array.isArray(b.rows) ? (b.rows as unknown[][]) : []
      if (lignes.length === 0) p.push({ code: 'EMPTY', champ: 'rows' })
      if (Array.isArray(b.headers)) {
        ;(b.headers as unknown[]).forEach((c, j) => exiger(`headers[${j}]`, c))
      }
      lignes.forEach((ligne, i) => {
        if (!Array.isArray(ligne) || ligne.length === 0)
          p.push({ code: 'EMPTY', champ: `rows[${i}]` })
        else ligne.forEach((c, j) => exiger(`rows[${i}][${j}]`, c))
      })
      break
    }
    case 'reference':
      exiger('title', b.title)
      if (b.scope === 'internal') {
        const cible = (b.target ?? {}) as Record<string, unknown>
        for (const k of ['level', 'subject', 'slug']) exiger(`target.${k}`, cible[k])
        if (texteRempli(cible.slug) && !NODE_ID.test(String(cible.slug))) {
          p.push({ code: 'INVALID_FORMAT', champ: 'target.slug' })
        }
        if (cible.anchor !== undefined && !NODE_ID.test(String(cible.anchor))) {
          p.push({ code: 'INVALID_FORMAT', champ: 'target.anchor' })
        }
      } else if (!texteRempli(b.url)) {
        p.push({ code: 'EMPTY', champ: 'url' })
      } else if (!String(b.url).startsWith('https://')) {
        p.push({ code: 'INVALID_FORMAT', champ: 'url' })
      }
      break
    case 'figure':
      if (!texteRempli(b.alt)) p.push({ code: 'MISSING_ALT', champ: 'alt' })
      break
    case 'objectives': {
      const items = chaines(b.items)
      const competences = chaines(b.competencies)
      if (items.length === 0 && competences.length === 0) {
        p.push({ code: OBJECTIFS_VIDES, gravite: 'avertissement' })
      }
      break
    }
    case 'exercise':
      exiger('prompt', b.prompt)
      p.push(...problemesExercice(b))
      break
  }
  return p
}

function problemesExercice(b: Bloc): ProblemeBrut[] {
  const p: ProblemeBrut[] = []
  switch (b.exerciseType) {
    case 'multiple-choice': {
      const choix = Array.isArray(b.choices) ? (b.choices as Partial<Choix>[]) : []
      if (choix.length < 2) p.push({ code: 'EMPTY', champ: 'choices' })
      choix.forEach((c, i) => {
        if (!texteRempli(c.text)) p.push({ code: 'EMPTY', champ: `choices[${i}].text` })
      })
      const bonnes = choix.filter((c) => c.correct === true).length
      if (bonnes === 0) p.push({ code: AUCUNE_BONNE_REPONSE, champ: 'choices' })
      else if (bonnes > 1 && b.multiple !== true) {
        p.push({ code: TROP_DE_BONNES_REPONSES, champ: 'choices' })
      }
      break
    }
    case 'short-answer': {
      const reponses = Array.isArray(b.acceptedAnswers) ? (b.acceptedAnswers as unknown[]) : []
      if (reponses.length === 0) p.push({ code: 'EMPTY', champ: 'acceptedAnswers' })
      reponses.forEach((r, i) => {
        if (!texteRempli(r)) p.push({ code: 'EMPTY', champ: `acceptedAnswers[${i}]` })
      })
      const remplies = reponses.filter(texteRempli) as string[]
      // Le schéma refuse deux réponses identiques ; le correcteur confond aussi celles qui ne
      // diffèrent que par les accents ou la casse : inutile, mais pas faux.
      if (new Set(remplies).size < remplies.length) {
        p.push({ code: REPONSES_EN_DOUBLE, champ: 'acceptedAnswers' })
      } else {
        const normalisees = remplies.map((r) => normaliserReponse(r, b.caseSensitive === true))
        if (new Set(normalisees).size < normalisees.length) {
          p.push({ code: REPONSES_EN_DOUBLE, champ: 'acceptedAnswers', gravite: 'avertissement' })
        }
      }
      break
    }
    case 'numeric':
      if (typeof b.answer !== 'number' || !Number.isFinite(b.answer)) {
        p.push({ code: 'REQUIRED', champ: 'answer' })
      }
      break
    case 'fill-blank': {
      const template = typeof b.template === 'string' ? b.template : ''
      const trous = compterTrous(template)
      const attendues = Array.isArray(b.expected) ? (b.expected as unknown[]) : []
      const banque = chaines(b.bank)
      if (trous === 0) p.push({ code: 'EMPTY', champ: 'template' })
      attendues.forEach((e, i) => {
        if (!texteRempli(e)) p.push({ code: 'EMPTY', champ: `expected[${i}]` })
      })
      if (trous > 0 && attendues.length !== trous) {
        p.push({ code: 'BLANK_COUNT_MISMATCH', champ: 'expected' })
      }
      // Le schéma veut deux étiquettes. Tant qu'une réponse manque, c'est elle qu'on signale :
      // « ajoute un distracteur » serait un mauvais conseil.
      if (banque.length < 2 && trous > 0 && attendues.every(texteRempli)) {
        p.push({ code: 'EMPTY', champ: 'bank' })
      }
      // Chaque étiquette ne se place qu'une fois : deux trous attendant « 2 » en veulent deux.
      if (sansOccurrences(chaines(attendues).filter(texteRempli), banque).length > 0) {
        p.push({ code: 'ANSWER_NOT_IN_BANK', champ: 'bank' })
      }
      break
    }
    case 'paper':
      if (!texteRempli(b.solution)) p.push({ code: 'EMPTY', champ: 'solution' })
      break
  }
  return p
}

function probleme(
  brut: ProblemeBrut,
  lieu: { sectionId?: string; blocId?: string },
  niveau?: 'cours' | 'partie'
): Probleme {
  return {
    code: brut.code,
    gravite: brut.gravite ?? 'bloquant',
    ...lieu,
    ...(brut.champ ? { champ: brut.champ } : {}),
    message: libelleProbleme(brut.code, brut.champ, niveau),
  }
}

/** Les problèmes d'un bloc, rattachés à sa partie. Le bloc est d'abord mis dans sa forme servie. */
export function problemesBloc(bloc: Bloc, sectionId: string): Probleme[] {
  return problemesDuBlocServi(blocServi(bloc)).map((b) =>
    probleme(b, { sectionId, blocId: bloc.id })
  )
}

/**
 * Tous les problèmes connus sans appel réseau : cours, parties, puis blocs dans l'ordre du plan.
 * Les références internes, qui demandent le catalogue, s'ajoutent via problemeReference.
 */
export function problemesBrouillon(b: Brouillon): Probleme[] {
  const p: Probleme[] = []
  if (!texteRempli(b.title)) p.push(probleme({ code: 'EMPTY', champ: 'title' }, {}, 'cours'))
  if (b.sections.length === 0) p.push(probleme({ code: 'EMPTY', champ: 'sections' }, {}, 'cours'))
  for (const s of b.sections) {
    if (!texteRempli(s.title)) {
      p.push(probleme({ code: 'EMPTY', champ: 'title' }, { sectionId: s.id }, 'partie'))
    }
    if (s.blocks.length === 0) {
      p.push(probleme({ code: 'EMPTY', champ: 'blocks' }, { sectionId: s.id }, 'partie'))
    }
    for (const bloc of s.blocks) p.push(...problemesBloc(bloc, s.id))
  }
  return p
}

/** Vrai si au moins un problème empêche l'envoi au serveur. */
export function aDesProblemesBloquants(problemes: Probleme[]): boolean {
  return problemes.some((p) => p.gravite === 'bloquant')
}

/** Une référence interne complète, à vérifier contre le catalogue (null sinon). */
export function cibleAVerifier(
  bloc: Bloc
): { level: string; subject: string; slug: string; anchor?: string } | null {
  if (bloc.type !== 'reference' || bloc.scope !== 'internal') return null
  const c = (bloc.target ?? {}) as Record<string, unknown>
  if (![c.level, c.subject, c.slug].every(texteRempli) || !NODE_ID.test(String(c.slug))) return null
  return {
    level: String(c.level),
    subject: String(c.subject),
    slug: String(c.slug),
    ...(texteRempli(c.anchor) ? { anchor: String(c.anchor) } : {}),
  }
}

/**
 * Le problème d'une référence interne une fois le catalogue consulté : `sections` = les parties
 * du chapitre publié, `null` s'il n'est pas publié, `'erreur'` si la vérification a échoué (le
 * serveur tranchera : simple avertissement).
 */
export function problemeReference(
  bloc: Bloc,
  sectionId: string,
  sections: string[] | null | 'erreur'
): Probleme | null {
  const cible = cibleAVerifier(bloc)
  if (!cible) return null
  const lieu = { sectionId, blocId: bloc.id }
  if (sections === 'erreur') {
    return probleme(
      { code: REFERENCE_NON_VERIFIEE, champ: 'target', gravite: 'avertissement' },
      lieu
    )
  }
  if (sections === null)
    return probleme({ code: 'REFERENCE_CHAPTER_NOT_FOUND', champ: 'target' }, lieu)
  if (cible.anchor && !sections.includes(cible.anchor)) {
    return probleme({ code: 'REFERENCE_ANCHOR_NOT_FOUND', champ: 'target.anchor' }, lieu)
  }
  return null
}

/**
 * Les violations d'un 422 serveur, sous la même forme que les problèmes vérifiés ici. Un champ
 * sans partie concerne le cours ; un champ de partie sans bloc concerne la partie.
 */
export function problemesDepuisViolations(
  violations: {
    code: string
    sectionId?: string | null
    blockId?: string | null
    field?: string | null
  }[]
): Probleme[] {
  return violations.map((v) => {
    const champ = v.field ?? undefined
    const niveau = v.blockId ? undefined : v.sectionId ? 'partie' : champ ? 'cours' : undefined
    return probleme(
      { code: v.code, champ },
      {
        ...(v.sectionId ? { sectionId: v.sectionId } : {}),
        ...(v.blockId ? { blocId: v.blockId } : {}),
      },
      niveau
    )
  })
}

/**
 * Vrai si un problème porte sur `champ` ou sur l'un de ses sous-champs : `choices` est en erreur
 * si `choices[1].text` l'est, mais `choices[0].text` ne l'est pas pour autant.
 */
export function champEnErreur(problemes: Probleme[], champ: string): boolean {
  return problemes.some(
    (p) =>
      p.champ !== undefined &&
      (p.champ === champ || p.champ.startsWith(champ + '.') || p.champ.startsWith(champ + '['))
  )
}

// --- Aperçu élève --------------------------------------------------------------
// L'aperçu montre ce que verra l'élève, rien de plus. Un exercice qu'un élève ne pourrait pas
// faire tel quel n'y figure pas. Il dérive des règles de publication, sauf celles qui portent
// sur la correction (réponses attendues) : elles ne se voient pas côté élève.

function texteRempli(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== ''
}

// Problèmes de correction : invisibles côté élève, ils ne retirent pas un exercice de l'aperçu.
const CODES_CORRECTION = new Set([
  AUCUNE_BONNE_REPONSE,
  TROP_DE_BONNES_REPONSES,
  REPONSES_EN_DOUBLE,
  'BLANK_COUNT_MISMATCH',
  'ANSWER_NOT_IN_BANK',
])

/** Vrai si un bloc d'exercice est assez rempli pour qu'un élève puisse le faire tel quel. */
export function exerciceComplet(bloc: Bloc): boolean {
  if (bloc.type !== 'exercise') return false
  return !problemesDuBlocServi(blocServi(bloc)).some(
    (p) =>
      (p.gravite ?? 'bloquant') === 'bloquant' &&
      !CODES_CORRECTION.has(p.code) &&
      !(p.champ && CHAMPS_CORRECTION.includes(teteDeChamp(p.champ)))
  )
}

// Champs de correction d'un exercice : saisis dans l'éditeur, jamais montrés à l'élève.
const CHAMPS_CORRECTION = ['expected', 'acceptedAnswers', 'answer', 'tolerance', 'caseSensitive']

function blocPourApercu(bloc: Bloc): Bloc {
  if (bloc.type !== 'exercise') return bloc
  const copie: Bloc = { ...bloc }
  for (const champ of CHAMPS_CORRECTION) delete copie[champ]
  if (Array.isArray(bloc.choices)) {
    copie.choices = (bloc.choices as Choix[]).map(({ id, text }) => ({ id, text }))
  }
  return copie
}

/**
 * Le brouillon tel que l'élève le verrait : exercices incomplets retirés, champs de correction
 * effacés. Renvoie aussi le nombre d'exercices masqués, pour le signaler à l'enseignant.
 */
export function brouillonVersApercu(b: Brouillon): {
  chapitre: ChapitreResponse
  exercicesMasques: number
} {
  let exercicesMasques = 0
  const sections = b.sections.map((s) => ({
    id: s.id,
    title: s.title,
    kind: s.kind,
    blocks: s.blocks
      .filter((bloc) => {
        if (bloc.type !== 'exercise' || exerciceComplet(bloc)) return true
        exercicesMasques++
        return false
      })
      .map(blocPourApercu),
  }))
  return {
    chapitre: {
      schemaVersion: b.schemaVersion,
      id: b.id,
      title: b.title,
      subject: b.subject,
      level: b.level,
      sections,
    },
    exercicesMasques,
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
  const premiereCellule =
    Array.isArray(bloc.rows) &&
    Array.isArray(bloc.rows[0]) &&
    typeof (bloc.rows[0] as unknown[])[0] === 'string'
      ? ((bloc.rows[0] as unknown[])[0] as string)
      : ''
  const brut =
    (typeof bloc.text === 'string' && bloc.text) ||
    (typeof bloc.prompt === 'string' && bloc.prompt) ||
    (typeof bloc.title === 'string' && bloc.title) ||
    (typeof bloc.latex === 'string' && bloc.latex) ||
    // Une référence résume par son titre ; une figure par son texte alternatif ; un tableau par
    // sa légende ou sa première cellule.
    (typeof bloc.alt === 'string' && bloc.alt) ||
    (typeof bloc.caption === 'string' && bloc.caption) ||
    premiereEtape ||
    premierItem ||
    premiereCellule ||
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
    sections: b.sections.map((s) => ({ ...s, blocks: s.blocks.map(blocServi) })),
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
