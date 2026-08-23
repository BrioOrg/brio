# Course content schema — design

Design study for the structured JSON that represents a chapter of teacher-authored
course content in brio. This is the write-up behind [ADR 0004](../adr/0004-structured-json-content-schema.md);
the decision and the normative summary live there, the alternatives and reasoning
live here.

- **Normative schema**: [`course-content.schema.json`](./course-content.schema.json) (JSON Schema draft 2020-12)
- **Worked example**: [`examples/pythagore-3e.json`](./examples/pythagore-3e.json)

## Requirements

From issue #2, the schema must cover a chapter → sections → content blocks tree,
with block types (prose, heading, formula, image, callout, code), exercise types
(multiple choice, short answer, numeric with tolerance, free text, ordering),
competency tags, difficulty, estimated duration, and a schema version field.

It must satisfy five constraints, which are the axes every alternative below is
judged on:

1. **Cross-platform render** — same source renders identically on web (React) and
   mobile (Expo).
2. **RAG-chunkable** — chunks cleanly for retrieval, each chunk traceable back to
   its chapter and section for citation.
3. **Validatable** — checkable against a charter at authoring time.
4. **Extensible** — adding a new exercise type must not require migrating existing
   content.
5. **Human-readable** — authored by humans, so the on-disk format must stay legible.

## Decisions taken as given

These were settled with the issue author before designing and are fixed inputs,
not alternatives:

- **Competencies are opaque string references** (`competencies: string[]`). A
  controlled curriculum taxonomy is a separate, later piece of work; the schema
  only carries the references.
- **Exercises appear in two places**: inline within a lesson's content stream, and
  as a dedicated exercises section. Both use the *same* exercise shape.
