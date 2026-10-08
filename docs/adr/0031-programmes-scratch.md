# 0031 — Scratch programmes drawn as blocks (`code` with `language: "scratch"`)

- **Status**: Accepted
- **Date**: 2026-10-08
- **Deciders**: Pierce Broudin

## Context

The 2026 cycle-4 programme teaches 5e algorithmics with a **block-based language** (Scratch):
sequencing, formulas built from nested operator blocks, predicting what a programme displays, the
"répéter n fois" loop (`c4.algo.programmes.*`). 6e `instructions-programmes` (`c3.algo.*`) shows
the same kind of programmes. Brio only has the `code` block, drawn as monospace text: nesting
becomes parentheses, the loop an indentation and a "fin", and `*` is written `×` because an
isolated `*` opens italics in rich text. It is readable, but it is not what students see in class.

Two routes were open (#217): the `scratchblocks` library, which turns Scratch's text syntax into
SVG, or an in-house renderer.

## Decision

A `code` block whose `language` is `"scratch"` is parsed and drawn as Scratch blocks. No new block
type and no schema change beyond the description of `language`: a client that does not know the
renderer, and the teacher editor, show the text as before.

```json
{ "id": "code-programme-calcul", "type": "code", "language": "scratch",
  "code": "quand le drapeau vert est cliqué\ndemander « Choisis un nombre » et attendre\nmettre x à (réponse)\nmettre résultat à ((x * 3) + 4)\ndire (résultat)" }
```

1. **Text syntax, one instruction per line**, close to what the chapters already used. Nested
   blocks are written in parentheses, and every operator block has its own pair:
   `((x * 3) + 4)`. A loop body is indented by 4 spaces and closed by `fin` at the loop's
   indentation. Text is written between « ». A variable is a bare name (`x`), optionally in
   parentheses (`(x)`). Numbers use `.` or `,` as the decimal separator and are shown as written.
   The code is not rich text, so `*` is Scratch's real multiplication sign.
2. **A closed catalogue**, Scratch 3's French wording, with its category:

   | Line | Category | Shape |
   |---|---|---|
   | `quand le drapeau vert est cliqué` | events | hat, first line only |
   | `demander <valeur> et attendre` | sensing | stack |
   | `mettre <variable> à <valeur>` | variables | stack |
   | `ajouter <valeur> à <variable>` | variables | stack |
   | `dire <valeur>` | looks | stack |
   | `avancer de <valeur> pas` | motion | stack |
   | `tourner à droite de <valeur> degrés` (or `à gauche`) | motion | stack |
   | `répéter <valeur> fois` … `fin` | control | C |

   Values: a number, a text « … », a variable, `réponse` (sensing) or an operator block
   `(<valeur> op <valeur>)` with `op` among `+ - * /` (operators). Anything else is an error.
   Conditions, comparisons, "répéter jusqu'à" and the pen extension come when a chapter needs
   them (4e), as amendments to this table.
3. **The parsed tree is the shared model.** `parseScratch` in `packages/content` returns either
   the statement tree or a list of errors with their line number; `buildScratchModel` turns the
   tree into blocks made of parts (label, icon, input oval, variable dropdown, nested reporter),
   with the French wording in one place. Unlike `figure` and `chart` (ADR 0013, ADR 0030), the
   model carries **no coordinates**: a block is mostly text, and its width depends on the text.
   The web lays the parts out in HTML with flexbox, which measures text exactly; React Native will
   do the same with its own flexbox.
4. **Colours** come from the `--color-scratch-*` tokens (#217, own PR): Scratch 3's category
   colours with a dark label instead of white, ≥ 4.5 : 1 on every fill, the same in both themes.
   Puzzle notches are not drawn; they are decorative.
5. **Accessibility.** The drawn blocks are hidden from assistive technology; a visually hidden
   `<pre>` carries the source text, which keeps the parentheses and the `fin`, so a screen reader
   reads the programme's structure. The words on the blocks stay selectable.
6. **CI and runtime.** `check-content` runs the same `parseScratch` (Node's type stripping) and
   rejects a `scratch` programme that does not parse. Content that does not go through CI (a
   teacher's course) falls back to the monospace text when it does not parse; it never breaks
   the page.

## Consequences

### Positive

- Students see blocks shaped and coloured like the ones in class, with the real `*`.
- Programmes are structured data: an evaluator can compute what a programme displays and check
  the expected answer of a "prévoir la valeur" exercise (follow-up).
- No dependency; one parser shared by the renderer, CI and, later, mobile.

### Negative / trade-offs

- Only the catalogue above can be drawn. A programme using another block must stay in a plain
  `code` block until the catalogue grows.
- A programme cannot sit inside an exercise prompt or a QCM option (rich text); those stay in text.
- `language` was a free-text hint; the value `scratch` now has a meaning and is checked.

### Follow-ups

- An evaluator for "prévoir la valeur" exercises (#232).
- Choosing "Scratch" as the language of a code block in the teacher editor (#233).
- Conditions, comparisons and the pen for 4e (#234).

## Alternatives considered

- **`scratchblocks` (MIT).** Rejected: it builds and measures its SVG with the DOM, so it cannot
  run in Expo or in CI; its colours are built in and would have to be overridden; its French
  syntax (`mettre [résultat v] à (((x) * (3)) + (4))`) is harder to author than ours.
- **A JSON tree of blocks.** Easier to validate, but long to write and to review; the text syntax
  gives the same tree through the parser.
- **A separate `scratch` block type** (as `chart`). Rejected: the programme is text first, and
  keeping it in `code` lets every client without the renderer fall back to that text.
- **SVG with computed coordinates** (as `figure` and `chart`). Rejected: without a DOM, text
  widths can only be estimated, and a block's size is driven by its text.
