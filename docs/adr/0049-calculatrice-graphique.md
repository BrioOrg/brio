# 0049 — Graphing calculator (language, implicit curves, page, state in the address, course block)

- **Status**: Proposed
- **Date**: 2026-11-22
- **Deciders**: Pierce Broudin

## Context

A curve exists today only inside a chapter figure written by an author (ADR 0038): two 5e
chapters use one (`fonctions-dependance`, `proportionnalite-pourcentages`). A student cannot type
anything of their own. Questions such as "what does the coefficient a do?" or "where do these two
lines meet?" are answered by trying, and that needs a tool the student drives.

The online graphing calculators load third-party scripts, send the traffic of minors to an
outside service and need a licence to be embedded. ADR 0038 already gives us a safe expression
parser (no `eval`), adaptive sampling, readings and sliders. Epic #417 builds a graphing
calculator on that engine: a page in a new Explorer › Outils section (`/explorer/calculatrice`)
and a `calculatrice` block an author places in a course. It is split into #418 (language), #419
(implicit curves), #420 (curve colours), #421 (page), #422 (reading, remarkable points,
keyboard), #423 (open a figure in the calculator) and #424 (course block).

## Decision

We will build our own graphing calculator, pure engine in `@brio/content`
(`packages/content/src/grapheur/`, no React, no DOM, reusable by the Expo app), drawn in SVG by
the web app, with the state in the address and nothing stored on the server.

### 1. The language (#418)

A calculator is a **list of lines**, each one expression, read together by
`analyserLignes(lignes, { angle, valeurs })` (`grapheur/langage.ts`), which returns one result per
line, in the same order and with the same ids:

| Line | Kind (`genre`) |
|---|---|
| `y = 2x + 1`, `2x + 1` alone, `f(x) = x² − 3` (`nom: 'f'`), `f'(x)` | `explicite`: `f(x)` |
| `x² + y² = 4`, `xy = 1`, `x = 3`, `x = y²` — any other equality in x and/or y | `implicite`: `F(x, y)` = left − right |
| `a = 2`, `b = −1,5`, `k = 2π` | `constante`; `curseur: true` when the value is a number as typed |
| `2/3 + 1/6`, `f(3)`, `√2`, `sin(π/6)` — no x, no y | `calcul`: `valeur`, and `exact` (a fraction) or null |
| a blank line | `vide` |
| anything else | `erreur`: a French sentence, the position of the faulty character, the LaTeX if the line parsed |

1. **Parser.** The ADR 0038 parser gains one option, `calculator` (`expression.ts`). Without
   it nothing changes: figures read exactly what they read before, and the existing tests pass
   unmodified. With it: `sin cos tan exp ln log` (decimal log), `π`/`pi` and `e` (Euler's
   number) as constant nodes, every single letter as a variable (`ax` is a·x, as on paper; the
   caller decides what each letter means), calls `f(…)`, `f'(…)`, `f''(…)` to the names the
   caller declares (one lowercase letter other than x, y, e, optionally one digit: `f1`, which
   ADR 0038 figures allow), primes `'`, `’`, `′`, a position on every node, and the angle unit
   carried by the `sin`/`cos`/`tan` nodes (`degrees: true`). A known unsupported name
   (`arcsin(`, `sinh(`, `max(`…) is reported as an unknown function instead of being read as
   letters. Functions still need brackets (`sin x` is refused, as `sqrt x` was).
2. **Lines.** A line has at most one `=`; `< > ≤ ≥ ≠` are refused (inequalities are out of
   scope). Each side is parsed with the other side blanked, so every position is a position in
   the whole line. The left side decides the kind from its text: `f(x) =` is a definition,
   a single letter other than x and y is a constant (whose value may use other constants and
   functions, but neither x nor y), `y =` with no y on the right is an explicit curve; anything
   else with x or y is implicit; an equality with neither is refused.
3. **Resolution.** Lines come in any order. The first line that names a letter owns it; a
   second definition is refused on the second line only. Dependencies are ordered by Tarjan's
   strongly connected components: a cycle (`f(x) = g(x)`, `g(x) = f(x)`, or `a = a + 1`) is an
   error on each of its lines and nothing loops; a line using a definition in error is in error
   too. A letter nobody defines is an error that carries `curseurPropose: 'a'`, so the screen
   offers "Ajouter un curseur a".
4. **Inlining and compilation.** A call is inlined: `f(x − 1)` becomes the body of f with
   x − 1 for x, and `f⁽ⁿ⁾(u)` the n-th symbolic derivative of that body. Every curve is then one
   tree in x (and y), compiled once into nested closures (`grapheur/compilation.ts`): sub-trees
   without x or y are folded, common shapes (an operation with a number, a square) get their own
   closure, nothing is looked up at call time. Curves are sampled hundreds of thousands of times
   a frame; measured on a laptop (Node 22), a million evaluations take about 15 ms for
   x² + y² − 4 and about 120 ms for 3x³ − 2x² + x/4 − sin(2x) + √(x² + 1).
   ±Infinity is NaN, as in ADR 0038. An inlined line above 50 000 nodes is refused
   ("trop longue"), so a chain of doubling definitions cannot freeze the page.
