# 0038 — Curves of functions in a figure (`functions`, `readings`, `parameters`)

- **Status**: Proposed
- **Date**: 2026-11-17
- **Deciders**: Pierce Broudin

## Context

A figure with axes (ADR 0013, amendment #214) can only draw a curve as a `polylines` through
hidden points the author computes by hand. For a function this is wrong by construction: a
parabola becomes a broken line, every ordinate is the author's arithmetic, and nothing checks
it. 3e needs linear and affine functions and graphical readings
(`c4.ogd.fonctions.representations`, `.lire-graphique`, `.lineaires-affines`); 5e needs the
straight line of a proportional situation (`c4.ogd.proportionnalite.representer-graphique`);
seconde will need the reference functions (square, inverse, square root) and polynomials.
None of it can be drawn today, and an image or antecedent cannot be shown being read.

## Decision

Three optional arrays on the `spec` of a figure **with axes**. Additive change, `schemaVersion`
unchanged (ADR 0004, ADR 0019 §2).

```json
{ "axes": { "x": { "from": -4, "to": 4, "step": 1 }, "y": { "from": -3, "to": 5, "step": 1 } },
  "functions":  [{ "name": "f", "expr": "a x² − 2", "domain": [-3, 3], "label": true,
                   "style": "dashed", "tone": 1 }],
  "readings":   [{ "function": "f", "x": 1 }, { "function": "f", "y": 2 }],
  "parameters": [{ "name": "a", "min": 0.5, "max": 2, "step": 0.5, "value": 1 }] }
```

1. **The expression is text, read by our own parser** (`packages/content/src/expression.ts`):
   tokeniser, recursive descent, a tree compiled into closures. No `eval`, no `Function`, no
   dependency. It reads what a French page writes: decimal comma or point, `x`, `+ − × / ^ ² ³`,
   implicit products (`2x`, `3(x + 1)`, `ax`), brackets, `sqrt`/`racine`/`√`, `abs`/`|…|`, `π`.
   Letters are single (so `ax` is a × x); only `x` and the parameters are allowed. `1/2x` reads
   (1/2)·x, left to right. Every error is a French sentence with the position of the faulty
   character, shown as is by the editor and check-content.
2. **Adaptive sampling** (`function-plot.ts`): 160 intervals, each split until the curve's
   midpoint is within 0,2 px of the chord. Where f is not defined the edge is found by
   bisection and the path stops (√x starts exactly at the origin). A step still taller than
   8 px after 16 halvings is a pole: the path is cut there, so **no vertical line ever crosses an
   asymptote** (1/x is two paths). The curve is clipped to the axes window in the model, not by
   an SVG clip path, so the output is deterministic and testable.
3. **Curve name.** `label: true` writes 𝒞 with the name as an italic subscript (𝒞_f); a
   string writes that text ("Tarif A"). It is placed along the curve, from its right end
   inwards, on the first spot whose box touches no curve, axis, graduation band or reading.
4. **Readings** as in a textbook: dashed guides from the point to both axes, the point, and the
   values written where the graduations are. An antecedent reading solves f(x) = y numerically
   (sign changes refined by bisection, touching points by minimising |f − y|, poles rejected) and
   draws every solution. A value that is not exact is rounded to the hundredth with ≈. The
   graduation number a value would cover is removed: the read value replaces it.
5. **Colour.** The curve is ink, like every other stroke of a figure. The reading is the one
   coloured thing (accent: guides, point and values together). `tone` (ADR 0037, the same
   `figureTone` 1–4 and editor picker as every figure element) colours a curve and its name to
   match the same tone in the prose's formula; never decoration.
   Every text of a repère (graduation numbers, axis titles, read values, curve names) is drawn
   over the strokes with a halo in the page colour (`paint-order: stroke`), so a curve passing
   behind a number stops short of it, as in a printed textbook. Point names, free labels,
   vector names (ADR 0041, a text shadow on their KaTeX) and the labels of transformation
   images get the same halo and come after the strokes of their layer. A graduation number within a
   short number's width of a read value is hidden: the read value wins.
6. **Parameters.** Each letter gets a native range input under the drawing (keyboard, Home/End,
   `aria-valuetext` "a = 1,5"), with its bounds written at both ends. The curve and its readings
   follow it on every input, with no animation: the point moves because the student moves it.
   The first render and print use `value`; the sliders are not printed. A figure with
   parameters is the only one rendered on the client.
7. **CI and publication** (`function-rules.ts`, shared by check-content and the teacher editor,
   messages in French): axes present; at most 4 functions, 6 readings, 3 parameters; names one
   letter (a digit allowed after a function's), unique, not `x`; expressions that parse; a
   domain inside the x axis; a curve that enters the window; readings that can be drawn (x in
   the domain, f(x) defined and in the window, y with at least one visible antecedent); sliders
   with min < max, a whole number of steps, at most 400 notches, a `value` on a notch, and a
   parameter used by some expression. Readings are checked at the parameters' `value`; a
   slider may later move one out of the window, and it is then not drawn.

## Consequences

### Positive

- A curve is authored as its formula and checked by CI; the author never computes an ordinate.
- Readings of an image and of antecedents can be shown, which is the core of
  `lire-graphique`.
- A slider lets a student see what a coefficient does (5e: y = ax turns about the origin).
- Lycée reference functions draw correctly, asymptotes and edges of definition included.

### Negative / trade-offs

- `1/2x` means (1/2)·x, as in a programming language, not 1/(2x) as some hands write it.
  Authors bracket when they mean otherwise.
- No `exp`, `ln`, trigonometry yet: adding a function name is one line each when a chapter
  needs it.
- A curve name may find no free spot on a crowded figure: it is then left out (the alt and the
  caption still name the curve).
- No tableau de valeurs generated from a function: a `table` block written by the author is
  enough for now, and a generated one would need its own spec and checks.
- `check-content` registers a small Node resolve hook so the shared rules can import their
  siblings without an extension.

## Alternatives considered

- **`eval` / `new Function`.** Rejected: content from teachers is untrusted input, and it would
  accept JavaScript syntax (`**`, `Math.sqrt`) instead of maths notation.
- **A maths library (math.js, function-plot, JSXGraph).** Rejected for the reasons of ADR 0013
  and 0030: a runtime dependency much larger than the need, its own syntax and styling, no
  deterministic output for CI.
- **Pre-computed points stored in the content.** Rejected: the arithmetic stays with the author,
  and a slider would be impossible.
- **Readings as free `points` and `segments`.** Status quo: the author computes the antecedents,
  and the guides do not follow a parameter.
