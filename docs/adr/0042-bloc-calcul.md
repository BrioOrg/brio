# 0042 — Worked-calculation block (`calcul`)

- **Status**: Proposed
- **Date**: 2026-11-17
- **Deciders**: Pierce Broudin

## Context

Collège maths is full of *calculs en ligne*: developing, reducing and factorising expressions
(`c4.num.litteral.developper`, `…factoriser`, `…reduire`), chains of operations on relative
numbers, fractions and powers (`c4.num.relatifs.enchainements`, `c4.num.puissances.calculer-expressions`),
a length with Pythagoras (`c4.geo.pythagore.calculer`), and equations solved line by line
(`c4.num.equations.premier-degre`, `…resoudre-operations-inverses`). A textbook writes them aligned
on the `=` sign, with a short justification in the margin and, for an equation, the operation
applied to both members written under each of them (−13 … −13).

No block does this. `formula` is one KaTeX string; `steps` is numbered prose with an optional
formula per step. The 5e chapters fall back on prose (« On regroupe les termes en x : 2x + 4x =
6x. ») or on a table (`equations-premieres`: « on soustrait 13 : x = 41 − 13 »). Nothing is
aligned, nothing shows what changed from one line to the next, and the interactive mode cannot
unroll a calculation a line at a time.

## Decision

Add a `calcul` block to the content schema. Additive change, `schemaVersion` unchanged (ADR 0004,
ADR 0019 §2).

```json
{ "id": "calcul-x-plus-13", "type": "calcul", "mode": "equation",
  "title": "Résoudre $x + 13 = 41$",
  "lines": [
    { "latex": "x + 13 = 41" },
    { "latex": "x = 41 - 13", "op": "-13", "focus": "- 13",
      "note": "on soustrait 13 aux deux membres" },
    { "latex": "x = 28", "note": "on calcule" } ],
  "conclusion": "La solution de l'équation est $28$." }
```

1. **Two modes.** `equation`: every line is a whole equation with exactly one relation.
   `egalites`: a chain; the first line is the starting expression (bare, or `A = …`), each next
   line is the next expression with `=` implied. A continuation line may start with another
   relation (`\approx 5{,}4`), never hold one further on. Relations: `=`, `≠`, `<`, `>`, `≤`, `≥`,
   `≈` and their LaTeX commands. No `⇔` column: collège writes equivalent equations one under the
   other without it; a lycée `connective` field would be an additive relaxation.
2. **The author never aligns.** Each line is one LaTeX string; a pure function in
   `packages/content/src/calcul.ts` finds its relation outside every group (braces,
   `\left…\right`, `\begin…\end`; `\left<` is a bracket) and splits it into left member,
   relation, right member. No `&`, no `aligned` written by hand.
3. **Columns, not one `aligned` formula.** The web renders each part with KaTeX and lays the
   lines out in a CSS grid: three columns shared by every line (subgrid), right member left-aligned,
   left member right-aligned, so the relations line up. One `aligned` formula was rejected: a
   single formula cannot reveal one line at a time, cannot put a note under its line on a phone,
   and is read by a screen reader as one block.
4. **Notes.** Short rich text (≤ 80 characters, checked) in a fourth column when the block is wide
   enough (container ≥ 32 rem), under the right member of its line otherwise. Horizontal scroll
   inside the block only when a line itself is wider than the screen.
5. **What changed.** `focus` is a substring of the line (spaces ignored), emphasised wherever it
   occurs, never inside a number (`2` in `12`) or a command. The model wraps it in `\tone{1}{…}`,
   the authors' macro of ADR 0037 (a trusted `\htmlClass`, which keeps KaTeX's spacing: a binary
   minus stays binary). The operation and the part it produces wear the same tone. An author who
   colours a line with `\tone` already (terms in x in tone 1, numbers in tone 2) needs no focus.
6. **The operation on both members** — the signature of the block. `op` (equation mode, from the
   second line) is the LaTeX of the operation that gives this line: `-13`, `\div 4`. It is written
   small, in tone 1, under the *end* of each member of the previous line, as on a copy. It belongs
   to the line it leads to: it is revealed with it, read before it, and on a phone the order stays
   line, note, operation, next line.
7. **Interactive mode.** The lines come one at a time, then the conclusion, through the step
   mechanism of `steps` blocks (MOTION.md "Step reveal", #247): « Étape suivante », → and space,
   a swipe; reduced motion keeps the pacing and drops the rise. A line not revealed yet is
   `visibility: hidden`, not removed: the columns never change width under the student's eyes.
   Reading mode and print show everything. In the deck (ADR 0032) the block is a lead, like `steps`.
8. **Accessibility.** The drawn columns are KaTeX HTML, hidden from assistive technology; each
   line also carries its whole formula once as MathML (visually hidden), preceded by its
   operation (« Aux deux membres : −13 »). The note is plain text.
9. **CI, editor, tutor.** Rules shared by `check-content` (English) and the teacher editor
   (French), in `calcul.ts`: 2 to 12 lines, none blank; each line splits as in §1 with balanced
   groups and no empty member; a focus is found in its line; an operation only on an equation line
   after the first, balanced and without relation; a note not blank and short. KaTeX itself cannot
   run in `check-content` (no dependency): a web test parses every line, part and operation of the
   catalogue. The tutor reads a calculation as its lines with their notes.

## Consequences

### Positive

- Calculations look like a textbook's, aligned by construction; the author writes lines only.
- The interactive mode unrolls an equation one transformation at a time, the operation shown
  before its result.
- A screen reader gets one formula per line instead of scattered fragments.

### Negative / trade-offs

- Only one relation per line: `a = b = c` on one line must be written as a chain.
- Alignment is on the relation only: no second alignment column (systems, two-column proofs).
- The focus is a substring: an author who wants one of two identical occurrences emphasised
  cannot (both are).

## Alternatives considered

- **A KaTeX `aligned` environment generated by the model.** Rejected for §3's reasons.
- **Extending `steps`.** A step is prose first; a calculation is formula first, and its lines must
  share columns across steps.
- **Hand-written `aligned` in `formula`.** Status quo for anyone who knows LaTeX; unreadable in a
  diff, no notes, no reveal, no checks.
