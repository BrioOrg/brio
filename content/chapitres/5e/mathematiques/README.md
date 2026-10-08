# Mathématiques 5e — découpage éditorial Brio

Ce document enregistre les décisions éditoriales sur le découpage des chapitres de mathématiques en
5e et leur correspondance au programme de cycle 4 de 2026 (arrêté du 18 février 2026, BO n°10 du
5 mars 2026, applicable en 5e à la rentrée 2026). Les 71 compétences `cycle4-2026` de 5e sont
décrites dans `content/referentiel/README.md` ; la transition depuis le programme de 2020 est
expliquée dans l'ADR 0009 (« Staggered rollout »).

`_index.json` donne l'ordre réel des chapitres ; ce document les range par thème du programme.

## Légende

- ✅ rédigé et publié — fichier présent, ingestion vérifiée
- 🚧 partiel — rédigé, mais une partie du programme attend une fonctionnalité de rendu (issue liée)

Les chapitres sont publiés directement (`status: "published"`), sans relecture préalable, tant que
le produit est en développement (voir `content/AUTHORING.md`, règle 3).

---

## Nombres et calculs

| Slug | Titre | Statut |
|---|---|---|
| `division-decimale-problemes` | Diviser par un décimal et résoudre des problèmes | ✅ |
| `expressions-priorites` | Enchainer les opérations : priorités et distributivité | ✅ |
| `multiples-diviseurs` | Multiples, diviseurs et critères de divisibilité | ✅ |
| `nombres-relatifs` | Les nombres relatifs : repérer, comparer | ✅ |
| `relatifs-addition-soustraction` | Additionner et soustraire des nombres relatifs | ✅ |
| `fractions-comparer-additionner` | Fractions : comparer, additionner, soustraire | ✅ |
| `puissances-carre-cube` | Carrés et cubes : premières puissances | ✅ |
| `calcul-litteral` | Expressions littérales : produire, calculer, tester | ✅ |
| `developper-reduire` | Développer, factoriser, réduire, démontrer | ✅ |
| `equations-premieres` | Premières équations | ✅ |

## Espace et géométrie

| Slug | Titre | Statut |
|---|---|---|
| `symetrie-centrale` | Le demi-tour (symétrie centrale) | ✅ |
| `angles-parallelisme` | Angles et parallélisme | ✅ |
| `triangles-angles-construction` | Triangles : somme des angles et constructions | ✅ |
| `triangles-droites-remarquables` | Triangles : médiatrices, hauteurs, médianes et aire | ✅ |
| `parallelogrammes` | Le parallélogramme et les parallélogrammes particuliers | ✅ |
| `aires-figures-complexes` | Aires : parallélogramme, disque, figures complexes | ✅ |
| `solides-volumes` | Solides : représentations, patrons et volumes | ✅ |

Le programme range aires, volumes et conversions dans « Espace et géométrie » ; le référentiel Brio
les garde dans le domaine `gm` (décision de #213 : pas de nouveau domaine).

## Organisation et gestion de données, probabilités ; proportionnalité, fonctions

| Slug | Titre | Statut |
|---|---|---|
| `statistiques` | Statistiques : effectifs, fréquences, représentations, moyenne | ✅ |
| `probabilites-equiprobabilite` | Probabilités : vocabulaire et équiprobabilité | ✅ |
| `proportionnalite-pourcentages` | Proportionnalité et pourcentages | ✅ |
| `fonctions-dependance` | Une grandeur en fonction d'une autre | ✅ |

Le slug `probabilites` est déjà pris par la 6e : les slugs doivent être uniques sur tout le
catalogue, même d'un niveau à l'autre (#218).

## La pensée informatique

| Slug | Titre | Statut |
|---|---|---|
| `programmes-blocs` | Programmer : instructions, formules et boucles | 🚧 programmes en texte, pas en blocs (#217) |

---

## Ordre des chapitres

Chaque chapitre déverrouille le suivant. L'ordre de `_index.json` alterne donc les thèmes, pour
qu'un élève n'ait pas à finir toute la géométrie avant d'aborder les statistiques. Il respecte les
dépendances entre chapitres :
- `nombres-relatifs` avant `symetrie-centrale` (coordonnées négatives) et avant `relatifs-addition-soustraction` ;
- `angles-parallelisme` avant `triangles-angles-construction` (la démonstration de la somme des
  angles utilise les angles alternes-internes) ;
- `fractions-comparer-additionner` avant `statistiques` et `proportionnalite-pourcentages` ;
- `triangles-droites-remarquables` (aire du triangle) avant `aires-figures-complexes`, puis
  `solides-volumes` (aire du disque, puissances).

## Automatismes

Le programme liste des **automatismes** à chaque thème. Ils n'ont pas de code de compétence
(décision de #213) : quand un chapitre les entraîne, c'est dans une section « Automatismes » dont
les exercices ont `competencies: []`. Ils ne comptent donc pas dans la maîtrise.

## Limites de rendu (lot de #213)

- **Perspective cavalière** : réglé par #215. Le pavé, le cube, le prisme droit et le cylindre
  sont dessinés par `solids` ; les patrons restent des `polygons`.
- **Diagrammes** : réglé par #216. Barres, circulaire et courbe sont des blocs `chart`
  (ADR 0030) ; `statistiques` fait lire des diagrammes en barres et un diagramme circulaire.
- **Programmes par blocs** (#217) : texte dans un bloc `code`. Le signe × remplace le `*` de
  Scratch, car un `*` isolé ouvre un italique dans le texte riche.
- Placer un point dans un repère, tracer ou construire à la règle : impossible à évaluer en ligne.
  Les constructions passent par des exercices `paper` (au plus deux par chapitre).
