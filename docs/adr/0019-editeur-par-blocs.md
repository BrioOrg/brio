# 0019 — Éditeur de cours par blocs : une structure, jamais un style

- **Status**: Accepted
- **Date**: 2026-09-22
- **Deciders**: Pierce (architecture), Gabrielle (direction produit/design)

## Context

F3 (éditeur de cours enseignant) est le différenciateur produit : un enseignant
compose son propre cours et le résultat doit être **indiscernable, en qualité de
rendu, d'un chapitre du catalogue**. C'est l'inverse d'un éditeur de texte riche —
si chaque enseignant choisit ses couleurs et ses polices, la plateforme perd sa
tenue et le lint de tokens (design) n'a plus rien à garantir.

Le contenu existe déjà sous une forme exploitable : un schéma JSON versionné
(`course-content.schema.json`, ADR 0004), un référentiel de compétences (ADR 0009),
une ingestion idempotente depuis Git (ADR 0008/0010) et un moteur de rendu unique
(`ChapitreContentApi` → `<ChapterView/>`). Le tuteur (ADR 0015) et les exercices
consomment ce même contenu. La question de F3 n'est donc pas « comment ajouter un
éditeur » mais « **où vit le contenu d'un enseignant, et comment reste-t-il la même
chose que le catalogue** ».

Ce cours est utilisé par des mineurs : aucune donnée fabriquée, aucun transfert
vers un tiers avant consentement, et les champs de correction ne doivent jamais
atteindre un client élève.

## Decision

### 1. Un schéma, un moteur de rendu, deux origines

Le contenu d'enseignant réutilise **le même** `course-content.schema.json` et **le
même** moteur de rendu que le catalogue. Seule l'origine diffère :

```
                 course-content.schema.json (additif)
                            │
          ┌─────────────────┴─────────────────┐
   origine = catalogue                  origine = enseignant
   source : Git /content                source : contenu.cours_versions
   ingestion idempotente (ADR 0010)     écriture applicative, versionnée
          └─────────────────┬─────────────────┘
                            ▼
              ChapitreContentApi → <ChapterView/>
            (tuteur, exercices, figures : inchangés)
```

Conséquence : rien de neuf côté rendu, tuteur ou évaluateurs. Un cours d'enseignant
est un document du même schéma, servi par le même port.

### 2. Blocs v2, strictement additifs

Quatre blocs s'ajoutent au schéma **sans bumper `schemaVersion`** (l'union est
ouverte : un type inconnu retombe sur `unknownBlock`, donc l'ajout n'est pas une
migration). Les blocs existants restent disponibles à l'enseignant.

| Bloc | Rôle | Champs clés |
|---|---|---|
| `reference` | Citation d'une ressource, interne ou externe | `scope` (`internal`/`external`), `title`, `url` (https, si externe) **ou** `target {level, subject, slug, anchor?}` (si interne), `source?`, `consultedOn?` |
| `table` | Tableau de données (numérique, de variation, de conversion) | `headers?`, `rows[][]`, `caption?` |
| `steps` | Méthode en étapes numérotées | `title?`, `steps[] {text, formula?}` |
| `objectives` | Objectifs adossés au référentiel | `title?`, `competencies[]` (grammaire ADR 0009) |

Le bloc `reference` réutilise le composant `CitationChip` déjà écrit pour le tuteur :
la citation d'un enseignant et celle du tuteur se ressemblent parce que ce sont la
même chose. En `internal`, la cible est validée à la publication (un lien cassé
bloque la publication, comme un code de compétence inconnu) ; en `external`, l'URL
est en `https` et s'ouvre dans un nouvel onglet.

**Identifiants en anglais.** Les noms de blocs et de champs sont des identifiants,
donc en anglais, comme tout le schéma existant (`prose`, `heading`, `formula`…) et
comme l'exige `.claude/CLAUDE.md`. Le CDC §8.2 emploie des libellés français
(`objectifs`, `entetes`, `étapes`) comme raccourci de rédaction ; nous conservons la
convention anglaise du schéma (`objectives`, `headers`, `steps`). La copie
utilisateur reste française, produite au rendu.

### 3. Modèle de données (tranche ultérieure)

```
contenu.cours          (id, auteur_id, etablissement_id, titre, niveau_code,
                        matiere_code, statut[brouillon|publie|archive],
                        version_publiee, created_at, updated_at)
contenu.cours_versions (cours_id, version, content JSONB, publie_at,
                        PRIMARY KEY (cours_id, version))          -- immuables
contenu.cours_portees  (cours_id, classe_id)                      -- qui y a accès
contenu.assets         (id, proprietaire_id, mime, taille, sha256,
                        cle_stockage, created_at)
```

