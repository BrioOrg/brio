# Brio content authoring guide

Version 1 — extracted from the authoring of `nombres-decimaux-comparer-ranger` (issue #29).
Update this file when a new chapter reveals a better rule or breaks an existing one.

---

## Exercices rédigés de leçon

L’[ADR 0051](../docs/adr/0051-exercices-rediges.md) prévoit des exercices de leçon avec énoncé
complet, remise et référence de correction. Le premier parcours du catalogue utilise
[`exercices-rediges/catalogue.json`](exercices-rediges/catalogue.json). Chaque entrée indique
la leçon publiée (`niveau`, `matiere`, `slug`), un identifiant stable, une version, un titre,
un énoncé, une réponse polynomiale attendue et un corrigé expliqué. Augmenter la version si
l’énoncé ou la correction change. Le corrigé commun est accessible dans l’app après remise.

Le correcteur compare exactement les polynômes en `x` dans son domaine pris en charge.
Choisir un énoncé adapté au niveau de la leçon et préciser quand la réponse doit être saisie
sans unité. Les types de réponse rapide ci-dessous restent utilisés pour les blocs du cours.

## Three rules that apply to every chapter

### 1. Compétences : les exercices, jamais la prose

Les compétences d'un chapitre sont celles que ses **exercices** évaluent — pas celles que
son cours mentionne. Ne pas mettre de tag `competencies` sur la prose, même si elle traite
une notion. Si tu veux mesurer une compétence, écris un exercice qui l'évalue explicitement.

**Pourquoi** : le module `progression` agrège la maîtrise par code. Un tag sur de la prose
produirait une "maîtrise" sans acte de l'élève — un bruit qui noierait le signal.

**Affectation d'une compétence à un chapitre** : un code de compétence appartient au chapitre
dont les exercices évaluent la facette concernée. Quand un code couvre plusieurs facettes
(ex. `connaitre-ecritures` inclut fractions décimales, nombres mixtes et pourcentages), chaque
chapitre déclare le code mais n'évalue que sa propre facette. Le code est attribué à chaque
chapitre qui l'évalue partiellement — pas réservé à un seul. Signale dans la PR description
si un code est ainsi partagé pour en garder une trace lisible.

### 2. QCM pour les erreurs diagnostiques, numérique pour les réponses produites

- **`multiple-choice`** quand les mauvaises réponses peuvent incarner des conceptions erronées
  documentées. Chaque distracteur doit répondre à : *pourquoi un élève choisirait-il cette
  option ?* Si tu ne peux pas répondre en une phrase, c'est un remplissage — remplace-le.
  Le champ `explanation` doit démonter le piège spécifique de chaque option fausse.

- **`numeric`** quand la réponse se produit : la borne inférieure d'un encadrement, un arrondi,
  une longueur calculée. La borne supérieure ou la conclusion triviale ne méritent pas un
  exercice séparé.

- **`short-answer`** quand la réponse est un mot ou une courte expression avec un ensemble fini
  de formulations correctes : un nom (« hypoténuse »), une définition courte, un terme technique.
  Voir ci-dessous pour les règles d'authoring.

- **`free-text`**, **`ordering`** ne sont pas encore utilisables (pas d'évaluateur ou de
  rendu) — ne pas les introduire.

- **`figure`** pour toute illustration mathématique. Les figures sont **toujours
  déclaratives** — ne jamais utiliser le bloc `image` pour des mathématiques (voir
  ci-dessous).

#### Authoring d'un exercice `short-answer`

L'évaluateur applique un pipeline de normalisation identique à la soumission et à chaque
`acceptedAnswer` avant de comparer : trim → suppression des accents (NFD) → minuscules (sauf
`caseSensitive: true`) → suppression de la ponctuation et des espaces finaux (`[\s.!?;]+`).

**`acceptedAnswers`** — liste exhaustive des formulations correctes après normalisation.

- **Ne pas dupliquer les variantes d'accent, de casse ou de ponctuation finale** : la
  normalisation les neutralise déjà. Lister `"hypoténuse"`, `"hypotenuse"`, `"Hypoténuse"` et
  `"hypoténuse."` comme quatre réponses distinctes est du travail perdu — seules les
  **variantes lexicales** méritent une entrée séparée.
- Inclure les variantes avec et sans article si les deux sont acceptables :
  `"hypoténuse"` et `"l'hypoténuse"`.
- Inclure les formulations synonymes utilisées dans le cours :
  `"les côtés de l'angle droit"` et `"côtés de l'angle droit"`.
- Ne pas inclure de vocabulaire hors programme (belgicismes, helvétismes, termes
  universitaires) sauf s'ils sont explicitement introduits dans le cours.
- La virgule n'est pas strippée (séparateur décimal en français) — ne pas en mettre en
  fin d'`acceptedAnswer`.

**`caseSensitive`** — laisser à `false` sauf si la casse est sémantiquement significative
(noms de points géométriques, variables). La normalisation des accents s'applique toujours.

**`explanation`** — **obligatoire** sur un `short-answer`. C'est le seul retour disponible
quand l'élève se trompe ; sans lui, l'interface affiche un message générique qui ne l'aide pas.
L'explication doit donner la réponse et, si possible, pointer vers la notion du cours qui
définit le terme.

**Frontières du type `short-answer`** — ne jamais l'utiliser pour :
- Une réponse numérique (→ `numeric`) : `answer` + `tolerance` offrent une vérification exacte.
- Une phrase complète ou une réponse ouverte : la normalisation ne s'applique pas à des
  formulations longues. Les parcours de revue des copies font l’objet de l’ADR 0051.
`short-answer` convient pour un nom, un rang, un terme technique, une écriture courte avec un
ensemble fini de formulations acceptables.

### 3. Aucun agent ne publie

`status: "draft"` reste dans le fichier jusqu'à ce qu'un humain ait : ingéré, ouvert la page,
soumis chaque exercice juste et faux, vérifié que la réponse de l'API ne contient aucun champ
sensible (`answer`, `acceptedAnswers`, `referenceAnswer`, `rubric`, `correct`). Le basculement
`draft → published` est un acte d'attestation, pas un paramètre technique.

**Exception, tant que le produit est en développement** (décision de Pierce, #213, 2026-10-07) :
les nouveaux chapitres sont publiés directement, sans cette relecture préalable. Elle redevient
obligatoire avant l'ouverture à de vrais élèves (ce sont des mineurs) : chaque chapitre publié
sans attestation devra alors passer la checklist ci-dessous.

---

## Entrées à donner au modèle pour écrire un chapitre

1. **Les codes de compétences ciblés** — uniquement ceux que les exercices évalueront. Copier
   les `intitule` correspondants depuis `content/referentiel/mathematiques-college.json`.

2. **Les types d'exercices disponibles** — aujourd'hui : `multiple-choice`, `numeric`, et
   `short-answer`. Rappeler au modèle que `free-text` et `ordering` existent dans le schéma
   mais ne renderont pas.

3. **Les contraintes de rendu actives** :
   - Pas d'images ni de figures.
   - Les blocs `formula` sont rendus par KaTeX. Toute formule mathématique passe par un
     bloc `formula` — ne jamais écrire de LaTeX inline dans la prose ou les callouts
     (l'inline math n'est pas supportée ; voir règle "Formules" ci-dessous).
   - La notation simple sans LaTeX s'écrit directement en prose : `3,15 < 3,9`, `a < x < b`.

4. **Le niveau et la progression supposée** — ce que l'élève est censé savoir avant d'abrir le
   chapitre, et ce qu'il doit savoir après.

5. **Les erreurs typiques à débusquer** — la source principale est la littérature didactique et
   l'expérience de classe. Pour les décimaux 6e : croire que 3,15 > 3,9 (comparaison des parties
   décimales comme des entiers) ; croire que 0,10 > 0,9 (plus de chiffres = plus grand). Ces
   erreurs doivent devenir des distracteurs de QCM.

6. **La règle de vérification des exercices numériques** : chaque `answer`, `tolerance` et `unit`
   est vérifié à la main avant commit. Indiquer au modèle de laisser un commentaire `// VERIFIER`
   sur chaque exercice numérique s'il a un doute — et de ne pas inventer de valeurs.

---

## Règles éditoriales

### Structure d'un chapitre

- **Section d'ouverture (lesson)** : rappels ou définitions sans exercice. Pas de tags de
  compétence ici (voir règle 1). Prose + callouts suffisent.
- **Sections de cours (lesson)** : une idée centrale par section, 2 à 3 exercices inline
  directement après la notion qu'ils testent. L'exercice doit arriver au moment où l'élève
  a juste assez de contexte pour l'aborder.
- **Section finale (exercises)** : exercices de consolidation et d'approfondissement, pas de
  rappels de cours. Minimum 2 exercices par compétence ciblée dans cette section.

### Figures

Les figures mathématiques sont **toujours déclaratives** : elles spécifient des points
nommés avec des coordonnées logiques, et un renderer les convertit en SVG. Le bloc `image`
est réservé aux assets photographiques (photos, schémas scannés) — ne jamais l'utiliser
pour des figures géométriques ou des droites graduées.

**Pourquoi déclaratif** : un modèle d'IA ne peut pas dessiner un triangle rectangle avec
des angles précis. Une spécification déclarative, elle, est vérifiable par script — voir
ADR 0013.

#### Bloc `figure` — structure minimale

```json
{
  "id": "fig-triangle-abc",
  "type": "figure",
  "alt": "Triangle rectangle ABC avec l'angle droit en A.",
  "caption": "Le triangle ABC, rectangle en A.",
  "spec": {
    "points": [
      { "name": "A", "x": 0, "y": 0, "label": { "placement": "below-left" } },
      { "name": "B", "x": 4, "y": 0, "label": { "placement": "below-right" } },
      { "name": "C", "x": 0, "y": 3, "label": { "placement": "above-left" } }
    ],
    "polygons": [{ "vertices": ["A", "B", "C"] }],
    "angleMarks": [{ "vertex": "A", "from": "B", "to": "C", "right": true }]
  }
}
```

#### Règles d'authoring des figures

- **`alt`** est obligatoire. Une figure sans équivalent textuel est invalide.
- **`id` de bloc** : préfixe `fig-` + quelques mots descriptifs.
- **Coordonnées logiques** : choisir des entiers simples quand c'est possible (triangle
  3-4-5 plutôt qu'une approximation). Les coordonnées sont des faits mathématiques
  vérifiables par CI.
- **`coordinateSpace`** : omettre sauf si la vue doit s'étendre au-delà des points
  déclarés (ex. droite graduée de 0 à 10 avec des marks seulement en 3 et 7). Jamais avec
  `axes`.
- **`angleMarks` droit** : utiliser `"right": true` uniquement quand l'angle est
  effectivement 90°. `check-content.mjs` vérifie la valeur aux coordonnées données.
- **`lengthMarks`** : le champ `segment` est la concaténation des noms des deux
  extrémités (ex. `"AB"` pour le segment de A à B). Les segments partageant le même
  nombre de traits sont déclarés de même longueur — le script CI le vérifie.
- **Cercles** : préférer `{ "center": "O", "through": "A" }` (formulation au compas)
  à `{ "center": "O", "radius": 5 }`. Les deux sont acceptés ; un seul à la fois.
- **Placement des étiquettes** : valeurs possibles — `auto` (défaut), `above`, `below`,
  `left`, `right`, `above-left`, `above-right`, `below-left`, `below-right`.

#### Droites graduées

Utiliser l'élément `numberLines` plutôt que d'énumérer des points manuellement :

```json
"numberLines": [
  { "from": 0, "to": 10, "step": 1, "labelEvery": 2,
    "marks": [{ "value": 3.5, "label": "3,5" }] }
]
```

`step` : espacement entre deux graduations. `labelEvery` : afficher un label tous les
N unités (doit être un multiple entier de `step`). `marks` : points d'emphase avec
label personnalisé (séparateur décimal français : virgule).

**Ne jamais énumérer les graduations à la main** : déclare toujours `from`, `to`, `step` —
le renderer calcule les positions. Lister 101 points pour une droite de 0 à 10 par pas de
0,1 est une erreur d'authoring.

Le renderer écrit les nombres des graduations à la française (« −3 », « 0,5 ») ; l'étiquette
d'une `mark` se place au-dessus de la droite, les nombres en dessous.

#### Repère orthogonal

Pour lire ou placer des points, tracer une courbe ou un graphique de proportionnalité, utilise
`axes` (ADR 0013, amendement #214) : jamais une droite graduée plus un segment vertical.

```json
"spec": {
  "axes": {
    "x": { "from": 0, "to": 24, "step": 2, "labelEvery": 4, "title": "Heure (h)" },
    "y": { "from": 0, "to": 20, "step": 2, "labelEvery": 4, "title": "Température (°C)" },
    "grid": true
  },
  "points": [
    { "name": "t0", "x": 0, "y": 6, "dot": false, "showName": false },
    { "name": "t4", "x": 4, "y": 4, "dot": false, "showName": false },
    { "name": "t8", "x": 8, "y": 8, "dot": false, "showName": false }
  ],
  "polylines": [{ "points": ["t0", "t4", "t8"] }]
}
```

- Les deux axes se coupent à l'origine : `0` doit être entre `from` et `to` sur chaque axe.
  Un seul « 0 » est écrit, en bas à gauche de l'origine ; un point nommé à l'origine (souvent
  `O`) le remplace.
- Chaque axe a **sa propre échelle** : le repère remplit le cadre même si les plages sont
  très différentes (de 0 à 5 en abscisse, de 0 à 200 en ordonnée).
- `labelEvery` (multiple de `step`) dit quelles graduations portent un nombre. `title` dit
  ce que mesure l'axe, unité comprise.
- `grid: true` trace un quadrillage à chaque graduation : à mettre dès que l'élève doit lire
  une coordonnée.
- Pas de `coordinateSpace` ni de `numberLines` avec `axes` : les axes fixent la zone visible.
- `angleMarks`, `lengthMarks`, `circles` et `arcs` ne sont acceptés que si les deux axes ont la
  **même plage** (`to − from` égal) : sinon le dessin est étiré et ne montrerait pas ce que
  le script vérifie.

#### Points de construction et lignes brisées

- `"dot": false` masque le point noir, `"showName": false` masque le nom. Le nom reste
  l'identifiant du point dans la spec : donne-lui un nom court et unique (`t4`, `b1h`…).
  **Jamais de nom blanc** (`" "`) : `check-content.mjs` le refuse.
- `"polylines": [{ "points": ["A", "B", "C"] }]` trace une ligne brisée sans déclarer chaque
  segment (une courbe point par point, un contour ouvert).
- `"style": "dashed"` sur un segment, une ligne brisée ou un polygone le trace en pointillés
  (trait de construction, axe de symétrie). Un seul côté d'un polygone en pointillés : un
  segment à part.

#### Courbes de fonctions (ADR 0038)

Une fonction se trace par son expression, jamais par une ligne brisée : une `polylines` reste
réservée aux relevés (températures heure par heure).

```json
"functions":  [{ "name": "f", "expr": "4x", "domain": [0, 6], "label": true }],
"readings":   [{ "function": "f", "x": 3 }, { "function": "f", "y": 20 }],
"parameters": [{ "name": "a", "min": 0.5, "max": 4, "step": 0.5, "value": 1.5 }]
```

- `expr` s'écrit comme sur papier, sans « f(x) = » : `2x + 1`, `x² − 3`, `1/x`, `√x`, `3(x + 1)`,
  virgule décimale permise. Seuls `x` et les lettres de `parameters` sont acceptés.
  `1/2x` se lit (1/2) × x : écris `1/(2x)` pour l'autre sens.
- `label: true` écrit 𝒞f près de la courbe ; un texte (`"Tarif A"`) l'écrit à la place. En 5e,
  on n'écrit souvent aucun nom.
- Une lecture `x` montre l'image, une lecture `y` tous les antécédents visibles : pointillés et
  valeurs en couleur. Elle donne la réponse : jamais sur la figure d'un exercice qui la demande.
- Un paramètre ajoute un curseur sous la figure ; l'impression utilise `value`.
- `tone: 1…4` colore la courbe comme sa formule dans le texte, rien d'autre.

#### Arcs et figures composées

Un arc de cercle est un élément `arcs` (ADR 0013, amendement #227) : jamais une suite de petits
segments. Il se trace toujours **dans le sens inverse des aiguilles d'une montre**, du départ à
l'arrivée.

Recette — une fenêtre : un carré surmonté d'un demi-disque.

```json
"spec": {
  "points": [
    { "name": "A", "x": 0, "y": 0, "dot": false, "showName": false },
    { "name": "B", "x": 8, "y": 0, "dot": false, "showName": false },
    { "name": "C", "x": 8, "y": 8, "dot": false, "showName": false },
    { "name": "D", "x": 0, "y": 8, "dot": false, "showName": false },
    { "name": "M", "x": 4, "y": 8, "dot": false, "showName": false }
  ],
  "polylines": [{ "points": ["D", "A", "B", "C"] }],
  "segments": [{ "from": "D", "to": "C", "style": "dashed" }],
  "arcs": [{ "center": "M", "from": "C", "to": "D" }],
  "labels": [{ "text": "80 cm", "x": 4, "y": -0.8 }]
}
```

1. **Par points** : `center`, `from`, `to`, trois points nommés. L'arc part de `from` et tourne
   dans le sens direct jusqu'à `to` : de C (à droite) à D (à gauche), il passe par le haut. Pour
   l'autre arc entre les deux mêmes points, échange `from` et `to`. `from` et `to` doivent être
   **à la même distance du centre** : `check-content.mjs` le vérifie.
2. **Par angles** : `{ "center": "A", "radius": 5, "startAngle": -20, "endAngle": 20 }`, en
   degrés, `startAngle < endAngle`, moins d'un tour. Pour un arc de construction au compas, dont
   les extrémités ne sont pas des points de la figure.
3. `"closed": "chord"` ferme l'arc par la corde (un demi-disque seul), `"closed": "sector"` par
   les deux rayons (un quart de disque). Sans `closed`, l'arc est ouvert : c'est ce qu'il faut
   dans une figure composée, dont les côtés droits sont déjà tracés.
4. `"style": "dashed"` : un arc de construction en pointillés.
- Une figure composée se dessine **à l'échelle** des longueurs de l'énoncé (80 cm → 8 unités) ;
  les longueurs s'écrivent avec des `labels`.
- Un côté qui ne fait pas partie du contour (le diamètre caché sous un demi-disque, les largeurs
  d'un terrain arrondi) est un segment en **pointillés**, pas un trait plein.
- Un cercle entier reste un élément `circles` : un arc qui ferait le tour est refusé.

#### Solides en perspective cavalière

Un solide se décrit par ses **dimensions**, jamais arête par arête (ADR 0013, amendement #215).
Le renderer calcule les fuyantes et décide seul quelles arêtes sont cachées : n'écris pas de
pointillés à la main pour un solide.

Recette — dessiner un pavé en perspective cavalière :

```json
"spec": {
  "solids": [
    { "kind": "pave", "x": 0, "y": 0, "width": 4, "height": 3, "depth": 2,
      "names": ["A", "B", "C", "D", "E", "F", "G", "H"] }
  ]
}
```

1. `x`, `y` : le sommet avant en bas à gauche (A).
2. `width` × `height` : la face avant, dessinée **en vraie grandeur**. `depth` : la vraie
   profondeur ; le dessin la multiplie par `reduction` (0,5 par défaut).
3. Les fuyantes partent avec l'angle `angle` (45° par défaut, vers le haut et la droite) :
   les arêtes qui partent du sommet arrière en bas à gauche (E) sont cachées.
4. `names` (facultatif) : la face avant dans le sens A en bas à gauche, B, C, D, puis la face
   arrière dans le même ordre (E derrière A). Les noms des sommets cachés sont écrits aussi.
   Ces noms ne sont pas des `points` : les autres éléments ne peuvent pas y faire référence.

Les autres solides :

| `kind` | Dimensions | Position (`x`, `y`) | `names` |
|---|---|---|---|
| `cube` | `edge` | sommet avant en bas à gauche | 8 |
| `prisme` | `base` (polygone **convexe**, face avant en vraie grandeur, en décalages depuis `x`, `y`) et `depth` | premier sommet de la base | 2 × nombre de sommets de la base |
| `cylindre` | `radius`, `height` | centre de la base du bas | aucun |

- Le cylindre est dessiné debout, comme dans les manuels : bases en ellipses, moitié arrière
  de la base du bas en pointillés.
- `angle` dans ]0°, 180°[ sauf 90° ; `reduction` dans ]0, 1].
- Pas de solide dans un repère (`axes`) ni avec une droite graduée : ils ont leur propre
  échelle.
- Un **patron** se dessine avec des `polygons` (points masqués) ; un solide et son patron
  peuvent partager la même figure, à la même échelle.

#### Assemblages de cubes

Un assemblage de cubes se décrit par son **plan coté** (ADR 0013, amendement #226) : le même
tableau que celui de la leçon, recopié dans `heights`. Le renderer dessine les faces visibles,
ombrées (dessus clair, face, côté foncé), et les cubes de devant cachent ceux de derrière. Rien
n'est en pointillés : un cube caché ne se dessine pas.

Recette — dessiner l'assemblage dont le plan coté est « fond 2, 1, 0 ; devant 3, 1, 1 » :

```json
"spec": {
  "solids": [
    { "kind": "assemblage", "x": 0, "y": 0, "heights": [[2, 1, 0], [3, 1, 1]] }
  ]
}
```

1. `heights` : une ligne par rangée, **la rangée du fond en premier**, les cases de gauche à
   droite, comme le plan coté vu de dessus. Toutes les lignes ont autant de cases ; une case
   vide vaut `0`. Des nombres entiers.
2. Les cubes ont une arête de 1. `x`, `y` : le coin avant en bas à gauche de la rangée de
   devant.
3. `angle` et `reduction` comme pour les autres solides. À 45°, on voit le dessus, la face et
   le côté **droit** ; au-delà de 90°, le côté gauche.
4. Pas de `names`.
- Dessine l'assemblage **à côté de son plan coté**, pas à sa place : l'élève apprend à passer
  de l'un à l'autre.
- Pas d'assemblage dans l'énoncé d'un exercice « que voit-on de face / de côté ? » : le dessin
  montre déjà la réponse. Le plan coté seul fait travailler le raisonnement.
- Les **vues** (dessus, face, côté) ne sont pas dessinées par le renderer.

#### Transformations, vecteurs et droites

Une image par symétrie, translation, rotation ou homothétie ne se calcule **jamais** à la main
(ADR 0041) : on écrit la figure de départ et la transformation, le renderer place les images,
les nomme A′, B′, C′ (vrai prime) et trace la figure image en couleur.

```json
"spec": {
  "points": [
    { "name": "P", "x": 0, "y": -2, "dot": false, "showName": false },
    { "name": "Q", "x": 0, "y": 5, "dot": false, "showName": false },
    { "name": "A", "x": -5, "y": -1 }, { "name": "B", "x": -2, "y": 1 }, { "name": "C", "x": -3, "y": 4 }
  ],
  "polygons": [{ "vertices": ["A", "B", "C"] }],
  "lines": [{ "through": ["P", "Q"], "label": "(d)" }],
  "transformations": [
    { "kind": "symetrie-axiale", "axis": ["P", "Q"], "source": ["A", "B", "C"],
      "show": { "construction": true } }
  ]
}
```

1. `kind` et ses paramètres : `symetrie-axiale` (`axis`), `symetrie-centrale` (`center`),
   `translation` (`from`, `to`), `rotation` (`center`, `angle` en degrés, sens direct si positif),
   `homothetie` (`center`, `ratio`, négatif possible).
2. `source` : les points à transformer. Tout polygone, segment, ligne brisée ou cercle dont les
   points sont tous dans la source a son image.
3. `show.construction` : `true` (ou une liste de points de la source) ajoute les tracés du
   manuel (perpendiculaire codée, milieu codé, arc de compas…). Sur un polygone chargé, n'en
   construire qu'un ou deux points.
4. Les images sont des points : un segment `[AA′]` ou une transformation suivante peut les
   nommer. Un nom d'image ne doit pas déjà exister.
5. L'axe d'une symétrie axiale doit être tracé : une entrée `lines` (ou un segment).
- `lines` : la droite (AB) traverse toute la figure ; `label` la nomme « (d) ».
  `rays` : la demi-droite [AB), de A jusqu'au bord.
- `vectors` : une flèche de `from` à `to`, `label` en LaTeX (`\\vec{u}`, `\\overrightarrow{AB}`).
- En mode interactif, l'image arrive sur une étape : la figure de départ glisse, tourne ou se
  retourne jusqu'à elle. Rien à écrire pour cela.
- Dans le texte, écrire les images avec le même prime : `A′` (ou `$A'$` en formule).

### Diagrammes statistiques

Un diagramme en barres, circulaire ou une courbe à abscisses catégorielles est un bloc `chart`,
pas une `figure` (ADR 0030). On donne les catégories et leurs valeurs ; le renderer calcule les
barres, les secteurs et les graduations.

Recette — un diagramme en barres :

```json
{ "id": "chart-sports", "type": "chart", "kind": "bar",
  "title": "Le sport préféré de 25 élèves", "xLabel": "Sport", "yLabel": "Effectif",
  "series": [ { "label": "Effectif",
                "data": [ { "label": "Football", "value": 8 }, { "label": "Basket", "value": 5 } ] } ],
  "alt": "Diagramme en barres du sport préféré. Football 8, Basket 5." }
```

- `kind` : `bar`, `pie` ou `line`. Une courbe dont l'abscisse est un **nombre** (fonction,
  proportionnalité) reste une `figure` avec `axes`.
- **Une seule série**, de 2 à 12 catégories (6 pour un circulaire), sans doublon. Barres :
  valeurs positives ou nulles ; circulaire : strictement positives ; courbe : négatives
  permises (températures).
- L'axe vertical part **toujours de 0**. Graduation automatique (pas de 1, 2 ou 5 × 10ⁿ) ;
  `yStep` et `yMax` la fixent quand l'exercice demande une lecture précise (une valeur impaire
  sur un axe gradué de 2 en 2 se lit mal).
- **Aucune valeur écrite** sur le diagramme par défaut : elle donnerait la réponse aux
  exercices de lecture. `showValues: true` les écrit (barres, courbe). Un secteur ne porte que
  le nom de sa catégorie.
- Un circulaire n'a ni `xLabel`, ni `yLabel`, ni `yMax`, ni `yStep`, ni `showValues`.
- `alt` décrit les données (un lecteur d'écran reçoit aussi un tableau masqué des valeurs).
- Un exercice ne contient pas de blocs : un exercice sur un diagramme suit le bloc `chart`. Pour
  « quel diagramme correspond à ce tableau ? », un `table`, puis des `chart` titrés
  « Diagramme A », « Diagramme B »…, puis un QCM sur ces titres.

### Arbres de probabilités

Un arbre des possibles ou un arbre pondéré est un bloc `tree` (ADR 0040). On donne les branches,
niveau par niveau ; le renderer place les nœuds, les probabilités et les issues.

```json
{ "id": "arbre-urne", "type": "tree", "outcomes": true, "products": true,
  "highlightPath": ["R", "B"],
  "root": { "children": [
    { "label": "R", "probability": "3/5", "children": [
      { "label": "R", "probability": "2/4" }, { "label": "B", "probability": "2/4" } ] },
    { "label": "B", "probability": "2/5", "children": [
      { "label": "R", "probability": "3/4" }, { "label": "B", "probability": "1/4" } ] } ] },
  "alt": "Deux tirages sans remise dans une urne de 3 boules rouges et 2 bleues." }
```

- Sans `probability`, c'est un arbre des possibles (5e). Une probabilité s'écrit `3/5` (dessinée
  en vraie fraction, jamais simplifiée), `0,4` (virgule), `25 %`, `?` (case à compléter) ou une
  formule entre `$` (`$p$`, `$1-p$`). `label` accepte `$\overline{A}$`.
- Au plus 3 niveaux, 6 branches par nœud, 12 issues. Les probabilités de branches sœurs toutes
  chiffrées font **exactement 1** (check-content calcule en fractions).
- `outcomes: true` écrit les issues, `(R ; B)` ; une feuille peut donner la sienne avec `outcome`
  (`$A \cap B$`). `products: true` écrit leur probabilité : à éviter dans un exercice, elle
  donnerait la réponse.
- `highlightPath` (les noms du chemin, de la racine à une feuille) colore un chemin : la règle
  du produit.
- Horizontal par défaut ; `orientation: "vertical"` pour un petit arbre. Sur téléphone, tout
  arbre est dessiné horizontalement.

### Simulateur de probabilités

Le bloc `simulateur-probabilites` permet à l’élève de répéter une expérience et de comparer
les fréquences observées aux probabilités théoriques. Choisis l’expérience de départ avec
`experiment` (`coin` pour une pièce équilibrée, `die` pour un dé à six faces, `urn` pour une
urne de trois boules rouges et deux bleues avec remise). La `consigne` peut contenir du texte
enrichi. Les résultats restent dans le simulateur ouvert par l’élève.

```json
{ "id": "frequences-urne", "type": "simulateur-probabilites", "experiment": "urn",
  "consigne": "Compare les fréquences après **100**, puis **1 000** tirages." }
```

### Solides à faire tourner

Un solide que l'élève fait tourner (glisser, flèches du clavier) est un bloc `solid`, pas une
`figure` (ADR 0039). On donne la sorte et les dimensions ; le renderer calcule les arêtes
cachées (en pointillés), les sections et les repères de la sphère. La vue de départ est celle du
manuel (de face, un peu par la droite et par-dessus) ; c'est elle que décrit `alt`.

Recette — un cône coupé par un plan parallèle à sa base :

```json
{ "id": "solide-cone", "type": "solid", "kind": "cone", "radius": 2, "height": 4.5,
  "names": ["O", "S"], "section": { "parallelTo": "base", "at": 1.5 },
  "alt": "Un cône de sommet S et de base le disque de centre O, coupé par un plan parallèle à sa base." }
```

- `kind` : `pave` (`width`, `height`, `depth`), `cube` (`edge`), `prisme` (`base` = face avant en
  vraie grandeur, `depth`), `cylindre` (`radius`, `height`), `pyramide` (`base` vue de dessus,
  `height`, `apex` facultatif = pied de la hauteur, par défaut le centre de la base), `cone`
  (`radius`, `height`), `boule` (`radius`).
- `names` : les sommets dans l'ordre de `figure.solids` (face avant puis face arrière ; base
  puis sommet pour une pyramide) ; les centres des bases d'un cylindre ; le centre de la base
  puis le sommet d'un cône ; le centre d'une boule. Nommer les centres trace l'axe en pointillés.
- `section` : `parallelTo` vaut `base` (par défaut), `front` ou `side` (pavé, cube), `axis`
  (cylindre) ; `at` est la distance à cette face ou à l'axe, strictement à l'intérieur. Pour une
  boule, pas de `parallelTo` : `at` est la distance du centre au plan, parallèle à l'équateur.
- Boule seulement : `equator`, `parallels` (latitudes), `meridians` (longitudes) et `points`
  (`name`, `latitude`, `longitude`), en degrés, nord et est positifs ; la longitude 0 est face à
  l'élève.
- Ce dessin n'est **pas** en perspective cavalière (la face avant n'est pas en vraie grandeur) :
  pour enseigner la cavalière, garder `figure.solids` et le dire dans le texte.
- Un exercice qui demande de faire tourner le solide suit le bloc et dit quel geste faire.

### Programmes Scratch

Un programme Scratch est un bloc `code` en `"language": "scratch"` (ADR 0031). Il s'écrit en
texte ; le renderer le dessine en blocs colorés, et `pnpm check:content` refuse un programme
qui ne s'analyse pas, ligne par ligne.

```json
{ "id": "code-programme-calcul", "type": "code", "language": "scratch",
  "code": "quand le drapeau vert est cliqué\ndemander « Choisis un nombre » et attendre\nmettre x à (réponse)\nmettre résultat à ((x * 3) + 4)\ndire (résultat)" }
```

- **Une instruction par ligne**, dans la formulation française de Scratch :

  | Ligne | Bloc |
  |---|---|
  | `quand le drapeau vert est cliqué` | chapeau, première ligne seulement |
  | `demander « … » et attendre` | capteurs |
  | `mettre x à …` / `ajouter … à x` | variables |
  | `dire …` | apparence |
  | `avancer de … pas` / `tourner à droite de … degrés` (ou `à gauche`) | mouvement |
  | `répéter … fois` … `fin` | contrôle |
  | `si <booléen> alors` … `fin` | contrôle |
  | `si <booléen> alors` … `sinon` … `fin` | contrôle |
  | `répéter jusqu'à ce que <booléen>` … `fin` | contrôle |
  | `stylo en position d'écriture` / `relever le stylo` / `effacer tout` | stylo |

- **Une valeur** est un nombre (`3`, `2,5`, `-1`), un texte entre « », une variable (`x`, ou
  `(x)`), `réponse`, ou une opération **entre parenthèses** : `(x * 3)`. Une parenthèse par
  opération, comme les blocs emboîtés : `((x * 3) + 4)`, jamais `(x * 3 + 4)`.
- **Un booléen** (hexagone, pour une condition) est une **comparaison** `(x > 10)`, `(n = 0)`
  avec `<`, `=` ou `>`, un **« et »/« ou »** de deux booléens : `((x > 0) et (x < 10))`, ou un
  **« non »** d'un booléen : `(non (x = 0))`. Une parenthèse par opérateur, comme les valeurs —
  aucune priorité. En position d'opérateur, `et`/`ou` sont toujours l'opérateur logique et
  exigent deux booléens (`(x et y)` est une erreur) ; `non` l'est quand une parenthèse le suit ;
  en opérande, ce sont des noms de variables. La condition d'un `si` ou d'un `répéter jusqu'à ce
  que` **doit** être un booléen, jamais un nombre ; et un booléen ne peut pas occuper une place
  de valeur (`dire (a < b)` est refusé : Scratch l'accepte, mais Brio s'en tient aux conditions).
- **Scratch n'a ni ≤, ni ≥, ni ≠** : écrire `((x < 3) ou (x = 3))` ou `(non (x = 3))` (le
  parseur le rappelle si on tape `≤`, `<=`, `≠` ou `!=`).
