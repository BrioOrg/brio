# 0011 — Content navigation: semantic URL triplet and catalog endpoint

- **Status**: Accepted
- **Date**: 2026-08-20
- **Deciders**: Pierce
- **Amended**: 2026-10-08 (#218) — §1: the slug is unique across the whole catalogue; the
  planned `UNIQUE(niveau_code, matiere_code, id)` never replaced the `id` primary key

## Context

The existing `GET /api/chapitres/{id}` endpoint addresses chapters with an opaque slug and
gives no natural hierarchy. As the content catalog grows (multiple grade levels × subjects ×
chapters), the frontend has no discovery mechanism: every chapter URL must be known in advance.
Navigation — grade level → subject → chapter list — requires both a hierarchical API and
semantic, self-describing URLs that encode their own location.

## Decision

1. **Triplet URL scheme**: chapters are canonically addressed as
   `GET /api/chapitres/{niveau}/{matiere}/{slug}`. The `slug` is the chapter's existing `id`
   field value; no separate column is added. The slug is **unique across the whole catalogue**
   (every niveau and matière, annales included): `id` stays the primary key of
   `contenu.chapitres`, and the triplet locates a chapter, it does not identify it.
   `scripts/check-content.mjs` rejects two content files with the same `id`, and ingestion
   rejects (FAILED) a chapter whose `id` already belongs to another niveau or matière.

2. **Reference tables**: `contenu.niveaux` and `contenu.matieres` are static reference tables
   seeded in the V5 Flyway migration (not populated by ingestion). Ingestion validates that a
   chapter's `level` and `subject` fields are present in these tables, rejecting unknown values
   at the application boundary before any write occurs.

3. **Catalog endpoint**: `GET /api/catalogue` returns the complete navigation tree — a list of
   niveaux (ordered by their declared ordre), each containing a list of matieres, each containing
   a list of published chapters (slug, titre, estimated duration, order). Assessment data is never
   included.

4. **308 permanent redirect**: `GET /api/chapitres/{id}` issues a 308 to the canonical triplet
   URL, enabling existing consumers to migrate at their own pace.

5. **`statut` column**: chapters carry a `statut` VARCHAR column with values `published` or
   `draft`. The catalog returns only `published` chapters. All ingested chapters receive
   `published` as their initial status.

6. **`_index.json` ordering manifest**: a file
   `content/chapitres/{niveau}/{matiere}/_index.json` — a JSON array of slugs in display order —
   controls the `ordre` column. The seeder reads it to determine ingestion order and sets `ordre`
   to the zero-based position in the array.

## Consequences

### Positive
- URLs are self-describing and encode hierarchy; they are stable once the slug is set (slugs are
  editorial commitments like competency codes).
- The catalog API makes navigation a single backend call.
- The 308 preserves backward compatibility for existing API consumers.
- Ingestion validated against reference tables prevents phantom grade levels from entering the DB.

### Negative / trade-offs
- Two niveaux cannot share a slug: a 5e chapter on a topic already covered in 6e needs a slug
  naming what is specific to it (`probabilites-equiprobabilite`, not `probabilites`). Before the
  #218 amendment, a duplicate silently overwrote the other niveau's chapter and retired its
  exercises.
- Renaming a chapter requires a content-file rename, a new slug, and a new 308 — same cost as
  competency code retirement (accepted: rare, deliberate editorial action).
- Adding a new subject requires a new migration to extend `contenu.matieres` (acceptable at
  current scale; revisit if subjects are user-managed).

## Alternatives considered

- **Flat catalog with client-side grouping** — rejected: grouping logic belongs in the backend,
  and a flat list contains no hierarchy labels.
- **Dynamic reference tables populated by ingestion** — rejected: unclear who creates the first
  entry; a migration-seeded table is the authoritative single source for valid values.
- **No 308 redirect** — rejected: existing integration tests and any client that cached the old
  URL would break silently.
- **Composite key `UNIQUE(niveau_code, matiere_code, id)`** (this ADR's original wording) —
  rejected in #218: `exercices.chapitre_id`, `annales.chapitre_id`, progression and social all
  reference a chapter by `id` alone, and the §4 redirect maps one `id` to one triplet. Migrating
  every reference costs far more than asking authors for distinct slugs.
- **Separate `slug` column alongside `id`** — rejected: `id` IS the slug; a duplicate column
  adds no information and risks divergence.
