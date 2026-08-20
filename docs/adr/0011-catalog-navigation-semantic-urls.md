# 0011 — Content navigation: semantic URL triplet and catalog endpoint

- **Status**: Accepted
- **Date**: 2026-08-20
- **Deciders**: Pierce

## Context

The existing `GET /api/chapitres/{id}` endpoint addresses chapters with an opaque slug and
gives no natural hierarchy. As the content catalog grows (multiple grade levels × subjects ×
chapters), the frontend has no discovery mechanism: every chapter URL must be known in advance.
Navigation — grade level → subject → chapter list — requires both a hierarchical API and
semantic, self-describing URLs that encode their own location.

## Decision

1. **Triplet URL scheme**: chapters are canonically addressed as
   `GET /api/chapitres/{niveau}/{matiere}/{slug}`. The `slug` is the chapter's existing `id`
   field value; no separate column is added. The unique constraint becomes
   `UNIQUE(niveau_code, matiere_code, id)` on `contenu.chapitres`.

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
- **Separate `slug` column alongside `id`** — rejected: `id` IS the slug; a duplicate column
  adds no information and risks divergence.
