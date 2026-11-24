# Lexique · espace élève, classe et prof

Propriétaire : U3 Architecte de l'information (nom), U5 Rédacteur UX (rédaction). Créé par PL-8 (#451).

**Règle.** Un concept porte **une seule chaîne par public**, partout : onglet, titre, fil d'Ariane,
bouton, état vide, `aria-label`, commentaire de code. Avant d'écrire un libellé, chercher le
concept ici ; pour changer un nom, ouvrir une PR qui modifie d'abord ce fichier (N1, U3 + U5).
Un nom n'est retenu que si le backend le rend vrai : la colonne « Ce qui le rend vrai » cite le code.

## Concepts

### 1. Cours (écrit par un enseignant, publié à une classe)

|                          | Élève                                                             | Prof                         |
| ------------------------ | ----------------------------------------------------------------- | ---------------------------- |
| Nom (onglet, fil, titre) | **Cours de ta classe**                                            | **Mes cours**                |
| En phrase                | « les cours de ta classe » (« Voir tous les cours de ta classe ») | « tes cours », « mes cours » |

- **Interdit côté élève** : « Cours du prof », « les cours de ton prof », « ses cours », « tes cours ».
- **Où** : onglet de Ma classe, fil d'Ariane du lecteur de cours, titre de la liste (et du bloc
  plafonné de l'onglet « À faire »), liens « Voir… », bouton de fin de cours, états vides.
- **Ce qui le rend vrai** : un cours apparaît à l'élève parce qu'il est publié **à sa classe**, pas
  parce que c'est « son » prof (`backend/src/main/java/fr/brio/contenu/CoursLectureService.java:144-160`,
  portées posées par `CoursEditionService.java:85`, servi par `contenu/web/CoursController.java:55-64`) ;
  une classe peut avoir plusieurs enseignants (`backend/src/main/resources/db/migration/V15__identite_inscriptions.sql:5-6`).
- « cours » est réservé à cet objet. Le contenu d'un chapitre du catalogue est une **leçon** (§5).

### 2. Devoir

| Concept                          | Élève                                                                                   | Prof              |
| -------------------------------- | --------------------------------------------------------------------------------------- | ----------------- |
| a. Statut `non_commence`         | **Pas commencé**                                                                        | **Pas commencé**  |
| b. Devoirs ni rendus ni corrigés | **Devoirs à rendre** (Accueil : « Devoirs à rendre · {classe} » quand une seule classe) | « Devoirs » (nav) |

- Autres statuts : « En cours », « Rendu », « Corrigé ».
- **Interdit** : « À faire » comme statut ou comme titre de section ; « Pour ta classe », « Pour tes classes ».
- **Exception actée (24/11)** : l'**onglet** « À faire » de Ma classe garde son nom ; son renommage
  et le rangement de son contenu relèvent d'un ticket suivant (U3 + U1).
- **Ce qui le rend vrai** : statuts serveur `backend/src/main/java/fr/brio/devoirs/domain/DerivationRendu.java:13-25`
  (colonne `V28__devoirs_schema.sql:41-42`) ; « à rendre » = `statutRendu != rendu` et non `corrige`
  (`devoirs/DevoirEleveVue.java:21-22`, filtre `web/lib/espace-eleve.ts:62`, `web/components/devoirs-eleve.tsx:55`).

### 3. Entraide de la classe (ADR 0023)

|        | Élève                                                                         | Prof                                                |
| ------ | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| Nom    | **Entraide** (bouton, onglet du rail)                                         | **Signalements d’entraide** (nav, titre, `<title>`) |
| Titres | « Entraide de la classe » (panneau), « Entraide sur cet exercice » (dialogue) |                                                     |

- **Interdit comme nom** : « Questions de la classe ». En phrase descriptive, « les questions de ta
  classe » reste permis pour dire ce que contient l'entraide.
- **Distinct de** : la **Communauté** (questions entre classes, `/communaute`) et le **Salon**
  (messagerie libre de la classe). Côté prof, « Signalements d’entraide » s'oppose à
  « Signalements du salon ».
- **Ce qui le rend vrai** : réservé aux membres de la classe, élèves et enseignants
  (`backend/src/main/java/fr/brio/social/EntraideService.java:147-149`, `:319-322`) ; un signalement
  arrive dans la file de l'enseignant de la classe (`EntraideService.java:133-140`, `:240-241`),
  distincte de celle du salon (`MessagerieService.java:163`).

### 4. La personne qui enseigne, nommée à l'élève

- **Élève** : **ton prof** (« Ton prof » en début de phrase).
- **Interdit côté élève** : « ton enseignant », « ton professeur », « au professeur ».
- « enseignant » est réservé au **rôle et au compte** : badge « Enseignant », « Espace enseignant »,
  « Créer un compte enseignant ». Côté prof, l'élève est « tes élèves ».

### 5. Leçon (contenu d'un chapitre)

- **Nom** : **leçon** ; type de diapo « Leçon » (`web/lib/diapos.ts:90`). **Interdit** : « partie du cours » sur un chapitre.
- **Texte commun chapitre / cours** : le renvoi après une erreur dit « Regarde cette partie. » sans
  nommer l'objet, car `ChapterView` sert aussi au cours d'un prof (`web/app/(app)/cours/[coursId]/page.tsx:145`,
  `web/components/chapter-view.tsx:162-168`) ; le lien « Revoir : <titre> » qui suit nomme la partie.
  De même « relis la partie précédente ». Jamais « section » dans un texte visible.

### 6. Partie (sous-unité d'un cours, éditeur prof)

- **Nom** : **partie** ; un titre à l'intérieur d'une partie est un **intertitre**.
- **Interdit** : « section » dans un texte visible (le mot reste permis dans le code : `sections`).
- **Ce qui le rend vrai** : messages de validation de l'éditeur (`web/lib/cours-editeur.ts:644-648`).

## Concepts vérifiés sans doublon (ne pas toucher)

Classe (« Ma classe » élève / « Mes classes » prof) · Salon (« Salon », « Salon de la classe »,
« Signalements du salon ») · Élève (« camarade » en phrase, jamais « apprenant ») · Exercice (jamais
« activité ») · Chapitre, parcours, matière (catalogue) · Communauté.

## Contrôles

```sh
grep -rniE "cours du prof|cours de ton prof|revenir à tes cours|tes devoirs, ses cours" web/app web/components web/lib
grep -rnE "ton enseignant|ton professeur" web/app web/components
grep -rn "Questions de la classe" web/components web/app
grep -rnE "partie du cours|Titre de section|intertitre dans la section" web/components web/lib
```

Chaque commande doit ne rien renvoyer.