- **Le sens des blocs, comme dans Scratch** (piège pour un exercice « prévoir la valeur ») :
  - `répéter jusqu'à ce que` teste la condition **avant** chaque tour : si elle est vraie dès le
    départ, le corps ne s'exécute pas (contrairement au « Répéter … Jusqu'à » de l'algorithmique
    papier, qui teste après) ;
  - `=` ne distingue pas majuscules et minuscules : `(« Oui » = « oui »)` est vrai ;
  - dans un programme, **préférer les entiers** : Brio écrit les décimaux avec une virgule, mais
    pour Scratch `2,5` n'est pas un nombre — il vaut 0 dans un calcul (`(x * 2,5)` donne 0) et
    devient du texte dans une comparaison (avec x = 10, `(x > 2,5)` est faux). Un élève qui
    recopie le programme dans Scratch obtiendrait un autre résultat.
- **Le vrai signe de Scratch** : `*` et `/`, pas × ni ÷ (refusés). Le `code` n'est pas du texte
  riche, l'étoile n'y ouvre pas d'italique.
- **Les blocs en C** (`répéter … fois`, `si … alors`, `répéter jusqu'à ce que …`) : le corps est
  décalé de **4 espaces** (pas de tabulation) et fermé par `fin` à la hauteur du bloc. `sinon`
  (aligné sur son `si`) ouvre la seconde branche d'un `si`. Un corps vide est refusé.