5. **Derivatives** (`grapheur/derivee.ts`): symbolic rules of a lycée textbook (sum, product,
   quotient, power with a constant exponent, a^v, general u^v = e^(v ln u), chain rule for sin
   cos tan exp ln log √ abs; |u|' = u/|u|, undefined at 0), then a light simplification (0 and 1
   neutral, numbers folded, a number in front). In degrees `sin°(u) = sin(u·π/180)`, so every
   trigonometric derivative takes the factor π/180. A quotient, a power or a function value is
   folded only when the result is a whole number, so that `1/3` and `√2` are never replaced by a
   rounded decimal that the exact fractions would then read. The derivative is evaluated, never
   displayed. Checked against the centred difference quotient on 40 functions.
6. **Exact fractions** (`grapheur/rationnel.ts`): a calculation line is worked out in BigInt
   fractions when it only uses + − × ÷, whole powers (|exponent| ≤ 64), the square root of a
   perfect square and constants: `2/3 + 1/6` is `5/6`, `(1/2)^3` is `1/8`, `√(4/9)` is `2/3`,
   `0,1 + 0,2` is `3/10`. A number is read from its first 15 significant digits, so a typed
   `0,1` and a slider value `0,30000000000000004` are the fractions they show. Beyond 2 048 bits a
   fraction is dropped for the decimal value. A division by zero (or 0 to a negative power) in a
   calculation or a constant is refused; a curve with a pole is drawn without an error.
   `formaterRationnel` writes `5/6`, `−5/6` (U+2212), `3`; `latexRationnel` writes `\frac{5}{6}`.
7. **LaTeX preview** (`grapheur/latex.ts`, `latexOf`): `1/2x` is `\frac{1}{2}x`,
   `(x+1)/(x−1)` is `\frac{x+1}{x-1}` (the bar replaces the brackets), `x^{2}`, `\sqrt{…}`,
   `\left|…\right|`, `\sin\left(…\right)`, implicit products kept implicit except before a
   figure or a fraction (`2\times 3`), only the brackets the reading needs, French decimal comma
   `2{,}5`, thin-space grouping of long integers. A definition line reads `f(x)=…`.
