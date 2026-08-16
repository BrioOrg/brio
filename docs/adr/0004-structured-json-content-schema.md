# 0004 — Structured JSON schema for course content

- **Status**: Accepted
- **Date**: 2026-08-16
- **Deciders**: Pierce

## Context

Teacher-authored courses and exercises are the core content of brio. This content
must be: rendered consistently across web and mobile, chunked and embedded for
curriculum-grounded AI tutoring (RAG), machine-checkable for exercises with AI
correction, and validated at authoring time. Free-form HTML or Markdown blobs
are hard to validate, query, and segment reliably for these uses.

## Decision

We will represent course and exercise content as a **structured, versioned JSON
schema** — a typed tree of content blocks (e.g. text, media, question,
activity), each with stable IDs and explicit metadata — rather than opaque
markup. The schema is validated on write (zod on the web, Bean Validation / JSON
Schema on the backend) and is the canonical form stored and served.

## Consequences

### Positive
- Deterministic rendering across clients from one canonical structure.
- Clean chunking of blocks for embeddings/RAG; stable IDs link tutor and
  exercise references back to precise curriculum locations.
- Authoring-time validation catches malformed content before publish.
- Schema versioning enables safe migration as the model evolves.

### Negative / trade-offs
- Authoring UI must produce valid structured content (not a plain rich-text box).
- Schema changes require versioning and migration discipline.
- More upfront modelling than "just store Markdown".

### Follow-ups
- Author the initial content-block schema and a versioning strategy in a
  dedicated design doc/ADR.
- Define the embedding/chunking mapping from blocks to pgvector rows.

## Alternatives considered

- **Markdown / HTML blobs** — rejected: weak validation, unreliable chunking for
  RAG, and no structured hooks for machine-checkable exercises.
- **Headless CMS** — deferred: adds an external dependency; revisit if authoring
  needs outgrow an in-app editor.
