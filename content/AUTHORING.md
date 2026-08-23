# Brio content authoring guide

Version 1 — extracted from the authoring of `nombres-decimaux-comparer-ranger` (issue #29).
Update this file when a new chapter reveals a better rule or breaks an existing one.

---

## Three rules that apply to every chapter

### 1. Compétences : les exercices, jamais la prose

Les compétences d'un chapitre sont celles que ses **exercices** évaluent — pas celles que
son cours mentionne. Ne pas mettre de tag `competencies` sur la prose, même si elle traite
une notion. Si tu veux mesurer une compétence, écris un exercice qui l'évalue explicitement.

**Pourquoi** : le module `progression` agrège la maîtrise par code. Un tag sur de la prose
produirait une "maîtrise" sans acte de l'élève — un bruit qui noierait le signal.

### 2. QCM pour les erreurs diagnostiques, numérique pour les réponses produites

- **`multiple-choice`** quand les mauvaises réponses peuvent incarner des conceptions erronées
  documentées. Chaque distracteur doit répondre à : *pourquoi un élève choisirait-il cette
  option ?* Si tu ne peux pas répondre en une phrase, c'est un remplissage — remplace-le.
  Le champ `explanation` doit démonter le piège spécifique de chaque option fausse.

- **`numeric`** quand la réponse se produit : la borne inférieure d'un encadrement, un arrondi,
  une longueur calculée. La borne supérieure ou la conclusion triviale ne méritent pas un
  exercice séparé.

- **`short-answer`**, **`free-text`**, **`ordering`** ne sont pas encore utilisables (pas
  d'évaluateur ou de rendu) — ne pas les introduire.

### 3. Aucun agent ne publie

`status: "draft"` reste dans le fichier jusqu'à ce qu'un humain ait : ingéré, ouvert la page,
soumis chaque exercice juste et faux, vérifié que la réponse de l'API ne contient aucun champ
sensible (`answer`, `acceptedAnswers`, `referenceAnswer`, `rubric`, `correct`). Le basculement
`draft → published` est un acte d'attestation, pas un paramètre technique.

---

## Entrées à donner au modèle pour écrire un chapitre

1. **Les codes de compétences ciblés** — uniquement ceux que les exercices évalueront. Copier
   les `intitule` correspondants depuis `content/referentiel/mathematiques-college.json`.

2. **Les types d'exercices disponibles** — aujourd'hui : `multiple-choice` et `numeric`.
   Rappeler au modèle que les autres types existent dans le schéma mais ne renderont pas.

3. **Les contraintes de rendu actives** :
   - Pas d'images ni de figures.
   - Blocs `formula` au strict minimum : pas de KaTeX installé, le bloc s'affiche tel quel.
   - Toute notation mathématique simple s'écrit en prose : `3,15 < 3,9`, `a < x < b`.

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
