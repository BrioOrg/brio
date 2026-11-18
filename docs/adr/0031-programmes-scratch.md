# 0031 — Scratch programmes drawn as blocks (`code` with `language: "scratch"`)

- **Status**: Accepted
- **Date**: 2026-10-08
- **Amended**: 2026-10-26 (#233), 2026-11-09 (#234), 2026-11-12 (#232)
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
   `((x * 3) + 4)`. A C block's body (`répéter`, `si`, `répéter jusqu'à ce que`) is indented by
   4 spaces and closed by `fin` at the block's indentation; a bare `sinon` at the `si`'s
   indentation starts the second branch of a `si`. At most 32 levels of brackets or of nested
   blocks (`tooDeep`): far beyond any programme, far below the call stack. The ASCII and the
   typographic apostrophe are both accepted in the block wordings; input is NFC-normalised. Text is written between « ». A variable is a bare name (`x`), optionally in
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
   | `si <booléen> alors` … `fin` | control | C |
   | `si <booléen> alors` … `sinon` … `fin` | control | double C |
   | `répéter jusqu'à ce que <booléen>` … `fin` | control | C |
   | `stylo en position d'écriture` | pen | stack |
   | `relever le stylo` | pen | stack |
   | `effacer tout` | pen | stack |

   Values: a number, a text « … », a variable, `réponse` (sensing) or an operator block
   `(<valeur> op <valeur>)` with `op` among `+ - * /` (operators). Anything else is an error.

   Booleans (4e, drawn as hexagons, operators category): a **comparison**
   `(<valeur> cmp <valeur>)` with `cmp` among `< = >`, a **logical** `(<booléen> et <booléen>)`
   / `(<booléen> ou <booléen>)`, or a **negation** `(non <booléen>)` (Scratch's « non », the way
   to say « différent de »). As for arithmetic there is **no precedence**: every operator
   (comparison and logical alike) has its own pair of parentheses, e.g.
   `((réponse = « oui ») ou (essais > 3))`. In operator position `et`/`ou` are always the logical
   operator and need two booleans; `non` is the negation when a bracket follows it; as operands
   all three stay variable names. Scratch has no `≤ ≥ ≠`: the parser names the Scratch way
   (`unsupportedComparison`). The condition of a `si` and of a `répéter jusqu'à ce que` must be a
   boolean, never a bare value. A boolean cannot sit in a value slot: **a deliberate restriction**
   — Scratch accepts `dire (a < b)` and says true/false — that keeps booleans to conditions.
3. **The parsed tree is the shared model.** `parseScratch` in `packages/content` returns either
   the statement tree or a list of errors with their line number; `buildScratchModel` turns the
   tree into blocks made of parts (label, icon, input oval, variable dropdown, nested reporter,
   nested boolean hexagon), with the French wording in one place. A block's shape is a hat, a
   stack, a C, or a double C (`cElse`: the `si … sinon`, with its « sinon » row and second body). Unlike `figure` and `chart` (ADR 0013, ADR 0030), the
   model carries **no coordinates**: a block is mostly text, and its width depends on the text.
   The web lays the parts out in HTML with flexbox, which measures text exactly; React Native will
   do the same with its own flexbox.
4. **Colours** come from the `--color-scratch-*` tokens (#217, own PR): Scratch 3's category
   colours with a dark label instead of white, ≥ 4.5 : 1 on every fill, the same in both themes.
   Puzzle notches are not drawn; they are decorative. The pen category adds `--color-scratch-pen`
   / `-edge` (#234, own PR #397: Scratch 3's pen primary and tertiary, 6.73 : 1 on the dark
   label). Booleans reuse the operators colour (they are the operators category); only their
   shape is a hexagon, as in Scratch. A clip-path clips a border too, so the hexagon is drawn as
   two clipped layers, the `-edge` colour 1px larger behind the fill: a comparison inside a
   et/ou keeps its outline.
5. **Accessibility.** The drawn blocks are hidden from assistive technology; a visually hidden
   `<pre>` carries the source text, which keeps the parentheses and the `fin`, so a screen reader
   reads the programme's structure. The words on the blocks stay selectable.
6. **CI and runtime.** `check-content` runs the same `parseScratch` (Node's type stripping) and
   rejects a `scratch` programme that does not parse. Content that does not go through CI (a
   teacher's course) falls back to the monospace text when it does not parse; it never breaks
   the page.
7. **Evaluator for "prévoir la valeur"** (#232, amendment 2026-11-12). `evaluateScratch` in
   `packages/content` runs the parsed tree and returns what the sprite **says** (every `dire`,
   in order) and the final value of each variable. `check-content` uses it to verify the answer
   of an exercise that predicts a programme's output, so a wrong computation in the content is a
   CI error. Decisions left open by #232:
   - **Linking is explicit, not positional.** An exercise opts in with a `program` field,
     `{ "ref": "<code block id>", "inputs"?: [ … ] }`. `ref` names a Scratch `code` block
     anywhere in the chapter. An explicit id crosses sections ("le programme du début" is in an
     earlier section than the exercise), survives a block being reordered, and never catches an
     exercise that merely follows a programme but asks something else — a distance
     (`avancer`/`tourner`), a shape, or a transformation of the programme. A positional rule
     ("the preceding `code` block") was rejected for those false positives. The field lives on
     the exercise, whose block schema is an open union (`additionalProperties` not closed), so no
     schema migration; it is not a correction secret (the programme is already on the page) and
     is not stripped by the `ExerciceExtractor`.
   - **Input for `demander`** comes from `program.inputs`: the first `demander` stores
     `inputs[0]` in `réponse`, the second `inputs[1]`, and so on. The statement's prose ("the
     user types 5") is not parsed.
   - **Motion is out of scope in v1.** `avancer`/`tourner` run as no-ops: they say nothing and
     change no variable, so a "distance parcourue" exercise is not linked to a programme. The
     evaluator keeps room for a later position/heading model.
   - **Comparison.** The computed answer is the value of the **last** `dire`, coerced to a number
     the way Scratch's arithmetic blocks coerce (a non-numeric string is 0). A `numeric` exercise
     compares it to `answer` within `tolerance`; a `multiple-choice` whose single correct choice
     is a number compares to that number. A linked programme that says nothing, or that fails at
     runtime (a `demander` with no input, a negative/fractional `répéter` count, a runaway loop
     caught by a step budget), is a CI error.
   - **4e blocks (#234).** The evaluator covers the whole catalogue: `si … alors [… sinon]` runs
     one branch; `répéter jusqu'à ce que` tests its condition **before** each turn (already true,
     the body never runs), and each turn counts against the step budget, so a condition that
     never comes true is a `tooManySteps` CI error; the pen runs as a no-op like motion.
     Comparisons follow Scratch (`Cast.compare`): numbers when both sides read as numbers,
     otherwise texts **ignoring case**; blank text is not a number. One Brio convention differs:
     a decimal comma reads as a number (§1), where Scratch would compare « 2,5 » as text — hence
     AUTHORING's rule to compare integers only. The three switches (statements, values,
     booleans) are exhaustive and end in a `never`, so a block kind added to the parser is a
     type error until it is evaluated.
8. **Teacher editor** (#233, amendment 2026-10-26). The code block of the course editor
   (« Programme ») offers « Texte » (no `language`) or « Scratch » (`language: "scratch"`, the
   default for a new block). In Scratch it runs the same `parseScratch` on every keystroke, lists
   each error with its line number, translated into French in the web (the parser's messages
   stay in English for CI), and draws the blocks beside the field as soon as the programme
   parses. A Scratch programme that does not parse is a **blocking** problem in the editor's
   pre-publication check (`SCRATCH_INVALID`, a web-only rule like `NO_CORRECT_CHOICE`).
   **The backend's `PublicationValidator` does not parse Scratch.** Doing so would need a
   second parser in Java, which would drift from the TypeScript one as the catalogue grows
   (#234), or a JavaScript engine in the JVM for one rule. The only author of a course is the
   editor, which already blocks; content that bypasses it is still harmless, since point 6 makes
   the renderer fall back to text. If a second client ever writes courses, this is revisited.

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

- An evaluator for "prévoir la valeur" exercises (#232). Done: point 7.
- Choosing "Scratch" as the language of a code block in the teacher editor (#233). Done: point 8.
- Conditions, comparisons and the pen for 4e (#234, amendment 2026-11-09). Done: the catalogue now
  carries `si … alors`, `si … alors … sinon` (double C), `répéter jusqu'à ce que`, the hexagonal
  boolean blocks (comparisons `< = >`, logical `et`/`ou`/`non`) and the three pen blocks
  (`stylo en position d'écriture`, `relever le stylo`, `effacer tout`). The parser unifies values
  and booleans in one parenthesis-per-operator descent; the operator decides the type, so a
  boolean in a value slot or a value in a condition is a clear error. The "block" error codes
  (`finWithoutLoop`, `finIndent`, `emptyLoop`, `loopNotClosedBeforeLine`, `loopNeverClosed`) stay
  named after the loop (#307) but gained a `blockType` param so the French copy names the real
  block (« si », « répéter jusqu'à ce que »…).

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
