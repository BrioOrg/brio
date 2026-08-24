# Mathématiques 6e — découpage éditorial Brio

Ce document enregistre les décisions éditoriales sur le découpage des chapitres de mathématiques en
6e et leur correspondance aux cinq thèmes du programme 2025 (cycle 3, BO n°16 du 17 avril 2025).

**Il ne reflète pas l'état de `_index.json`**, qui ne liste que les chapitres réellement déposés.
Le découpage et l'ordre sont provisoires : ils évoluent à mesure que les chapitres sont rédigés et
que les contraintes de rendu (éditeur, exerciseur) se précisent.

## Légende

- ✅ rédigé — fichier présent, ingestion vérifiée
- 🔲 prévu — décision prise, pas encore rédigé
- 🚧 bloqué — dépend d'une fonctionnalité non encore disponible

---

## Thème 1 — Nombres et calculs

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 1 | `nombres-decimaux-notation` | La numération décimale : lire, écrire, placer | 🔲 |
| 2 | `nombres-decimaux-comparer-ranger` | Les nombres décimaux : comparer, ranger, encadrer | ✅ |
| 3 | `nombres-decimaux-operations` | Les opérations sur les décimaux | 🔲 |
| 4 | `fractions` | Les fractions : sens, écritures, comparaison | 🔲 |
| 5 | `fractions-operations` | Calculer avec les fractions | 🔲 |
| 6 | `pourcentages` | Les pourcentages | 🔲 |
| 7 | `pre-algebre` | Introduction à l'algèbre : modèles et régularités | 🔲 |

**Note sur l'ordre** : le chapitre 2 (comparer/ranger/encadrer) précède le chapitre 1 (notation)
dans la rédaction car il porte les seuls types d'exercices disponibles (`multiple-choice`,
`numeric`). La notation décimale sera écrite quand les exercices de type `short-answer` seront
utilisables. L'ordre pédagogique réel est 1 → 2 → 3.

---

## Thème 2 — Espace et géométrie

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 8 | `distances-milieu` | Distances et milieu d'un segment | 🔲 |
| 9 | `cercles-disques` | Cercles et disques | 🔲 |
| 10 | `mediatrice` | La médiatrice | 🔲 |
| 11 | `angles-bissectrice` | Les angles et la bissectrice | 🔲 |
| 12 | `triangles` | Les triangles : construction et propriétés | 🔲 |
| 13 | `symetrie-axiale` | La symétrie axiale | 🔲 |
| 14 | `espace-solides` | Visualiser l'espace : assemblages et patrons | 🚧 |

---

## Thème 3 — Grandeurs et mesures

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 15 | `perimetres` | Périmètres : cercle et figures composées | 🔲 |
| 16 | `aires` | Aires et conversions | 🔲 |
| 17 | `volumes` | Volumes : le centimètre cube | 🔲 |
| 18 | `durees` | Durées et horaires | 🔲 |

---

## Thème 4 — Organisation et gestion de données

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 19 | `donnees-tableaux` | Recueillir et organiser des données | 🔲 |
| 20 | `probabilites` | Introduction aux probabilités | 🔲 |
| 21 | `proportionnalite` | La proportionnalité | 🔲 |

---

## Thème 5 — Algorithmique et programmation

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 22 | `instructions-programmes` | Instructions et programmes | 🔲 |

---

## Correspondance programme → compétences Brio

Chaque chapitre couvre un sous-ensemble des codes du référentiel `cycle3-2025`. La liste complète
des codes est dans `content/referentiel/mathematiques-college.json`. Le chapitre 2 (rédigé) cible
`c3.num.decimaux.comparer-ordonner` et `c3.num.decimaux.arrondir-encadrer`.

---

## Note sur les chapitres bloqués

**`espace-solides` (chapitre 14)** reste bloqué : les patrons et les assemblages de
solides nécessitent des figures 3D ou des représentations en perspective que le bloc
`figure` (ADR 0013) ne couvre pas. Ce chapitre sera débloqué dans une issue dédiée
quand le besoin de représentation 3D sera traité.
