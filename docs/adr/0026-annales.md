# 0026 — Annales (F7) : outillage

- **Status**: Accepted
- **Date**: 2026-09-29
- **Deciders**: Gabrielle Clamaran

## Context

F7 : les sujets d'examen (brevet…) deviennent du contenu de catalogue — même git,
même ingestion, même schéma que les chapitres. Deux usages visés : **entraînement
ciblé par compétence** et **sujet complet en mode examen** (chronométré, tuteur
coupé). Le **contenu** (les sujets eux-mêmes) est rédigé à part, avec soin juridique
(on réécrit les énoncés, on ne recopie jamais un corrigé d'éditeur, on cite la
session officielle) — hors de cet ADR, qui ne couvre que **l'outillage**.

## Decision

### 1. Une annale = un « chapitre spécialisé » (Option A)

Un sujet vit dans `content/annales/<niveau>/<matiere>/<slug>.json` et est **ingéré
comme un chapitre** : même JSON Schema, même `ExerciceExtractor`, mêmes
`competencies`, même préservation des UUID, même endpoint de lecture par triplet,
même tuteur. On **ne touche pas** au cœur d'ingestion (extracteur, `ExtractionOwner`,
le CHECK `chk_exercices_origine` des exercices).

Les métadonnées d'annale vivent dans un **`_meta.json` par annale** (le schéma de
contenu reste inchangé) et une table :

```
contenu.annales (
  chapitre_id     VARCHAR(128) PK REFERENCES contenu.chapitres(id),
  examen          TEXT NOT NULL,     -- ex. 'brevet'
  session         TEXT NOT NULL,     -- ex. 'juin'
  annee           INT NOT NULL,
  centre          TEXT,              -- ex. 'Métropole'
  matiere_code    VARCHAR(64) NOT NULL,
  niveau_code     VARCHAR(8) NOT NULL,
  duree_minutes   INT,
  licence         TEXT,
  source_url      TEXT
)
```

### 2. Ingestion additive

Un `AnnaleIngestor` scanne `content/annales/`, ingère chaque sujet via le **même
chemin transactionnel** que les chapitres, puis upsert la ligne `annales`. Il est
appelé **à côté** de l'ingestion des chapitres (dans `IngestCommand` et
`LocalContentSeeder`), sans modifier `ChapitreIngestor` ni `ExerciceExtractor`.

### 3. Exclusion du catalogue

`GET /api/catalogue` exclut les chapitres qui sont des annales (id présent dans
`annales`), pour ne pas les mélanger aux cours.

### 4. Entraînement par compétence

Nouvelle requête `exercices WHERE :code = ANY(competencies) AND retired_at IS NULL`
restreinte aux chapitres-annales, exposée par `GET /api/annales/entrainement?competence=…`.
La soumission et la correction réutilisent le flux `exercices` **inchangé** (les
exercices d'annale sont des exercices ordinaires).

### 5. Lister / lire

`GET /api/annales` (+ filtres niveau / matière / année) ; **lire un sujet** = l'endpoint
chapitre par triplet existant (une annale *est* un chapitre).

### 6. Mode examen — différé

Sujet chronométré + tuteur coupé + correction différée = **tranche suivante**, qui
réutilise le mode contrôle (ADR 0025 : une requête « en examen ? » + la garde dans le
tuteur).

## Consequences

### Positive
- Réutilise tout le pipeline (schéma, extraction, compétences, tuteur, lecture) — **zéro
  impact sur le cœur d'ingestion** partagé avec le catalogue et les cours prof.
- L'entraînement par compétence et la correction automatique sont quasi gratuits.

### Negative / trade-offs
- La table `chapitres` contient désormais cours **et** annales, distingués par la table
  `annales` (et le filtre du catalogue).

### Follow-ups
- Mode examen (chronomètre + coupure tuteur + correction différée), réutilisant ADR 0025.
- Rédaction des sujets (manuelle, avec soin juridique) — hors outillage.

## Alternatives considered

- **Option B — table `annales` + 3ᵉ origine d'exercice** (`annale_id` sur `exercices`,
  extension du CHECK XOR, nouvel `ExtractionOwner`) — rejetée : touche le cœur sensible
  de l'ingestion (partagé catalogue/cours) pour un gain sémantique faible.
- **Métadonnées dans le JSON Schema de contenu** — rejetée : on garde le schéma de
  contenu inchangé ; les métadonnées vont dans un `_meta.json`.
