# 0006 — Content persistence: hybrid jsonb and relational

- **Status**: Accepted
- **Date**: 2026-08-18
- **Deciders**: Pierce

## Context

ADR 0004 defined the course content schema as a structured JSON tree. This ADR
decides how that tree is stored in PostgreSQL and what the `contenu` module's
persistence layer looks like.

Two concerns pulled in different directions:

1. **Chapter as a document.** A chapter is authored as a unit, edited as a unit,
   and served as a unit. Decomposing it into normalised rows (one per block) would
   mean reconstructing the document on every read with a multi-join query, and
   every schema change to the block model would be a migration rather than a JSON
   field add.

2. **Exercises as addressable entities.** The `exercices` module needs to look up a
   single exercise by a stable ID — without loading and traversing an entire chapter.
   Submissions need a foreign key to something stable. Correct answers must never
   be adjacent to content served to clients; a separate table makes leaking them a
   deliberate act rather than a mapping omission.

## Decision

**Hybrid: document storage for chapter content, relational for exercises.**

### `contenu.chapitres`

The chapter document is stored as a single `jsonb` column. The content written to
this column is the chapter as authored, with one modification: each `exercise`
block is reduced to its statement-only fields (`id`, `type`, `exerciseType`,
`prompt`, `competencies`, `difficulty`, `estimatedDurationMinutes`, `explanation`).
Type-specific evaluation fields (`choices[].correct`, `answer`, `tolerance`,
`acceptedAnswers`, `referenceAnswer`, `rubric`, etc.) are stripped at ingestion
and never stored here.

This means the `GET /api/chapitres/{id}` endpoint can serve the stored `jsonb`
directly; there is nothing sensitive to filter at query time. Leaking an answer
would require a deliberate code change.

### `contenu.exercices`

Each `exercise` block extracted from a chapter becomes a row:

| Column | Type | Purpose |
|---|---|---|
| `id` | `UUID` (PK) | Stable cross-module reference. The `exercices` module holds foreign keys to this. |
| `chapitre_id` | `VARCHAR` (FK) | The owning chapter's slug id. |
| `slug` | `VARCHAR` | The block's authored `id` slug. Unique within a chapter. |
| `type` | `VARCHAR` | The `exerciseType` value (`multiple-choice`, `numeric`, etc.). |
| `evaluation` | `jsonb` | Type-specific evaluation data only (e.g. choices with `correct` flags, numeric `answer` and `tolerance`). |
| `competencies` | `TEXT[]` | The exercise's competency references, denormalised for the progression module. |

The unique constraint `(chapitre_id, slug)` preserves the human-readable slug for
re-seeding and debugging while the UUID is what crosses the module boundary.

### No RAG chunk storage

Block-level pgvector embeddings are not stored here. The chunking and embedding
strategy belongs to the `ia` module (issue to be filed). Chunks can be derived
from the chapter `jsonb` when that module is built; no pre-computed chunk rows
are committed to now.

## Consequences

### Positive
- Chapter reads are a single row fetch; no JOIN reassembly.
- Correct answers are structurally isolated from client-facing content.
- Exercises are stable, foreign-key-able entities; the `exercices` module does
  not parse chapter documents.
- Adding new block types or exercise statement fields requires no migration —
  the `jsonb` absorbs them.
- Evaluation data changes (e.g. adding an explanation field to the evaluation
  payload) are also migration-free as long as the column type stays `jsonb`.

### Negative / trade-offs
- Querying individual blocks within a chapter requires PostgreSQL jsonb operators
  or a full document load in Java. Acceptable until the need is real.
- Correct answers are stored in `evaluation` as plaintext jsonb, not encrypted.
  Access control is at the API layer (the column is never joined into
  client-facing queries). Encryption at rest is a future operational concern.
- The chapter and exercise rows can drift if a chapter is updated without
  re-extracting exercises; ingestion must always be atomic.

## Alternatives considered

**Fully relational (one row per block).** Rejected: multi-join reads on every
chapter fetch, and every new block field is a migration. The document structure
is already defined by the JSON Schema; duplicating it in DDL creates two sources
of truth.

**Fully jsonb (exercises inside the chapter document).** Rejected: the `exercices`
module would need to load and traverse a whole chapter to look up one exercise,
the submission FK target would be a string path into a document rather than a
stable UUID, and correct answers would live in the same document as content
served to clients — requiring a filter pass on every GET.
