# Mathématiques 6e — découpage éditorial Brio

Ce document enregistre les décisions éditoriales sur le découpage des chapitres de mathématiques en
6e et leur correspondance aux cinq thèmes du programme 2025 (cycle 3, BO n°16 du 17 avril 2025).

**Il ne reflète pas l'état de `_index.json`**, qui ne liste que les chapitres réellement déposés.
Le découpage et l'ordre sont provisoires : ils évoluent à mesure que les chapitres sont rédigés et
que les contraintes de rendu (éditeur, exerciseur) se précisent.

## Légende

- ✅ rédigé — fichier présent, ingestion vérifiée
- 🔲 prévu — décision prise, pas encore rédigé
- 📝 brouillon — fichier présent en `status: "draft"`, ingestion vérifiée par le test d'intégration, relecture humaine à faire (checklist d'`AUTHORING.md`)
- 🚧 bloqué — dépend d'une fonctionnalité non encore disponible

---

## Thème 1 — Nombres et calculs

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 1 | `nombres-decimaux-notation` | La numération décimale : lire, écrire, placer | ✅ |
| 2 | `nombres-decimaux-comparer-ranger` | Les nombres décimaux : comparer, ranger, encadrer | ✅ |
| 3 | `nombres-decimaux-operations` | Les quatre opérations : entiers et décimaux | ✅ |
| 4 | `fractions` | Les fractions : sens, écritures, comparaison | ✅ |
| 5 | `fractions-operations` | Calculer avec les fractions | ✅ |
| 6 | `pourcentages` | Les pourcentages | ✅ |
| 7 | `pre-algebre` | Introduction à l'algèbre : modèles et régularités | ✅ |

**Note sur l'ordre** : le chapitre 1 (notation) a été rédigé en second, après le chapitre 2
(comparer/ranger/encadrer), car il attendait `short-answer` (disponible depuis issue #36) et
les droites graduées déclaratives (disponibles depuis issue #37). Les quatre chapitres sont
désormais rédigés dans l'ordre pédagogique 1 → 2 → 3 → 4.

---

## Thème 2 — Espace et géométrie

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 8 | `distances-milieu` | Distances et milieu d'un segment | ✅ |
| 9 | `cercles-disques` | Cercles et disques | ✅ |
| 10 | `mediatrice` | La médiatrice | ✅ |
| 11 | `angles-bissectrice` | Les angles et la bissectrice | ✅ |
| 12 | `triangles` | Les triangles : construction et propriétés | ✅ |
| 13 | `symetrie-axiale` | La symétrie axiale | ✅ |
| 14 | `espace-solides` | Visualiser l'espace : assemblages de cubes | ✅ |

---

## Thème 3 — Grandeurs et mesures

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 15 | `perimetres` | Périmètres : cercle et figures composées | ✅ |
| 16 | `aires` | Aires et conversions | ✅ |
| 17 | `volumes` | Volumes : le centimètre cube | ✅ |
| 18 | `durees` | Durées et horaires | ✅ |

---

## Thème 4 — Organisation et gestion de données

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 19 | `donnees-tableaux` | Recueillir et organiser des données | ✅ |
| 20 | `probabilites` | Introduction aux probabilités | ✅ |
| 21 | `proportionnalite` | La proportionnalité | ✅ |

---

## Thème 5 — Algorithmique et programmation

| # | Slug prévu | Titre | Statut |
|---|---|---|---|
| 22 | `instructions-programmes` | Instructions et programmes | ✅ |

---

## Correspondance programme → compétences Brio

Chaque chapitre couvre un sous-ensemble des codes du référentiel `cycle3-2025`. La liste complète
des codes est dans `content/referentiel/mathematiques-college.json`. Le chapitre 2 (rédigé) cible
`c3.num.decimaux.comparer-ordonner` et `c3.num.decimaux.arrondir-encadrer`.

---

## Ordre de `_index.json`

`_index.json` suit l'ordre des thèmes de ce document. Le parcours verrouille chaque chapitre
tant que le précédent n'est pas terminé (ADR 0022) : un élève doit donc finir la géométrie avant
d'atteindre la proportionnalité. `pourcentages` et `perimetres` n'en dépendent pas (ils passent
par les fractions), mais si l'ordre devient gênant en classe, c'est ce fichier qu'il faut revoir.

## Limites de rendu rencontrées (lot de chapitres 5 à 22)

- **`espace-solides`** : le bloc `figure` dessine un solide isolé en perspective cavalière
  depuis #215 (`solids`), mais pas un **assemblage de cubes** (#226). Le chapitre couvre
  `c3.geo.espace.visualiser-assemblages` avec le **plan coté** (tableau du nombre de cubes par
  case, vue de dessus) et des vues décrites en texte. Les patrons ne figurent pas dans les
  attendus de 6e du programme 2025.
- **Droites** : le renderer ne trace que des segments. Un axe nommé « (d) » (`symetrie-axiale`)
  est un segment entre deux points sans point noir (`dot: false`, #214), dont l'un porte le nom.
- **Demi-cercles** (#227) : seuls les cercles complets se dessinent ; les figures composées de
  `perimetres` sont décrites en texte.
- **Graphiques** : aucun bloc ne trace de diagramme (#216). Le repère existe depuis #214, mais
  `donnees-tableaux` ne couvre pas encore la représentation de mesures dans un repère (partie de
  `c3.ogd.donnees.planifier-recueillir`).
- Les exercices `paper` (auto-évalués) ne sont pas comptés comme réussis : chaque chapitre en a au
  plus 2, pour rester au-dessus du seuil de complétion de 80 %.
