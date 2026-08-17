# 0004 — Structured JSON schema for course content

- **Status**: Accepted
- **Date**: 2026-08-17
- **Deciders**: Pierce

> Supersedes the original decision-only version of this ADR (2026-08-16), which
> recorded *that* we would use structured JSON but left the schema undesigned.
> This revision defines the actual schema. Full alternatives analysis:
> [`docs/schema/DESIGN.md`](../schema/DESIGN.md).

## Context

Teacher-authored courses and exercises are the core content of brio. This content
must render consistently across web and mobile, chunk cleanly for
curriculum-grounded AI tutoring (RAG) with each chunk traceable to its source for
citation, be machine-checkable for exercises with AI correction, be validated at
authoring time, and — because it is written by humans — stay readable. Free-form
HTML or Markdown blobs are hard to validate, query, and segment reliably for these
uses.

ADR 0004 previously committed to "structured, versioned JSON" without a schema.
Everything downstream (the `contenu` module, RAG chunking, the authoring editor,
web and mobile rendering) depends on that schema, so it is designed here.

## Decision

We represent a chapter of course content as a **structured, versioned JSON tree**,
normatively defined by [`docs/schema/course-content.schema.json`](../schema/course-content.schema.json)
(JSON Schema draft 2020-12). A hand-written, valid example lives at
[`docs/schema/examples/pythagore-3e.json`](../schema/examples/pythagore-3e.json).

**Shape.** A chapter has a `schemaVersion`, a stable readable `id`, metadata
(`title`, `subject`, `level`, `difficulty`, `estimatedDurationMinutes`), and an
ordered list of **sections**. Each section has an `id`, a `title`, a `kind`
(`lesson` | `exercises`), and an ordered stream of **blocks**.

**Block types.** `prose`, `heading`, `formula` (LaTeX), `image` (opaque asset
reference + required `alt`), `callout`, `code`, and `exercise`. Because `exercise`
is a block type, an exercise can appear inline in a lesson *or* fill a dedicated
`exercises` section — both use the same exercise shape.

**Exercise types.** `multiple-choice`, `short-answer`, `numeric` (with absolute
`tolerance`), `free-text` (reference answer + rubric to ground AI correction), and
`ordering` (items stored in correct order). Each exercise carries opaque
`competencies` string references, plus optional `difficulty` and
`estimatedDurationMinutes`. Per-type fields are enforced with `if/then`.

**IDs and citation.** Every node has an author-assigned, readable, stable slug id
unique within the chapter. The block is the RAG chunk unit; the
`(chapterId, sectionId, blockId)` path is the citation key and survives edits to
other blocks.

**Versioning and extensibility.** The block/exercise union is **open**: unknown
`type` values validate against a permissive fallback requiring only an `id` and a
string `type`. Adding a block or exercise type is therefore additive — existing
content stays valid and `schemaVersion` does **not** change. `schemaVersion` (an
integer, currently `1`) is bumped only for genuinely breaking structural changes.

**Single language.** French only for now; no locale field. Localisation is an
additive future extension (see the design doc).

## Consequences

### Positive
- Deterministic rendering across web and mobile from one canonical typed tree.
- Block-level chunks with stable ids give precise, editable-safe RAG citation.
- Authoring-time validation (zod on web, JSON Schema / Bean Validation on backend)
  catches malformed content before publish, against a single normative charter.
- New block/exercise types ship without migrating existing content.

### Negative / trade-offs
- The authoring UI must produce valid structured content, not a rich-text box.
- The open union means `exercise` blocks do not close `additionalProperties`, so a
  misspelled field on a known exercise type is not caught by the schema alone; the
  editor and application-level validators are the backstop.
- Breaking structural changes still require a `schemaVersion` bump and migration.

### Follow-ups
- Mirror the JSON Schema as zod in the web boundary and wire backend validation in
  the `contenu` module (issue #2 onward — implementation is out of scope here).
- Define the embedding/chunking job that emits one row per block with its
  `(chapterId, sectionId, blockId)` path into pgvector.
- Define the controlled competency taxonomy that opaque `competencies` will
  reference.

## Alternatives considered

Full analysis with examples and per-constraint scoring in
[`docs/schema/DESIGN.md`](../schema/DESIGN.md).

- **Flat block stream** (structure via marker nodes in one array) — rejected:
  section ownership is implicit, hurting RAG citation and validatability, and deep
  content becomes an unreadable flat list.
- **Strict nested tree with a separate `exercises` collection per section** —
  rejected: cannot express inline exercises without either dropping them or
  duplicating the exercise model across two arrays, and cross-array ordering is
  ambiguous.
- **Nested tree with `exercise` as a block type** — **chosen**: explicit,
  citation-friendly nesting plus inline exercises with a single exercise model.
- **Markdown / HTML blobs** — rejected (original ADR): weak validation, unreliable
  RAG chunking, no structured hooks for machine-checkable exercises.
- **Headless CMS** — deferred (original ADR): external dependency; revisit if
  authoring needs outgrow an in-app editor.
