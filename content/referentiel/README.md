# Référentiel de compétences

Structured competency referential, one file per subject
(`mathematiques-college.json`). Normative schema:
[`docs/schema/competency.schema.json`](../../docs/schema/competency.schema.json).
Decisions: [ADR 0008](../../docs/adr/0008-content-as-code.md) (content-as-code),
[ADR 0009](../../docs/adr/0009-competency-code-format.md) (code format,
granularity, freeze policy, deprecation, programme field).

Every competency an exercise references **must** exist here and be non-deprecated.
This is enforced twice: `scripts/check-competencies.mjs` (run locally / in CI)
and at ingestion (a chapter referencing an unknown or deprecated code is rejected).

## The `programme` field

Every non-deprecated entry carries a `programme` field: `cycle{N}-{YYYY}` (e.g.
`cycle3-2025`, `cycle4-2020`). It names the official programme text that grounds
the entry. `check-competencies.mjs` enforces the invariant: for any given niveau,
all non-deprecated entries must share one `programme` value. This prevents content
from accidentally mixing entries from two programme generations.

## Current state (mathematiques-college.json)

| Set | Count | `programme` |
|---|---|---|
| Cycle-3, 2020 programme (deprecated) | 57 | `cycle3-2020` |
| Cycle-3, 2025 programme (active, Arrêté du 10 avril 2025) | 59 | `cycle3-2025` |
| Cycle-4, 2020 programme, 5e-only entries (deprecated) | 6 | `cycle4-2020` |
| Cycle-4, 2020 programme (active, 4e and 3e only) | 83 | `cycle4-2020` |
| Cycle-4, 2026 programme (active, 5e; Arrêté du 18 février 2026) | 71 | `cycle4-2026` |

The 2025 cycle-3 entries were authored from the arrêté annex (BO n°16 du 17
avril 2025, Licence Ouverte). The éduscol mise-en-œuvre document was used solely
to resolve ambiguities and is not included in the repo (© Ministère).

The 2026 cycle-4 entries were authored from annexe 2 of the arrêté du 18 février
2026 (BO n°10 du 5 mars 2026, Licence Ouverte), section « Cinquième » of each
domain. The ~110 objectifs d'apprentissage are grouped into observable
capabilities; the « automatismes » get no code (they revisit earlier years).
The programme's « Proportionnalité, fonctions » domain is filed under `ogd`, and
volumes, areas and unit conversions under `gm`, so the five domains are unchanged.

### Programme transition (cycle 4, 2026 → 2028)

The 2026 programme reaches one level per year: 5e in 2026-2027, 4e in
2027-2028, 3e in 2028-2029. When a level switches, remove it from the `niveaux`
of every `cycle4-2020` entry, deprecate the entries left with no level, and add
the level to the `cycle4-2026` entries that continue (or add new ones). See
ADR 0009, « Staggered rollout ».

## Adding a code

1. Find the right cycle, domain and theme; reuse an existing theme if one fits.
2. Follow the grammar `c{cycle}.{domaine}.{theme}.{capacite}` — domain
   abbreviations: `num`, `geo`, `gm`, `ogd`, `algo` (ADR 0009). The `capacite`
   segment starts with a verb (`calculer`, `reconnaitre`, …).
3. Ground the entry: `intitule` phrased as an observable capability,
   `referenceOfficielle` citing the BOEN programme that justifies it. No entry
   without an official source.
4. Set `programme` to `cycle{N}-{YYYY}` matching the programme text cited.
4. `niveaux` stays within collège: cycle 3 entries are `["6e"]` only, cycle 4
   entries use `5e`/`4e`/`3e`.
5. Run `node scripts/check-competencies.mjs` and open a PR. **Every referential
   change gets line-by-line human review before merge** — this file is the
   ground truth for all content and, later, per-competency progression.

## Deprecating a code

A merged code is engraved: chapters and student submissions reference it
durably. Never rename, delete, or reuse one. When an entry is superseded:

1. Add `"deprecatedSince"` with the BO reference of the superseding text.
2. Add `"remplacePar"` with the list of successor codes, or `[]` if the
   competency has no successor in the new programme. Leave the field absent if
   the mapping is not yet established.
3. The `programme` field stays as-is, identifying which programme the entry
   belonged to.
4. Add the replacement code(s) as new entries with the new `programme` value.
5. Run `node scripts/check-competencies.mjs`. It will report how many codes are
   active vs. deprecated and fail if any content file references a deprecated code.

A typo in a code is fixed the same way: new code, old one deprecated.
