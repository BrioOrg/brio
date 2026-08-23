# 0009 — Competency referential: code format, granularity, freeze policy

- **Status**: Accepted
- **Date**: 2026-08-19
- **Deciders**: Pierce

## Context

ADR 0004 deliberately left `competencies` as opaque free strings and deferred
the "controlled curriculum taxonomy". That debt is now due: exercises reference
skills that nothing validates, so nothing guarantees content stays within the
official programme. The referential defined here becomes the target for AI
authoring, the unit of the future `progression` module, and a value engraved in
every chapter file and every submission — its identifiers must therefore be
readable, stable, and never recycled.

The official source is public and legally reusable (programmes published in the
BOEN, attendus de fin d'année — Licence Ouverte / CRPA regime, with source
attribution).

## Decision

We will identify each competency with a **hierarchical kebab-case code of
exactly four dot-separated segments**:

```
c{cycle}.{domaine}.{theme}.{capacite}
e.g. c4.geo.pythagore.calculer
```

- **Segment 1 — cycle**: `c3` or `c4`. Scope is collège only: cycle 3 entries
  cover its 6e slice (never CM1/CM2), cycle 4 covers 5e/4e/3e.
- **Segment 2 — domaine**: a fixed abbreviation of the official programme
  domains: `num` (nombres et calculs), `geo` (espace et géométrie), `gm`
  (grandeurs et mesures), `ogd` (organisation et gestion de données, fonctions),
  `algo` (algorithmique et programmation).
- **Segment 3 — theme**: an editorial grouping inside the domain
  (e.g. `pythagore`, `fractions`, `proportionnalite`).
- **Segment 4 — capacite**: the observable capability, verb-first
  (e.g. `calculer`, `reconnaitre-hypotenuse`, `resoudre-probleme`).

Segments are lowercase `a-z0-9` with `-` inside a segment; no accents. The
normative grammar lives in `docs/schema/competency.schema.json`.

**Granularity** is the sub-competency: fine enough that an exercise can target
it precisely (a capability, not a whole attendu de fin d'année). Each entry
carries its `intitule`, `cycle`, `niveaux`, `domaine`, a
`referenceOfficielle` pointing at the BOEN programme and/or attendus, and a
`programme` field (see below).

**Freeze policy — codes are engraved**: once merged, a code is immutable. It is
never renamed, never deleted, never reused for a different meaning. If a
competency was wrong or the programme changes, the code is marked deprecated in
the referential (and excluded from authoring) but remains resolvable forever,
because chapters and submissions reference it durably. Fixing a typo in a code
therefore means deprecating the old code and adding a new one.

**Programme field** — every non-deprecated entry carries a `programme` field in
the format `cycle{N}-{YYYY}` (e.g. `cycle3-2025`, `cycle4-2020`) identifying
the official programme text that grounds it. Invariant enforced by
`check-competencies.mjs`: for any given niveau, all non-deprecated entries must
share the same `programme` value. This makes it impossible to accidentally author
content mixing two programme generations for the same level.

**Deprecation mechanism** — three optional fields handle the lifecycle of a code
when the official programme changes:

| Field | Semantics |
|---|---|
| `deprecatedSince` | BO reference of the superseding text; present = deprecated |
| `remplacePar` | Codes of successors. Absent = mapping not established; `[]` = no successor in new programme; non-empty = explicit successors |
| `programme` | Identifies the programme the entry belonged to (cycle3-2020, cycle4-2020, …) |

Deprecated codes remain in the JSON and the database forever (freeze policy),
but `check-competencies.mjs` fails if any content file references one, and
`ChapitreIngestionTx` rejects chapters referencing deprecated codes at ingestion
time.

**Two-programme reality (cycle 3, 2025)** — the Arrêté du 10 avril 2025 (BO
n°16 du 17 avril 2025) replaced the 2020 cycle-3 programme. The referential now
holds both generations simultaneously: 57 deprecated cycle3-2020 entries and 59
active cycle3-2025 entries. This is the expected steady state during any
curriculum transition. The per-niveau programme invariant prevents content from
mixing them.

The 2025 cycle-3 programme reorganised several themes relative to 2020:
algebra (`algebre`) is now explicit in 6e, probabilités appear in 6e,
angles moved from `gm` to `geo`, and solides/patrons/masses were removed from
6e. New codes therefore live under `c3.num.algebre.*`, `c3.geo.angles.*`,
`c3.ogd.probabilites.*` etc.; the old `c3.gm.*` angle entries are deprecated.

## Consequences

### Positive
- Codes are self-describing in diffs, logs and URLs; review needs no lookup.
- The hierarchy gives cheap grouping (all `c4.geo.*`) without a join.
- Mechanical validation at two stages (CI script, ingestion) can guarantee "no
  content references a skill outside the official curriculum".
- Traceability entry-by-entry to a public, legally reusable source.

### Negative / trade-offs
- Hierarchy in the identifier means a competency moved between themes needs a
  new code (accepted: the freeze policy requires that anyway).
- Fine granularity makes the referential large (~200 entries for collège maths)
  and its initial line-by-line review costly — paid once.
- French domain abbreviations are opaque to non-French speakers; acceptable,
  the whole product is French.

### Follow-ups
- `content/referentiel/mathematiques-college.json` — first dataset; 2025 cycle-3
  slice implemented in issue #28.
- `scripts/check-competencies.mjs` + `contenu.competences` projection.
- V7 migration adds `deprecated_since` / `remplace_par` columns (issue #28).
- The `progression` module will aggregate mastery per code (E8).

## Alternatives considered

- **Flat free tags** (status quo) — rejected: unverifiable, the exact problem.
- **Verbatim Eduscol breakdown** — rejected: attendus are prose paragraphs, too
  coarse to target from an exercise and unusable as identifiers; we keep them as
  the *reference* of entries instead.
- **Opaque numeric codes + labels** (e.g. `MC-0412`) — rejected: unreadable in
  diffs and content files; the readable hierarchy is the review affordance.
- **Codes without cycle prefix** — rejected: the same capability exists in both
  cycles at different depths (spiral curriculum); the cycle prefix keeps those
  distinct and the code stable.