Les **versions publiées sont immuables**. Un devoir (F4) référencera
`(cours_id, version)` : corriger une coquille après avoir donné le devoir ne doit
pas changer le sujet sous les pieds des élèves qui l'ont commencé — le pendant exact
de la préservation des UUID d'exercices (ADR 0010).

**Exercices d'un cours d'enseignant** : pas de seconde table. Rendre
`contenu.exercices.chapitre_id` nullable, ajouter `cours_version` nullable, et une
contrainte `CHECK` exigeant **exactement l'un des deux**. Changement additif : les
soumissions et les évaluateurs continuent sans savoir d'où vient l'exercice.

### 4. Brouillon → publication, et garanties

- `Enregistrer` écrit un brouillon ; `Publier` fige une version immuable et la rend
  visible aux classes portées.
- **Validation à la publication** : schéma JSON, existence des cibles internes des
  blocs `reference`, existence des codes de compétence, présence d'un `alt` sur
  chaque `image`/`figure`.
- **Champs de correction** (`answer`, `tolerance`, `acceptedAnswers`,
  `referenceAnswer`, `rubric`) : saisis dans l'éditeur, **jamais** envoyés à un
  client élève. La garantie structurelle s'applique au contenu d'enseignant sans une
  ligne de plus (§5.3 de la feuille de route).
- **Structure, jamais style** : aucun champ de couleur, police, taille ou
  alignement dans le schéma — il n'y a rien à saisir, donc rien à surveiller.

### 5. Pas d'embed tiers en v1

Pas de bloc `video`/iframe YouTube : une iframe dépose des cookies tiers et transfère
l'IP d'un mineur hors UE avant tout consentement. Un `reference` externe fait 90 %
du travail pour 0 % du problème. Vidéo auto-hébergée (PeerTube/fichier) : son propre
ADR si le besoin devient réel.

## Consequences

### Positive
- Le contenu d'enseignant hérite gratuitement du rendu, du tuteur, des évaluateurs
  et de l'accessibilité du catalogue.
- L'ajout de blocs est non-cassant : le contenu existant reste valide, aucun bump de
  `schemaVersion`, aucune migration de documents.
- Les invariants « mineurs » (pas de style libre, pas d'embed tiers, correction
  jamais exposée) sont portés par le schéma et le pipeline, pas par la discipline de
  l'auteur.

### Negative / trade-offs
- L'enseignant ne peut pas « tout faire » comme dans un traitement de texte — c'est
  volontaire, mais demandera de la pédagogie produit.
- L'immutabilité des versions publiées impose une table de versions et une logique
  de portée : plus de tables, plus de rigueur qu'un simple `UPDATE`.

### Follow-ups
- Migration `contenu.cours` / `cours_versions` / `cours_portees` / `assets` +
  `exercices.chapitre_id` nullable + `cours_version` + `CHECK` (tranche suivante).
- Endpoints brouillon/publication + validation à la publication.
- Servir les cours d'enseignant via `ChapitreContentApi` (deux origines, un moteur).
- Éditeur web (colonne d'édition + aperçu `<ChapterView/>`, palette de blocs,
  clavier maths, formulaires d'exercices, écran « Publier »).
- **Précision ADR 0010** : la ré-ingestion ne purge que l'origine `catalogue`
  (ajoutée dans ce même lot).
- **Dette pré-existante à résorber** : `course-content.schema.json` existe en deux
  copies maintenues à la main (`docs/schema/` canonique, ADR 0008 ; et
  `backend/src/main/resources/contenu/` chargée à l'exécution par
  `ContentSchemaValidator`). Elles ont divergé (le bloc `figure` d'ADR 0013 manque
  côté backend). Ce lot met les deux à jour pour les blocs v2, mais la copie backend
  devrait être **générée** depuis la source canonique (comme `competency.schema.json`
  l'est déjà via `maven-resources-plugin`) pour supprimer la divergence. Ticket
  dédié.

## Alternatives considered

- **Éditeur WYSIWYG / HTML libre / Markdown** — rejeté : détruit la tenue commune,
  rouvre la porte au style libre et rend le lint de tokens impuissant. C'est
  précisément ce que ce modèle évite.
- **Table d'exercices séparée pour les cours d'enseignant** — rejeté : dupliquerait
  soumissions et évaluateurs. Le `CHECK` sur une colonne nullable est additif et
  suffisant.
- **Stocker le contenu d'enseignant dans Git comme le catalogue** — rejeté :
  l'écriture applicative versionnée en base convient à une action utilisateur ; Git
  reste la source du seul catalogue éditorial.
- **Bumper `schemaVersion` pour les nouveaux blocs** — rejeté : l'union ouverte rend
  l'ajout additif ; bumper forcerait une migration inutile de tout le contenu.
