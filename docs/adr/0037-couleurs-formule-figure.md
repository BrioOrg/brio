# 0037 — Meaningful colour shared by formulas and figures (`\tone`, `tone`)

- **Status**: Proposed
- **Date**: 2026-11-17
- **Deciders**: Pierce Broudin

## Context

A good French textbook colours rarely, and always to say one thing: *this* object in the figure
is *that* symbol in the formula. Side [AB] is blue in the triangle and in $AB^2$; in
$k(a + b) = ka + kb$ each distributed term keeps the colour of its rectangle. This is how
`c4.geo.pythagore.*` (3e) and `c4.num.litteral.developper` / `c4.num.operations.utiliser-distributivite`
(5e) are usually taught.

brio cannot do it. Figures (ADR 0013) are all ink. KaTeX runs with `trust: false` (lib/katex.ts,
needed since Communauté messages hold untrusted formulas, ADR 0035), so `\htmlClass` is refused,
and `\color{#…}` would put a raw colour in content, outside the tokens, wrong in one of the two
themes.

## Decision

Four semantic **maths tones**, `--color-tone-1…4` plus `--color-tone-n-soft` (tokens PR #388:
WCAG text contrast on every ground, ΔE ≥ 20 between tones under simulated protanopia and
deuteranopia, checked by `check-contrast.mjs`). Additive change, `schemaVersion` unchanged.

1. **Formulas: an author macro `\tone{n}{…}`.** It expands to `\htmlClass{text-tone-n}{…}`.
   KaTeX's `trust` becomes a function that accepts **only** `\htmlClass` whose class is exactly
   one of the four `text-tone-n`; every other `\html*`, `\href`, `\url`, `\includegraphics` stays
   refused. The output is a class, never an inline colour, so the token colours it in each theme.
   KaTeX writes `\gdef` into the `macros` object it is given: every render gets a fresh copy, so a
   formula (a student's message) cannot redefine `\tone` for the next one. Valid everywhere a
   formula is: `formula.latex`, `$…$` in rich text, `steps[].formula`, Communauté messages.
2. **Figures: an optional `tone` (1…4)** on points (dot and name), segments, polygons, circles,
   arcs, angle marks and free labels. A toned polygon may add `fill: "soft"` (schema:
   `dependentRequired`), its soft fill drawn under its stroke. Polylines, length marks, axes,
   number lines and solids stay ink: none of the target lessons needs them coloured.
3. **Same pipeline.** `@brio/content` carries `tone` into the drawing model (an untoned element
   gets no field, so existing models are unchanged); the renderer maps it to `stroke-tone-n`,
   `fill-tone-n`, `fill-tone-n-soft` classes (`web/lib/math-tones.ts`). The figure editor offers
   an "encre / teinte n" picker on each of these elements and the soft-fill box on polygons.
4. **Rules** (`packages/content/src/tone.ts`, shared by `check-content` and the editor like
   ADR 0030's chart rules): a `\tone` argument or `tone` outside 1…4 is an error; **more than 3
   distinct tones in one block is a warning** (editor: non-blocking). A tone used in a figure and
   in no formula of its section is allowed: an object may be named only in the figure.
5. **Authoring discipline** (AUTHORING.md): same number = same object across the chapter; start
   with 1 and 2 (blue/orange, the safest pair for colour-blind students); colour the object, not
   its exponent; the object is always also named by a letter or number, so colour is never the
   only cue.

## Consequences

### Positive

- The Pythagore statement and the distributivity area model read the way textbooks print them,
  in both themes, without a single raw colour in content or components.
- The KaTeX surface opened is four fixed class names; the security tests cover other classes,
  attribute injection through the argument and macro redefinition.

### Negative / trade-offs

- A soft fill is opaque (tokens are solid colours): it hides a grid line under the polygon.
- Free labels are upright sans text, so a toned variable label in a figure is not italic; the
  5e figure uses numbers on purpose. A typeset label belongs to a later amendment of ADR 0013.
- The tutor and RAG ingestion see `\tone{1}{AB}` in formula sources; KaTeX renders it wherever
  `renderKatex` is used, and it is harmless as text.

### Follow-ups

- Mobile (Expo) must register the same macro and trust function when it renders KaTeX.

## Alternatives considered

- **`\color{…}` / `\textcolor`.** Rejected: a raw colour in content, wrong in one theme, and
  KaTeX validates it as a CSS colour, so `var(--…)` is not accepted.
- **`trust: true` for `\htmlClass`.** Rejected: any class from untrusted Communauté formulas,
  including layout utilities that could overlay the page.
- **Colour by object name (auto-colour every `AB`).** Rejected: implicit, surprising, and wrong
  whenever the same letters mean different things in two blocks.
