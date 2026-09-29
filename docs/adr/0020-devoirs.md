# 0020 — Devoirs et rendus

- **Status**: Accepted
- **Date**: 2026-09-29
- **Deciders**: Gabrielle Clamaran

## Context

F4 introduces homework ("devoirs"): a teacher assigns work to a class with dates
and follows who has done it. The `devoirs` module is empty today. F4 depends on
F3 (the course editor and published courses), which is done.

Two forces shape the scope:

- **Minors / no school-management creep.** Brio is used by collège/lycée students
  and is not a school-management system: no Pronote export, no weighted averages,
  no attendance, no timetable. A "devoir" is a pedagogical assignment, nothing more.
- **A deliberately small v1.** v1 is the *devoir maison* only. The student **does
  the exercises inside the app**; the "rendu" is derived from those submissions —
  there is no file upload. Photographing a paper copy is a separate later chantier
  (F5).

## Decision

### 1. A separate `devoirs` module

A new module `devoirs` with its own Postgres schema `devoirs`. Per ADR 0007 there is
**no cross-schema FK**: it references `identite` (classes, comptes), `contenu`
(cours/chapitres, référentiel) and `exercices` (exercices, soumissions) **by id**,
and reacts to their application events. `ModularityTests` must stay green, with no
added exception.

### 2. Schema

```
devoirs.devoirs (
  id                     UUID PRIMARY KEY,
  classe_id              UUID NOT NULL,        -- identite.classes (id)
  auteur_id              UUID NOT NULL,        -- identite.comptes (enseignant)
  titre                  TEXT NOT NULL,
  consigne               TEXT,
  type                   VARCHAR(20) NOT NULL
    CHECK (type IN ('devoir_maison')),         -- enum left open: 'entrainement' | 'controle' later
  source_type            VARCHAR(10) NOT NULL
    CHECK (source_type IN ('cours', 'chapitre')),
  source_ref             TEXT NOT NULL,        -- course id / chapter slug
  source_version         INT,                  -- frozen version for a teacher course
  exercice_refs          UUID[] NOT NULL,      -- selected exercises (exercices ids)
  ouvre_at               TIMESTAMPTZ NOT NULL,
  echeance_at            TIMESTAMPTZ NOT NULL,
  correction_visible_at  TIMESTAMPTZ NOT NULL, -- = echeance_at in v1
  statut                 VARCHAR(15) NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'publie')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
)

devoirs.rendus (
  id          UUID PRIMARY KEY,
  devoir_id   UUID NOT NULL REFERENCES devoirs.devoirs,
  eleve_id    UUID NOT NULL,                   -- identite.comptes (élève)
  statut      VARCHAR(15) NOT NULL DEFAULT 'non_commence'
    CHECK (statut IN ('non_commence', 'en_cours', 'rendu')),
  score       NUMERIC,                         -- derived from submissions
  rendu_at    TIMESTAMPTZ,
  UNIQUE (devoir_id, eleve_id)
)
```

No `devoirs.rendu_pieces` table in v1: there is no paper-copy upload (F5).

### 3. The rendu is derived from exercise submissions

A student "does" a devoir by answering its exercises in the app. `devoirs` does not
store the answers — those live in `exercices`. A `devoirs.rendus` row tracks, per
`(devoir, élève)`, a **statut** and a **derived score**, updated on submission
events from `exercices`:

- **`non_commence`** — no submission yet for any of the devoir's exercises.
- **`en_cours`** — at least one exercise submitted, not all.
- **`rendu`** — all of the devoir's exercises submitted.

`score` is the aggregate auto-correction result over the devoir's exercises. There
is no manually-entered teacher grade in v1.

### 4. Deferred correction visibility

Results and the corrigé are shown to the student only after `correction_visible_at`
(equal to `echeance_at` for a devoir maison). This gate is reused later by the
exam/control mode (F7).

### 5. Teacher dashboard

Per devoir: who has done it (statut per élève) and success **per compétence** — the
per-compétence figures join the devoir's exercises to the competency référentiel
(`contenu`), aggregated over submissions, all cross-module by id/events.

### 6. Explicitly out of v1

- **Control mode** (`type = 'controle'`) that cuts the tutor server-side for its
  duration.
- **Annales** in exam mode.
- **Paper-copy upload** and teacher correction of a scan (F5).

The tutor stays available during a devoir maison.

## Consequences

### Positive
- Closes the "ma classe / mon cours / mes devoirs" loop.
- Reuses `exercices` (correction) and the référentiel (per-compétence view) — no
  duplicate evaluation logic.
- `correction_visible_at` is the same mechanism the exam/control mode will need —
  built once, used twice.
- No new personal data of minors beyond an id link (no uploads in v1) — keeps F4
  out of the heavier GDPR surface of F5.

### Negative / trade-offs
- The derived rendu means statut/score are computed by aggregating `exercices`
  submissions rather than owned by `devoirs` — an extra projection, and a dependency
  on submission events being delivered.
- No manual teacher grade or appreciation in v1 (auto-correction only).
- `exercice_refs` snapshots the chosen exercises; if the source changes later the
  devoir keeps its frozen set (intended — must be tested).

### Follow-ups
- Flyway migration for the `devoirs` schema.
- Endpoints: create a devoir (teacher), list a class's devoirs (teacher + student),
  devoir detail, dashboard (per-student + per-compétence aggregates), student
  status/results.
- Web: the three screens (create, dashboard, "mes devoirs").
- A later ADR for control/exam mode (tutor cutoff) and for F5 (paper-copy upload).

## Alternatives considered

- **Extend `exercices` or `contenu`** instead of a new module — rejected: it mixes
  assignment/scheduling concerns with content and correction, and would blur the
  Modulith boundaries (ADR 0007).
- **Store submissions inside `devoirs`** (own answer tables) — rejected: duplicates
  the `exercices` submission/evaluation path; the derived rendu keeps a single
  source of truth for answers.
- **Paper-copy upload in v1** — deferred to F5: object storage in the EU, EXIF
  stripping, signed URLs and retention are their own decision (and their own GDPR
  weight).
- **An `origine` column / denormalised status** — rejected: status is derivable
  from submissions; deriving avoids drift.
