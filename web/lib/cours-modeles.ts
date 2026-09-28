// Modèles de départ d'un cours (tranche 2 de la refonte de l'éditeur).
//
// Le prof ne doit jamais ouvrir une page vide : à la création, il choisit un modèle qui pose la
// STRUCTURE du cours (des blocs vides, prêts à remplir). Aucun contenu pédagogique n'est inventé —
// c'est un produit utilisé par des mineurs : seuls des libellés de structure (« Le cours »,
// « Exemple résolu ») sont posés, exactement comme la maquette validée. Le prof écrit le reste.
//
// On réutilise les fabriques de `cours-editeur` (nouveauBloc / nouvelleSection) puis on passe par
// `contenuDepuisBrouillon` : le contenu produit est donc identique en forme à ce qu'enregistre
// l'éditeur, sans dupliquer la logique de mise en forme (blocServi).

import {
  contenuDepuisBrouillon,
  nouveauBloc,
  nouvelleSection,
  type Bloc,
  type CoursContent,
  type Section,
} from '@/lib/cours-editeur'

export type ModeleId = 'cours-complet' | 'fiche-methode' | 'serie-exercices' | 'page-blanche'

export type Modele = {
  id: ModeleId
  libelle: string
  description: string
}

// Ordre du choix dans la fenêtre de création. Le premier est le choix par défaut.
export const MODELES: Modele[] = [
  {
    id: 'cours-complet',
    libelle: 'Cours complet',
    description: 'Objectifs, cours, exemple résolu et un exercice — la leçon de A à Z.',
  },
  {
    id: 'fiche-methode',
    libelle: 'Fiche méthode',
    description: 'Des objectifs, une méthode étape par étape, un exercice.',
  },
  {
    id: 'serie-exercices',
    libelle: 'Série d’exercices',
    description: 'Une consigne et cinq exercices, pour s’entraîner.',
  },
  {
    id: 'page-blanche',
    libelle: 'Page blanche',
    description: 'Partir de zéro, avec une partie vide.',
  },
]

export const MODELE_DEFAUT: ModeleId = 'cours-complet'

// Un titre posé sur un bloc « heading » / « steps » : c'est un libellé de structure, pas du contenu.
function avecTitre(bloc: Bloc, titre: string): Bloc {
  return { ...bloc, ...(bloc.type === 'heading' ? { text: titre } : { title: titre }) }
}

function sectionsModele(id: ModeleId): Section[] {
  switch (id) {
    case 'cours-complet': {
      const section = nouvelleSection('lesson')
      section.blocks = [
        nouveauBloc('objectives'),
        avecTitre(nouveauBloc('heading'), 'Le cours'),
        nouveauBloc('prose'),
        avecTitre(nouveauBloc('steps'), 'Exemple résolu'),
        nouveauBloc('exercise', 'multiple-choice'),
      ]
      return [section]
    }
    case 'fiche-methode': {
      const section = nouvelleSection('lesson')
      section.blocks = [
        nouveauBloc('objectives'),
        avecTitre(nouveauBloc('steps'), 'La méthode'),
        nouveauBloc('exercise', 'multiple-choice'),
      ]
      return [section]
    }
    case 'serie-exercices': {
      const section = nouvelleSection('exercises')
      // Une consigne, puis un exercice de chacun des cinq types (le prof supprime ceux qu'il ne
      // veut pas). Cinq exercices vides, aucun énoncé inventé.
      section.blocks = [
        nouveauBloc('prose'),
        nouveauBloc('exercise', 'multiple-choice'),
        nouveauBloc('exercise', 'short-answer'),
        nouveauBloc('exercise', 'numeric'),
        nouveauBloc('exercise', 'fill-blank'),
        nouveauBloc('exercise', 'paper'),
      ]
      return [section]
    }
    case 'page-blanche':
      return [nouvelleSection('lesson')]
  }
}

/**
 * Le contenu de départ à passer à `creerCours` pour le modèle choisi. « Page blanche » renvoie
 * `undefined` : on garde le comportement d'origine (le serveur crée une première partie vide).
 * L'id et le titre du contenu sont des marque-places — le serveur assigne le vrai id, et le titre
 * fait foi via la colonne dédiée (fenêtre de création).
 */
export function contenuModele(id: ModeleId): CoursContent | undefined {
  if (id === 'page-blanche') return undefined
  return contenuDepuisBrouillon({
    schemaVersion: 1,
    id: 'modele',
    title: '',
    sections: sectionsModele(id),
  })
}