8. **Messages** are French sentences (UX writer, gate 2 of #418), with a non-breaking space
   before `:`; they are exported (`MESSAGES_CALCULATRICE`) so the screen and its tests use the
   same text.

### 2. Implicit curves (#419)

`traceImplicite(F, fenetre, toSvg, { budget })` (`grapheur/implicite.ts`), pure and
deterministic: a coarse grid (about 32 × 32 cells, square in pixels), subdivided as a quadtree
where F changes sign, vanishes or becomes undefined, down to about one pixel; marching squares
with linear interpolation on the edges, saddle cells decided by the value at the centre. A sign
change without a zero (a pole: `1/(x − 1)`, `tan`) is rejected by a continuity test (|F| at the
interpolated point compared with the corners, and a refinement that does not converge to 0).
Double zeros (`(x − 1)² = 0`, `x² + y² = 0`) are found as local minima of |F| under a tolerance in
pixels where the sign does not change, and drawn (a line; a point drawn as a point). Segments are
stitched into polylines, simplified as in `function-plot.ts`, clipped to the frame. The number of
evaluations is bounded (200 000 by default): `sin(xy) = 0` on a large window is drawn as well as
the budget allows, never frozen.

### 3. Page and state in the address (#421)

`/explorer/calculatrice`, reached from a new **Outils** section of `/explorer` (`CarteLien`,
like the levels; no "coming soon" card), route budget 2 clicks (task `eleve-calculatrice`). The
page is a Server Component; the calculator is one client component as low in the tree as
possible. Desktop: the list of expressions on the left, the grid on the right; phone: the grid
on top, the list below. Each line: a colour swatch (show/hide, `aria-pressed`), the text field,
its KaTeX preview, the result of a calculation (fraction ⇄ decimal), delete; a constant gets the
ADR 0038 slider (extracted as a shared component) with editable bounds and a play button that
respects `prefers-reduced-motion`; an unknown letter gets "Ajouter un curseur a". At most
12 lines. Pan, wheel and pinch zoom about the pointer, buttons, 1-2-5 graduations in French
format, orthonormal grid by default, radians/degrees. Explicit curves are sampled with
`sampleCurve` (ADR 0038) and implicit ones with #419 on the current window.

**The state lives in the address** (`?e=`: lines, colours, window, angle unit), compact
base64url, versioned, validated by zod, updated with `history.replaceState` (no history entry
per keystroke). An unreadable address opens an empty calculator without an error. **Nothing is
stored**, neither on the server nor in the browser: no student data at all. A shared link
reproduces the same expressions, colours and window.

### 4. Reading, remarkable points, keyboard (#422)

Touching a curve places a point that follows it (`(1,5 ; 2,25)`, `≈` when not exact at the
hundredth, `formatReadingValue`); the remarkable points of the selected curve in the window —
zeros, y-intercept, local extrema, intersections with the other visible explicit curves — are
computed numerically (`solveFor` of ADR 0038 and minimisation, `grapheur/points-remarquables.ts`)
and never shown as exact when they are not; poles give no false intersection. The grid is
focusable: Tab chooses a curve, arrows move the point by a graduation step (Shift: fine step),
Enter/Space jumps to the next remarkable point, and a polite live region announces the value
once the point stops (≈ 300 ms). The SVG has a generated title and description. A maths keypad
(44 px keys) inserts at the caret on phones.

### 5. Open a course figure in the calculator (#423)

Under every figure with `functions`, a discreet "Ouvrir dans la calculatrice" link (not
printed) opens `/explorer/calculatrice?e=…` in the same tab: one `f(x) = …` line per function
(same name, tone n → `courbe-n`), one `a = value` line per parameter with the same bounds and
step and the slider's **current** value, the window of the figure's axes. Readings are not
carried over (the calculator has its own). **The `domain` of a function is not carried over**:
the calculator has no domains, and draws the curve over the whole window.

### 6. Course block `calculatrice` (#424)

A new content block (additive, `schemaVersion` unchanged, ADR 0004/0019):
`{ "type": "calculatrice", "consigne", "expressions": [...], "fenetre": { "x", "y" } }`, rendered
as a compact calculator whose lines the student may edit, with "Revenir au départ" and "Ouvrir en
grand"; nothing is saved. It prints as text and the starting curve, is a slide in interactive mode
(ADR 0032), and gives the tutor its instruction and expressions (`ChapitreContentApiImpl`, as for
`calcul`, ADR 0042; no change to the system prompt, the model or `buildRequest()`). Shared rules
(`calculatrice-rules.ts`, check-content and the teacher editor) refuse an expression the engine
cannot read (its French message, the block path), more than 8 expressions, an empty or inverted
window, an instruction over 280 characters.

### 7. Curve colours (#420)

Six semantic tokens `--color-courbe-1` … `--color-courbe-6` in `web/app/tokens.css`, in their own
PR: 1–4 are the maths tones of ADR 0037 (a course curve keeps its colour in the calculator), 5
and 6 are new primitives for both themes; every stroke ≥ 3 : 1 and every coloured text ≥ 4,5 : 1
against `surface-page`, `surface-panel` and `surface-raised`, pairwise ΔE ≥ 20, checked by a test
that reads `tokens.css`. Colour is never the only cue: the swatch and the name stay with the curve.

## Consequences

### Positive

- Students try their own curves, sliders and tangents without leaving Brio, and without any
  third party seeing their traffic.
- One engine for figures, the calculator page, the course block and later the Expo app; the
  language is French maths notation (decimal comma, `racine`, `ax`), not a programming syntax.
- Exact fractions show `5/6` where a calculator would show 0,833333.
- Everything is deterministic and testable without a browser; derivatives are checked against
  numerical ones; the state in the address makes any situation reproducible and shareable.

### Negative / trade-offs

- We maintain a parser, a symbolic differentiator and an implicit-curve tracer: more code than
  an embed, and features (inequalities, parametric and polar curves, lists, regressions) only
  when we build them.
- Letters are single, so `ax` is a·x; a multi-letter name is impossible. A defined function
  name followed by a bracket is a call: `a(x + 1)` is a·(x + 1) only while no `a(x) = …` line
  exists.
- `√` takes the factor right after it (`√x²` is (√x)², as in ADR 0038): the preview shows it.
- The derivative is not displayed (only evaluated); its simplification is light.
- Exact fractions stop at whole powers and perfect squares; `√8 = 2√2` is shown as a decimal.
- A number typed with more than 15 significant digits is read as its first 15 for the fraction.

### Follow-ups

- #419 adds `grapheur/implicite.ts`; #421–#424 build the page, the reading, the figure link and
  the course block on this engine; #420 the tokens.
- Later, out of this epic: inequalities (shaded regions), points and lists, parametric and polar
  curves, a map in Outils.

## Alternatives considered

- **Desmos API.** Rejected: an API key and a commercial licence, a third-party script on every
  page that shows it, the traffic of minors sent to an outside service, and a look we cannot
  bring to our tokens (ADR 0037, Arcade direction).
- **GeoGebra (embed or apps API).** Rejected: non-commercial licence, the same third-party
  script and traffic, the same styling problem.
- **JSXGraph, function-plot, math.js.** Rejected for the reasons of ADR 0038: a runtime
  dependency much larger than the need, a syntax that is not French maths notation, no
  deterministic output for CI, and their own styling.
- **Canvas instead of SVG.** Rejected for now: SVG is what the figures already use, its output
  is deterministic and testable as a model, it is accessible (title, description, focusable
  elements) and prints; at most 12 curves keep the DOM small. Canvas would only pay off with far
  more curves or a heat-map of an inequality.
- **Numerical derivatives** (difference quotients). Rejected: noisy near steep parts, wrong at
  corners, and `f''` compounds the error; the symbolic derivative is exact and as fast once
  compiled.
- **Floating-point results only.** Rejected: `2/3 + 1/6 = 0,8333…` is not what a collège student
  is taught to write; the exact fraction is the expected answer.
