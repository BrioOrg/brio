# 0008 — Content-as-code: Git is the editorial source of truth

- **Status**: Accepted
- **Date**: 2026-08-19
- **Deciders**: Pierce

## Context

Brio's content today lives in two half-connected places: hand-written JSON files
under `docs/schema/examples/` and a copy in backend resources ingested by a
local-only seeder. There is no defined answer to "where is the truth?" — if the
database row and the file diverge, nothing says which one wins. As content grows
(a full collège maths referential, then dozens of chapters), we need an
industrial pipeline: authoring, review, validation, and deployment of content
with the same rigour as code.

The forces: content is written by a human-reviewed AI workflow and must be
reviewable as readable diffs; every claim must be traceable to the official
curriculum; the database schema will evolve and content must survive those
evolutions; there is no budget for hosted tooling.

## Decision

We will treat content as code: **the Git repository is the editorial source of
truth, under `/content` at the monorepo root, and PostgreSQL is a re-derivable
projection of it.** It must always be possible to empty the `contenu` schema's
content tables and rebuild them entirely by re-ingesting `/content`.

Concretely:

- One JSON file per chapter (`content/chapitres/<niveau>/<matiere>/<slug>.json`)
  and the competency referential in `content/referentiel/` — both validated by
  the JSON Schemas in `docs/schema/`.
- Human review of content **is** a GitHub PR: the diff is the review artifact,
  Git history is the editorial history.
- Mechanical validation (schema conformance, competency codes, later
  mathematical checks) runs as scripts, wired into CI when a CI pipeline exists.
- The backend never owns content: it ingests it. Editing content directly in the
  database, or storing content-derived state that cannot be re-derived from the
  files, is not allowed.
- Files needed by the backend at runtime (referential, schemas) are copied from
  their canonical location into the build by Maven at build time — never
  committed twice.

## Consequences

### Positive
- One unambiguous source of truth; the database can always be rebuilt.
- Editorial review inherits the whole Git/PR toolchain (diffs, blame, revert).
- Breaking schema changes become codemods on files plus full re-ingestion,
  instead of live data migrations (see ADR 0004 on `schemaVersion`).
- Zero hosting cost and no external dependency for authoring.

### Negative / trade-offs
- Authors need Git (acceptable: the author is the maintainer for now; a teacher
  UI later becomes *a client of the same pipeline*, not a second write path).
- Ingestion must become idempotent and preserve stable identifiers across
  re-ingestions — this is real engineering work (follow-up ADR).
- Repository size grows with content; acceptable for JSON text.

### Follow-ups
- ADR 0009: competency code format (the first `/content` dataset).
- ADR on idempotent ingestion (natural keys, UUID preservation, content hash) —
  required before "rebuild the world" is safe with live submissions.
- CI job "blank database → migrations → full re-ingestion" once CI exists.

## Alternatives considered

- **Headless CMS (Strapi, Payload)** — rejected: moves the source of truth into
  an opaque database, costs hosting, and its generic editor cannot validate our
  domain JSON Schema.
- **Database as source of truth with Git export** — rejected: the export is
  always second-class and drifts; review would happen after the fact.
- **Separate content repository** — rejected for now: schemas, validation
  scripts and content would version independently and skew; the monorepo keeps
  schema + content + validators atomic. Revisit if external contributors need
  content-only access.