- Pas de ligne vide. Les noms de variables n'ont pas d'espace (`résultat`, `nb_pas`).
- **Hors catalogue** : tout autre bloc (p. ex. `répéter indéfiniment`, attendre, messages, autres
  blocs stylo) — garder un bloc `code` en `"language": "text"` jusqu'à ce que l'ADR 0031 l'ajoute.
- Les apostrophes droite ' et typographique ’ sont acceptées dans `répéter jusqu'à ce que` et
  `stylo en position d'écriture`. Pas plus de 32 niveaux de parenthèses ou de blocs imbriqués.
- Un énoncé ou une option de QCM est du texte riche : un programme y reste écrit en texte, avec ×.
  Un exercice sur un programme suit le bloc `code`.
- **« Prévoir la valeur » vérifié par la CI** (#232) : un exercice `numeric` (ou un QCM dont la
  seule bonne réponse est un nombre) peut se relier au programme qu'il interroge avec un champ
  `program`. `check:content` exécute alors le programme et refuse l'exercice si ce que dit le
  lutin (le dernier `dire`) ne correspond pas à la réponse attendue — une erreur de calcul dans
  le contenu devient une erreur de CI. Les `si … sinon`, `répéter jusqu'à ce que` et comparaisons
  s'exécutent comme dans Scratch (voir « Le sens des blocs » ci-dessus) ; une boucle qui ne
  s'arrête jamais, ou un `demander` sans valeur dans `inputs`, est aussi une erreur de CI.
  Dans un programme relié :
  - le dernier `dire` doit être **un nombre** (un texte, une `réponse` vide ne valent pas 0) ;
  - les décimaux s'écrivent avec **un point** (`2.5`), dans le code comme dans `inputs` :
    Scratch lit « 2,5 » comme du texte ;
  - chaque valeur de `inputs` sert à un `demander`, et elle **redit l'énoncé** (« l'utilisateur
    tape 5 ») : elle part chez l'élève, ce n'est jamais un corrigé caché ;
  - chaque variable est **mise à une valeur avant d'être lue** (`mettre n à 0`) : Scratch garde
    les variables d'un clic sur le drapeau à l'autre, la CI repart de 0 ;
  - le nombre de tours d'un `répéter` est entier (Scratch arrondirait) ;
  - un résultat décimal peut s'afficher avec un bruit d'arrondi dans Scratch
    (`0.1 + 0.2` → 0.30000000000000004) : préférer des calculs entiers ;
  - aucune mauvaise option d'un QCM ne vaut la valeur calculée.

  ```json
  { "id": "ex-prevoir-cinq", "type": "exercise", "exerciseType": "numeric",
    "prompt": "L'utilisateur tape 5. Quel nombre dit le lutin ?", "answer": 19,
    "program": { "ref": "code-programme-calcul", "inputs": ["5"] } }
  ```

  `ref` = l'`id` d'un bloc `code` Scratch **n'importe où dans le chapitre** (il peut être dans une
  section précédente : « le programme du début »). `inputs` (optionnel) alimente les `demander`
  dans l'ordre. Les programmes de **mouvement** (`avancer`/`tourner`) ne disent rien : ils ne se
  relient pas à un exercice (une distance parcourue n'est pas ce que dit le lutin).

### Formules

**Bloc `formula`** pour les formules posées sur leur propre ligne (théorème, définition,
résultat isolé) : `display: "block"` (défaut). `display: "inline"` est candidat à la
dépréciation depuis l'introduction du math inline ; évite-le.

**Math inline dans la prose** : utilise `$...$` directement dans un champ `richText`
(`prose.text`, `callout.text`, `callout.title`). Exemple : `"Si $a^2 + b^2 = c^2$, alors..."`.
Ne jamais utiliser `\(...\)` — seul `$...$` est supporté.

Si la notation est assez simple pour s'écrire en ASCII (`3,15 < 3,9`, `a + b`), préfère
la prose sans balisage : un `$a + b$` inline pour une expression simple est du bruit.

**Balisage inline disponible dans les champs `richText` :**

| Syntaxe | Rendu |
|---|---|
| `**mot**` | gras |
| `*mot*` | italique |
| `$...$` | formule KaTeX inline |
| `\*` | astérisque littéral |
| `\$` | dollar littéral |

Un délimiteur non fermé (`**gras`, `$formule`) s'affiche tel quel, délimiteur compris —
c'est une erreur visible plutôt qu'une perte silencieuse. `pnpm check:content`
détecte ces cas avant le commit.

### Couleurs signifiantes (ADR 0037)

Une couleur dit qu'**un même objet** apparaît à deux endroits : le côté [AB] du triangle et le
$AB^2$ de l'égalité, le terme $ka$ de la figure d'aires et celui du développement. Elle ne sert
jamais à décorer ni à signaler un état (juste, faux, important) : l'encre reste le défaut.

- **Dans une formule** (`formula.latex`, `$...$` d'un `richText`, `steps[].formula`) :
  `\tone{n}{…}`, `n` de 1 à 4. Exemple : `"\\tone{3}{BC}^2 = \\tone{1}{AB}^2 + \\tone{2}{AC}^2"`.
  Colore l'objet (`\tone{1}{AB}^2`), pas son exposant ni le signe qui le précède.
- **Dans une figure** : `"tone": n` sur un point (point et nom), un segment, un polygone, un
  cercle, un arc, une marque d'angle ou une étiquette. Un polygone teinté peut prendre
  `"fill": "soft"` (fond doux sous son trait) ; pour garder des contours à l'encre, redessine le
  contour par-dessus avec un polygone sans teinte.
- **Même numéro, même objet**, dans tout le chapitre. Commence par 1 et 2 (bleu et orange, le
  couple que les élèves daltoniens distinguent le mieux).
- **Au plus trois teintes par bloc** : au-delà, `pnpm check:content` avertit. Une teinte hors
  1…4 est une erreur. Une teinte présente dans une figure et dans aucune formule est permise.
- La couleur n'est jamais le seul indice : l'objet reste nommé (lettre, nombre) aux deux endroits.

### Callouts

Utiliser les variantes dans leur sens exact :

| Variante | Emploi |
|---|---|
| `definition` | Énoncé d'une définition ou d'un terme |
| `example` | Exemple travaillé, avec une valeur numérique ou une situation concrète |
| `tip` | Méthode ou astuce de calcul |
| `warning` | Erreur fréquente à éviter |
| `note` | Complément non essentiel à la compréhension de base |

### Difficulté

- `introduction` : premier contact, une seule compétence, données numériques simples.
- `standard` : exercice typique d'une interrogation de cours.
- `approfondissement` : combinaison de compétences ou situation non vue en cours. Ne pas
  dépasser 1 ou 2 par chapitre à ce niveau en 6e.

### Volume minimum d'exercices

Par compétence ciblée : **au moins 3 exercices au total** dans le chapitre (inline + section
finale). Cette règle garantit que la progression peut estimer une maîtrise à partir d'un
nombre suffisant d'actes.

### IDs de nœuds

- Kebab-case, sans accents, stables.
- Les IDs des choices dans un QCM : préfixe `choix-` + quelques mots de la réponse.
- Les IDs des blocs : préfixe de leur rôle (`intro-`, `def-`, `exemple-`, `tip-`, `ex-`).

---

## Checklist de relecture avant `draft → published`

Vérifications à faire à la main, dans le navigateur et via l'API :

### Schéma et scripts

- [ ] `npx ajv-cli@5 validate --spec=draft2020 -s docs/schema/course-content.schema.json -d "<chemin-du-fichier>.json"` passe.
- [ ] `node scripts/check-competencies.mjs` passe.
- [ ] `pnpm check:content` passe (délimiteurs richText équilibrés).

### Ingestion

- [ ] Premier passage : statut `CREATED`.
- [ ] Second passage sans modification : statut `SKIPPED`.
- [ ] Modification d'un champ (titre, texte d'un exercice) + troisième passage : statut `UPDATED`,
  UUIDs des exercices inchangés.

### Navigateur — rendu

- [ ] La page du chapitre s'ouvre sans erreur.
- [ ] Chaque section et son titre s'affichent.
- [ ] Les callouts ont le bon style selon leur variante.
- [ ] Aucun bloc n'affiche une erreur de rendu ou une valeur brute JSON.
- [ ] À COMPLÉTER APRÈS RELECTURE NAVIGATEUR — ce qui s'est affiché de façon inattendue (blocs manquants, mise en forme incorrecte, texte tronqué).

### Navigateur — exercices

- [ ] Chaque exercice `multiple-choice` : soumettre la bonne réponse → retour correct.
- [ ] Chaque exercice `multiple-choice` : soumettre chaque mauvaise réponse → retour incorrect.
- [ ] Chaque exercice `numeric` : soumettre la valeur exacte → retour correct.
- [ ] Chaque exercice `numeric` : soumettre une valeur hors tolérance → retour incorrect.
- [ ] Chaque exercice `short-answer` : soumettre une réponse acceptée → retour correct.
- [ ] Chaque exercice `short-answer` : soumettre une réponse incorrecte → retour incorrect + explication visible.
- [ ] Chaque exercice `short-answer` : le bouton « Vérifier » est désactivé tant que le champ est vide.
- [ ] La réponse de l'API ne contient aucun de ces champs : `answer`, `acceptedAnswers`,
  `referenceAnswer`, `rubric`, `correct`.
- [ ] À COMPLÉTER APRÈS RELECTURE NAVIGATEUR — exercices qui ont nécessité une correction (numérotation, tolérance, libellé).

### Contenu

- [ ] Chaque réponse numérique est vérifiée à la main.
- [ ] Chaque distracteur de QCM correspond à une conception erronée réelle (justifiable en une phrase).
- [ ] Le `explanation` de chaque exercice démonter l'erreur, pas seulement donner la bonne réponse.
- [ ] À COMPLÉTER APRÈS RELECTURE NAVIGATEUR — difficultés rencontrées par des élèves fictifs testés ou remarques sur la formulation des questions.

---

## Ce que ce premier chapitre a rendu visible

*Section à compléter après la relecture navigateur.*

À COMPLÉTER APRÈS RELECTURE NAVIGATEUR — noter ici ce que le schéma, le rendu ou le pipeline
ont rendu difficile : un type de bloc manquant, une formulation d'exercice que le format numeric
ne pouvait pas capturer proprement, une erreur de schéma qui n'était pas évidente à corriger.
Ces notes alimentent les issues suivantes.
