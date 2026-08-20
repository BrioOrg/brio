# 0010 — Idempotent content ingestion: natural keys, UUID preservation, content hash

- **Status**: Accepted
- **Date**: 2026-08-20
- **Deciders**: Pierce

## Context

ADR 0008 established Git as the editorial source of truth and PostgreSQL as a re-derivable
projection. That goal requires a concrete guarantee: two consecutive runs of the ingestion command
on the same repository state must produce identical database state. The current seeder (as of ADR
0008) is not idempotent — it skips chapters already present but never updates them, does not
preserve exercise UUIDs across re-ingestions, and does not retire exercises removed from the source
files. Submissions referencing an exercise UUID are orphaned if the UUID changes.

## Decision

### 1. Single ingestion service — `ChapitreIngestor`

A single `ChapitreIngestor` component (in `fr.brio.contenu.infrastructure`) owns all ingestion
logic. It is called by two distinct runners:

- **`IngestCommand`** (`@Profile("ingest")`) — the CLI command `ingest <dir>`, exits non-zero with
  a per-chapter report on any failure.
- **`LocalContentSeeder`** (`@Profile("local")`) — fires on startup for local dev convenience,
  logs errors and carries on without affecting the process exit code.

Having two ingestion implementations diverge silently is worse than a missing feature; therefore a
single implementation is mandatory.

The competency referential (`ReferentielIngestor`) remains a separate `ApplicationRunner` with
`@Order(1)`, always active across all profiles. It populates the referential before any chapter is
ingested.

### 2. Content hash — canonical JSON + ingestion version

The `content_hash` column on `contenu.chapitres` stores `SHA-256(canonical_json +
INGEST_VERSION)` where:

- `canonical_json` is the serialisation of the source `JsonNode` with alphabetically sorted keys
  and no whitespace (produced by an `ObjectMapper` configured with
  `SORT_PROPERTIES_ALPHABETICALLY` and `ORDER_MAP_ENTRIES_BY_KEYS`).
- `INGEST_VERSION` is a hardcoded integer constant in `ChapitreIngestor`.

Rationale for canonical JSON over raw file bytes: content files are reformatted automatically by
the editor hook; hashing raw bytes would therefore trigger spurious re-ingestions on every
whitespace-only change.

**INGEST_VERSION bump contract**: whenever the extraction or transformation logic changes (e.g.,
a new sensitive field is stripped, or a new column is derived from the document), increment
`INGEST_VERSION`. All chapters will be re-ingested on the next run, picking up the updated
projection. Failing to bump the constant leaves existing chapters with a stale projection that is
never corrected.

Skip condition: if a chapter's stored `content_hash` equals the computed hash, the chapter and
its exercises are left untouched and the result is `SKIPPED`. This check happens before any
validation or database write.

### 3. Exercise UUID preservation by natural key `(chapitre_id, slug)`

Exercises are identified by `(chapitre_id, slug)`, enforced by `UNIQUE(chapitre_id, slug)`. When
a chapter is re-ingested (hash changed), the ingestor looks up existing exercises by this natural
key and reuses their UUIDs. Only exercises absent from the database receive a newly generated UUID.

This preserves foreign key integrity for `soumissions` referencing `exercice_id`: a submission
survives a content update to its chapter without becoming an orphan.

### 4. `retired_at` for removed exercises

When a chapter is updated and an exercise slug that was previously active is no longer present in
the source document, the ingestor sets `retired_at = now()` on the corresponding row in
`contenu.exercices`. Rows are never deleted. `retired_at IS NULL` means the exercise is active.

Existing submissions to a retired exercise remain in place; the exercise evaluation data is still
present for grading purposes.

### 5. `status` as an editorial field

Chapter status (`published` / `draft`) is an optional field in the source JSON file. Ingestion
always applies the value from the file; absent means `published`. No preservation logic: the
database is a projection and editorial decisions belong in Git.

A `CHECK(statut IN ('published', 'draft'))` constraint is added in V6 to enforce the value set.

## Consequences

### Positive
- Two consecutive runs on the same content produce identical state — the rebuild guarantee holds.
- Submissions survive content updates because exercise UUIDs are stable.
- Retired exercises are auditable: `retired_at` records when a chapter removed an exercise.
- The hash mechanism makes re-ingestion cheap: unchanged chapters are skipped in O(1).
- Status is auditable via Git history rather than a database field with an unclear write path.

### Negative / trade-offs
- Bumping `INGEST_VERSION` triggers a full re-ingestion of all chapters; this is intentional and
  safe, but takes linear time in the number of chapters.
- Canonical JSON computation adds a small per-chapter overhead (negligible for current scale).
- Authors cannot set a chapter to `draft` without touching the file; no UI override path exists
  until a teacher editor is built (at which point it will edit the file via a PR — the same model
  already planned in ADR 0008).

## Alternatives considered

- **Hash raw file bytes** — rejected: the editor hook reformats files on save, making raw-byte
  hashes unstable across cosmetic whitespace changes.
- **No hash; always upsert** — rejected: unnecessary database writes on every ingest run, and
  harder to reason about idempotency.
- **Hard-delete retired exercises** — rejected: orphans existing submissions. Soft deletion via
  `retired_at` is safer and reversible.
- **Two ingestion implementations (seeder + CLI)** — rejected: divergence between the two
  implementations would surface as silent bugs where one path works and the other does not.