- **Formulas are LaTeX** stored as a string.
- **Single language (French) for now.** No `lang`/locale field yet; see
  [Future extensions](#future-extensions) for where it slots in.
- **IDs are author-assigned readable slugs**, stable across edits.
- **JSON Schema draft 2020-12** as the validation language.

---

## Alternative A — Flat block stream

One flat, ordered array of typed nodes for the whole chapter. Structure (chapter,
section) is expressed by `section` marker nodes in the stream rather than by
nesting; everything, including exercises, is just another node type.

```jsonc
{
  "schemaVersion": 1,
  "id": "theoreme-de-pythagore",
  "blocks": [
    { "id": "s1", "type": "section", "title": "Énoncé du théorème" },
    { "id": "b1", "type": "prose", "text": "…" },
    { "id": "e1", "type": "exercise", "exerciseType": "multiple-choice", "…": "…" },
    { "id": "s2", "type": "section", "title": "Calculer une longueur" }
  ]
}
```

| Axis | Assessment |
|---|---|
| Cross-platform render | OK — a renderer walks a flat list. |
| RAG-chunkable | **Weak.** A chunk's owning section is implicit: you must scan backwards to the previous `section` marker to know where a block belongs. Fragile for citation. |
| Validatable | **Weak.** "A section title must not sit inside an exercise", "every block belongs to a section" become cross-item invariants JSON Schema can't express. |
| Extensible | Good — new node type = new `type`. |
| Human-readable | **Weak.** Deep content reads as one long undifferentiated array; the chapter's outline is invisible. |

**Rejected.** The flat model pushes structure (which section owns a block) from
the data into a scanning convention. That directly undermines constraint 2 (clean,
traceable chunks) and constraint 3 (validatability).

---

## Alternative B — Strict nested tree, exercises in a separate collection

Chapter → sections → blocks, strictly nested. Exercises are **not** blocks; each
section has a separate `exercises` array alongside its `blocks`.

```jsonc
{
  "sections": [
    {
      "id": "enonce",
      "blocks": [ { "id": "b1", "type": "prose", "text": "…" } ],
      "exercises": [ { "id": "e1", "exerciseType": "multiple-choice", "…": "…" } ]
    }
  ]
}
```

| Axis | Assessment |
|---|---|
| Cross-platform render | OK. |
| RAG-chunkable | **Good.** Nesting makes chapter/section ownership explicit and citation trivial. |
| Validatable | Good. |
| Extensible | Good for new exercise types (own collection). |
| Human-readable | Good outline, but see below. |

**Rejected.** The separate `exercises` collection cannot express an exercise that
sits *inline* mid-lesson — the required "check your understanding" question between
two prose blocks. You either lose inline exercises (fails a fixed requirement) or
you allow exercises in two unrelated shapes (`blocks` inline vs the `exercises`
array), which duplicates the exercise model and its validation. Ordering between a
block and an exercise in the same section also becomes ambiguous across two arrays.

---

## Alternative C — Nested tree, exercise is a block type (**chosen**)

Chapter → sections → an ordered `blocks` stream. `exercise` is one of the block
types, so an exercise can appear **anywhere** in the stream. A section carries a
`kind` (`lesson` | `exercises`) that captures editorial intent: `lesson` sections
mix teaching blocks with the occasional inline exercise; `exercises` sections are a
stream made mostly of exercise blocks. One exercise shape serves both placements.

```jsonc
{
  "sections": [
    {
      "id": "enonce", "kind": "lesson",
      "blocks": [
        { "id": "b1", "type": "prose", "text": "…" },
        { "id": "e1", "type": "exercise", "exerciseType": "multiple-choice", "…": "…" }
      ]
    },
    {
      "id": "exercices", "kind": "exercises",
      "blocks": [
        { "id": "e2", "type": "exercise", "exerciseType": "numeric", "…": "…" }
      ]
    }
  ]
}
```

| Axis | Assessment |
|---|---|
| Cross-platform render | **Good.** One ordered stream per section; one renderer switch on `type`. Identical on web and mobile. |
| RAG-chunkable | **Good.** Nesting keeps chapter/section ownership explicit; the block is the natural chunk unit, and `(chapterId, sectionId, blockId)` is the citation key. |
| Validatable | **Good.** Every block validates against its typed sub-schema; the tree shape is a local invariant JSON Schema expresses directly. |
| Extensible | **Good.** New block/exercise `type` is additive (see below). |
| Human-readable | **Good.** The chapter outline is visible in the nesting, and reading order matches array order — no cross-referencing two arrays. |

**Chosen.** C keeps B's explicit, citation-friendly nesting while supporting inline
exercises (which B cannot) with a *single* exercise model (which A blurs and B
duplicates). `kind` records the lesson-vs-exercises intent without forking the
data model.

## How the chosen design meets each constraint

### 1. Cross-platform render
Content is a typed tree of primitives, never client-specific markup. Text fields
are plain strings with a minimal, whitelisted inline convention (`**bold**`,
`*italic*`) parsed by one shared function reused by web and mobile. Formulas are
LaTeX (KaTeX/MathJax on web, an equivalent RN renderer on mobile). Images are
opaque asset references with required `alt` text. No block encodes layout, so the
same source yields the same output everywhere.

### 2. RAG chunking and citation
The block is the retrieval chunk. Every node has a stable, author-assigned id, so a
chunk is embedded with its `(chapterId, sectionId, blockId)` path and the tutor can
cite the exact chapter and section a passage came from. Because ids are stable
across edits, re-embedding after an edit does not orphan existing citations for
untouched blocks.

### 3. Validation
The JSON Schema is the charter. Structure, required fields, id format
(`^[a-z0-9]+(?:-[a-z0-9]+)*$`), enums, and per-exercise-type field requirements
(via `if/then`) are all enforced at authoring time — on the web with zod mirroring
this schema, on the backend with a JSON Schema / Bean Validation check before
publish.

### 4. Extensibility without migration
Block types are an **open** discriminated union. Known `type` values validate
against their exact sub-schema; any *other* string `type` validates against a
permissive fallback (`unknownBlock`) that only requires an `id` and a string
`type`. Adding a block or exercise type is therefore additive: existing content
stays valid, and a new type is introduced by adding a branch — no migration, no
`schemaVersion` bump. `schemaVersion` is reserved for genuinely breaking structural
changes. (Trade-off: `exerciseBlock` does not close `additionalProperties`, so a
misspelled field on a known exercise type is not caught by the schema alone; this
is the deliberate price of the open union and is backstopped by the web/backend
validators and editor.)

### 5. Human-readability
Slug ids, French plain-text fields, shallow nesting, and array order matching
reading order keep a hand-written chapter legible and diff-friendly. See the worked
example, which was hand-written and validates.

## Verification

The schema and the worked example are validated with `ajv-cli` (draft 2020-12):

```bash
npx ajv-cli@5 validate --spec=draft2020 \
  -s docs/schema/course-content.schema.json \
  -d docs/schema/examples/pythagore-3e.json
```

Checked during design: the worked example is **valid**; an unknown block type and
an unknown exercise type are **valid** (extensibility); a `numeric` exercise missing
`answer` and an id with an uppercase letter are **rejected**.

## Inline text rendering

The `richText` type supports minimal inline markup parsed by `parseRichText` in
`packages/content` — a pure tokenizer (no JSX) reused by web and mobile. The web
renderer calls it in `web/components/chapter-view.tsx`.

**Supported markup:**

| Syntax | Result |
|---|---|
| `**bold**` | `<strong>` |
| `*italic*` | `<em>` |
| `$...$` | Inline KaTeX (web); same AST on mobile |

**Escaping:** `\*` emits a literal asterisk; `\$` emits a literal dollar sign.

**Unclosed delimiters are emitted literally**, including the delimiter characters.
This matches CommonMark's rule and makes typos visible in content review rather
than silently dropping characters.

**Tokenisation order:** math spans (`$...$`) are extracted first, so `*` inside
LaTeX (e.g. `$a * b$`) is never consumed by the emphasis parser.

**`scripts/check-content.mjs`** validates that all `*`, `**`, and `$` delimiters
are balanced in content files. It runs in the `content` CI job and should be run
locally before committing: `node scripts/check-content.mjs`.

**`display: "inline"` on a standalone formula block** is a valid schema value but
a candidate for deprecation. Its only meaningful use case — a formula embedded in
running prose — is now covered by `$...$` in `richText`. Once existing content is
migrated, standalone formula blocks with `display: "inline"` can be removed.

## Future extensions

- **Localisation.** Add an optional `lang` at the chapter root and, when
  translations are needed, model translated variants keyed by locale. Plain-text
  fields are already isolated, so this is additive and needs no `schemaVersion` bump.
- **Competency taxonomy.** Replace opaque `competencies` strings with references
  into the controlled taxonomy once it exists; can be introduced as a validated
  string pattern before a structural change.
- **New block/exercise types** (e.g. `video`, `matching`, `fill-in-the-blank`)
  land as new union branches per the extensibility rule above.
- **Inline `display: "inline"` deprecation.** Now that `$...$` in `richText` covers
  inline math, standalone formula blocks with `display: "inline"` have no purpose
  and can be removed from the schema and existing content.
