# Référentiel de compétences

Structured competency referential, one file per subject
(`mathematiques-college.json`). Normative schema:
[`docs/schema/competency.schema.json`](../../docs/schema/competency.schema.json).
Decisions: [ADR 0008](../../docs/adr/0008-content-as-code.md) (content-as-code),
[ADR 0009](../../docs/adr/0009-competency-code-format.md) (code format,
granularity, freeze policy).

Every competency an exercise references **must** exist here. This is enforced
twice: `scripts/check-competencies.mjs` (run locally / in CI) and at ingestion
(a chapter with an unknown code is rejected).

## Adding a code

1. Find the right cycle, domain and theme; reuse an existing theme if one fits.
2. Follow the grammar `c{cycle}.{domaine}.{theme}.{capacite}` — domain
   abbreviations: `num`, `geo`, `gm`, `ogd`, `algo` (ADR 0009). The `capacite`
   segment starts with a verb (`calculer`, `reconnaitre`, …).
3. Ground the entry: `intitule` phrased as an observable capability,
   `referenceOfficielle` citing the BOEN programme and/or the attendus de fin
   d'année that justify it. No entry without an official source.
4. `niveaux` stays within collège: cycle 3 entries are `["6e"]` only, cycle 4
   entries use `5e`/`4e`/`3e`.
5. Run `node scripts/check-competencies.mjs` and open a PR. **Every referential
   change gets line-by-line human review before merge** — this file is the
   ground truth for all content and, later, per-competency progression.

## Freezing (never deleting) a code

A merged code is engraved: chapters and student submissions reference it
durably. Never rename, delete, or reuse one. If an entry is wrong or the
official programme changes, add the replacement code and mark the old entry
deprecated (a `deprecated` flag will be added to the schema when first needed —
ADR 0009). A typo in a code is fixed the same way: new code, old one
deprecated.
