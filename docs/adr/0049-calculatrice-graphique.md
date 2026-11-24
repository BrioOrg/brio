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

| Line                                                                          | Kind (`genre`)                                                                                  |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `y = 2x + 1`, `2x + 1` alone, `f(x) = x² − 3` (`nom: 'f'`), `f'(x)`           | `explicite`: `f(x)`                                                                             |
| `x² + y² = 4`, `xy = 1`, `x = 3`, `x = y²` — any other equality in x and/or y | `implicite`: `F(x, y)` = left − right                                                           |
| `a = 2`, `b = −1,5`, `k = 2π`                                                 | `constante`; `curseur: true` when the value is a number as typed                                |
| `2/3 + 1/6`, `f(3)`, `√2`, `sin(π/6)` — no x, no y                            | `calcul`: `valeur`, and `exact` (a fraction) or null                                            |
| a blank line                                                                  | `vide`                                                                                          |
| anything else                                                                 | `erreur`: a French sentence, the position of the faulty character, the LaTeX if the line parsed |

1. **Parser.** The ADR 0038 parser gains one option, `calculator` (`expression.ts`). Without
   it nothing changes: figures read exactly what they read before, and the existing tests pass
   unmodified. With it: `sin cos tan exp ln log` (decimal log), `π`/`pi` and `e` (Euler's
   number) as constant nodes, every single letter as a variable (`ax` is a·x, as on paper; the
   caller decides what each letter means), calls `f(…)`, `f'(…)`, `f''(…)` to the names the
   caller declares (one lowercase letter other than x, y, e, optionally one digit: `f1`, which
   ADR 0038 figures allow), primes `'`, `’`, `′`, a position on every node, the typed text of a
   number, and the angle unit carried by the `sin`/`cos`/`tan` nodes (`degrees: true`). A known
   unsupported name (`arcsin(`, `sinh(`, `max(`…) is reported as such ("La calculatrice ne
   connaît pas la fonction arcsin.") instead of being read as letters. Functions still need
   brackets (`sin x` is refused, as `sqrt x` was). The computer notation for powers of ten — a
   number written straight before `e`/`E` and an exponent, `1e-13`, `2e5`, `3E+2` — is refused,
   at the `e`, with the textbook writing: "L’écriture 1e-13 n’est pas permise : écris
   1 × 10^(−13)." (it would otherwise read 1·e − 13); `2e`, `2e^x`, `2ex` stay products.
   **`f`, `g` and `h` followed by `(` are always function calls**, as in a French textbook: if
   no line defines g, `g(2)` is "Je ne connais pas la fonction g. Définis-la d’abord, par exemple
   g(x) = x²." Every other letter followed by a bracket is a product (`k(x − 1)`, `a(x + 1)`),
   so `y = a(x − 2)² + b` works with sliders. The messages the calculator inherits from ADR 0038
   take French spacing (a no-break space before `: ; ? !` and inside `« »`) in calculator mode
   only; the figure messages keep theirs, and their tests are unchanged.
   **Bounds**, in calculator mode: a line of at most **500 characters** and **150 nested
   levels** (brackets, functions, signs, powers). Deeper input would overflow the call stack
   further down (sampling, derivatives, LaTeX): a link with `?e=` must never crash the page. Both
   give "Cette expression devient trop longue à calculer.", at the character that goes over.
2. **Lines.** A line has at most one `=`; `< > ≤ ≥ ≠` are refused (inequalities are out of
   scope). Each side is parsed with the other side blanked, so every position is a position in
   the whole line. The left side decides the kind from its text: `f(x) =` is a definition,
   a single letter other than x and y is a constant (whose value may use other constants and
   functions, but neither x nor y), `y =` with no y on the right is an explicit curve; anything
   else is an equality. A function name is one lowercase letter, with an optional digit; its
   letter may not be x, y or e (`x1(x)`, `e2(x)` are refused: they would read x·1, Euler's
   number), and `F(x) = …` is "Écris le nom de la fonction en minuscule : f(x) = …".
   An equality with neither x nor y draws nothing (`2 = 3`), and so does an equality **true at
   every point** (`y = y`, `2 = 2`, `(x + 1)² = x² + 2x + 1`): "Cette égalité est vraie pour tous
   les points : il n’y a rien à tracer." It is tested at seven fixed points, once its constants
   are known, with a strict tolerance: the sides must agree within 10⁻¹² + 10⁻¹² × the largest
   term met (each side and each term of their sums), so only a rounding residue counts as equal;
   `x² = x² + 0,0000000001` is drawn (it holds nowhere). A curve whose two sides differ at one
   of the points is drawn. When the equality holds at every point where it is defined but some
   points are outside its domain (`ln(x) = ln(x)`), the message is "Cette égalité est vraie
   partout où elle est définie : il n’y a rien à tracer."
3. **Resolution.** Lines come in any order. The first line that names a letter owns it; a
   second definition is refused on the second line only. Dependencies are ordered by Tarjan's
   strongly connected components: a cycle (`f(x) = g(x)`, `g(x) = f(x)`) is an error on each of
   its lines and nothing loops (a line that uses itself, `a = a + 1`, reads "Cette ligne utilise
   a pour définir a."); a line using a definition in error is in error too. A letter nobody
   defines is an error that carries `curseurPropose: 'a'`, so the screen offers "Ajouter un
   curseur a".
4. **Inlining and compilation.** A call is inlined: `f(x − 1)` becomes the body of f with
   x − 1 for x, and `f⁽ⁿ⁾(u)` the n-th symbolic derivative of that body. Every curve is then one
   tree in x (and y), compiled once into nested closures (`grapheur/compilation.ts`): sub-trees
   without x or y are folded, common shapes (an operation with a number, a square) get their own
   closure, nothing is looked up at call time. Curves are sampled hundreds of thousands of times
   a frame; measured on a laptop (Node 22), a million evaluations take about 15 ms for
   x² + y² − 4 and about 120 ms for 3x³ − 2x² + x/4 − sin(2x) + √(x² + 1).
   ±Infinity is NaN, as in ADR 0038. **Bounds of a resolved line**: one budget of **50 000
   steps** per line, spent by the inlining and by the derivatives (one step per node built or
   derived), then at most **50 000 nodes** and **1 000 levels** in the tree compiled (the
   closures recurse once per level when called). Past them, the line is "trop longue". A
   `RangeError` thrown while a line is read is caught for that line only, as a last net.
   Derivatives therefore cost work linear in their result, and a line that would need more than
   the budget is refused after a bounded amount of work (before this bound, V1 measured 1,6 to
   4,2 s of a blocked page on f⁽¹⁰⁾ of a product of six functions; the tests count steps, not
   milliseconds).
5. **Derivatives** (`grapheur/derivee.ts`): symbolic rules of a lycée textbook (sum, product,
   quotient, power with a constant exponent, a^v, general u^v = e^(v ln u), chain rule for sin
   cos tan exp ln log √ abs; |u|' = u/|u|, undefined at 0), then a light simplification (0 and 1
   neutral, numbers folded, a number in front), done once on the tree and then locally by each
   node built, never again on a sub-tree. In degrees `sin°(u) = sin(u·π/180)`, so every
   trigonometric derivative takes the factor π/180. A quotient, a power or a function value is
   folded only when the result is a whole number, so that `1/3` and `√2` are never replaced by a
   rounded decimal that the exact fractions would then read. The derivative is evaluated, never
   displayed. Checked against the centred difference quotient on 40 functions.
   A calculation that calls a derivative f⁽ⁿ⁾(a) follows the **derivative-limit theorem**:
   f⁽ⁿ⁻¹⁾(a) must be finite and f⁽ⁿ⁻¹⁾ continuous at a (f⁽ⁿ⁻¹⁾(a ± h) closing in on f⁽ⁿ⁻¹⁾(a)
   as h goes from 10⁻⁵ to 10⁻⁶), checked before the formula is even read: the formula of a
   derivative can have a value where the function has none (1/x, 1/x³ or sin(x)/x at 0, tan at
   π/2). When the formula has no value at a point where f⁽ⁿ⁻¹⁾ is continuous (`f(x) = x|x|`:
   f'(0) reads 0/0), the value shown is the **limit from both sides**. Each side is g
   extrapolated linearly to 0 from the steps (10⁻⁴, 10⁻⁵) and from (10⁻⁵, 10⁻⁶); the two
   extrapolations must **converge** (within 10⁻⁸, relative: −1/h² agrees left and right but
   keeps growing), then the two sides must agree within 10⁻⁹. The value is rounded to 9
   significant digits and never exact (x|x| and x²|x| give f'(0) = 0). Otherwise (`f(x) = x√x`,
   not defined left of 0; `|x|`, a corner; 1/x at 0; f'' of x²|x| at 0, whose f' formula reads
   0/0) the line reads "Je ne sais pas calculer f′(0) avec cette écriture." — never "division
   par zéro", nor a value, which would be false of the function.
6. **Exact fractions** (`grapheur/rationnel.ts`): a calculation line is worked out in BigInt
   fractions when it only uses + − × ÷, whole powers, the square root of a perfect square and
   constants: `2/3 + 1/6` is `5/6`, `(1/2)^3` is `1/8`, `√(4/9)` is `2/3`, `0,1 + 0,2` is
   `3/10`, `10^400/10^399` is `10`. A typed number is read **from its digits**
   (`12345678901234567` stays itself, and so does its preview); a computed one (a slider value)
   from its first 15 significant digits, so `0,30000000000000004` is 3/10. **Bound**: a
   numerator or denominator of at most **2 048 bits**, checked before a power is computed (so
   |exponent| ≤ 2 048 too); beyond, the decimal value is used. The decimal value of a fraction
   is a 64-bit quotient scaled by a power of two, so huge terms give the right double.
   A division by zero (or 0 to a negative power) in a calculation or a constant is refused; a
   curve with a pole is drawn without an error. **`0⁰` is refused** ("0⁰ n’est pas défini."), as
   lycée calculators do; `x^0` on a curve stays 1. A value beyond a double is "Ce nombre est trop
   grand pour la calculatrice." (2^2048, exp(1000), `a = 10^309`), told apart from a value that
   does not exist ("Ce calcul n’a pas de valeur réelle.": √(−1), ln(0), tan(90°)). A decimal
   calculation in which **any term overflows** a double is too large whatever it ends on:
   `2^2048/2^2047` (∞/∞), `2^2048 − 2^2048`, `1/2^2048` (which would read 0) — never "pas de
   valeur réelle", never a made-up value.
   **Decimal results** are rounded to **12 significant digits**, and a result below 10⁻¹² of the
   largest term of a sum or the largest angle met in the calculation is 0: `sin(π)` is 0,
   `√2·√2` is 2, `cos(60°)` is 0,5, while `π/10²⁰` keeps its value. **The snap to 0 hides any
   difference below 10⁻¹² of the largest term**: `π − 3,14159265358979` (3,2·10⁻¹⁵) shows 0. A constant shows its value
   rounded; the lines that use it read the full double. **Known limit**: `1/(√2·√2 − 2)` divides
   by the residue before it is rounded and shows 2 251 799 813 690 000; only symbolic algebra
   (√2·√2 = 2 exactly) would avoid it.
   `formaterRationnel` writes `5/6`, `−5/6` (U+2212), `3`, and groups digits by three from five
   digits on with a narrow no-break space (`12 345`, `.claude/rules/content.md`);
   `latexRationnel` writes `\frac{5}{6}` and groups with `\,`.
7. **LaTeX preview** (`grapheur/latex.ts`, `latexOf`): `1/2x` is `\frac{1}{2}x`,
   `(x+1)/(x−1)` is `\frac{x+1}{x-1}` (the bar replaces the brackets), `x^{2}`, `\sqrt{…}`,
   `\left|…\right|`, `\sin\left(…\right)`, implicit products kept implicit except before a
   figure or a fraction (`2\times 3`), only the brackets the reading needs, French decimal comma
   `2{,}5`, thin-space grouping of long integers, a typed number written from its digits. A
   power of a root keeps its brackets: `√x²` (read (√x)², ADR 0038) is
   `\left(\sqrt{x}\right)^{2}`, never `\sqrt{x}^{2}`, which reads √(x²). A definition line reads
   `f(x)=…`.
8. **Angles**: one type, `ModeAngle = 'radians' | 'degres'`, from the parser to the language.
   In degrees an angle is reduced modulo 360 exactly before conversion, so every multiple of 90°
   gives exactly 0, 1 or −1, and tan is not defined at 90° modulo 180°. In radians tan is not
   defined where |cos| < 10⁻¹² (`tan(π/2)` would otherwise read 1,6·10¹⁶).
9. **Messages** are French sentences (UX writer, gate 2 of #418), with a non-breaking space
   before `:`; they are exported (`MESSAGES_CALCULATRICE`) so the screen and its tests use the
   same text.
10. **Identifiers.** The public API of the engine is French (`analyserLignes`, `LigneAnalysee`,
    `genre`, `formaterRationnel`…), against the convention of English identifiers: the contract
    was set in French by #417 before construction and other PRs are built on it, so the deviation
    is **deliberate** and limited to it. Internal identifiers added since are English where they
    were touched; nothing is renamed wholesale.

### 2. Implicit curves (#419)

`traceImplicite(F, fenetre, versSvg, { budget })` (`grapheur/implicite.ts`, PR #429) returns
`{ chemins, points }`: polylines in SVG coordinates, and isolated points (`x² + y² = 0`). Pure and
deterministic (every loop in a fixed order, tested).

1. **Lattice.** 32 cells along the longer side of the view, as many along the other as fit, so
   cells are about square in pixels; depth ⌈log₂(cell px)⌉, at most 12, so the finest cells are
   ≤ 1 px. Values are cached on an integer lattice (two units per finest cell): a corner shared by
   four cells is evaluated once.
2. **Refinement, breadth first.** A cell is split when its corners and centre change sign,
   include an undefined value but not only undefined values, include an exact 0 but are not all 0,
   or **dip towards zero**: dip = mean of the corners' |F| minus the centre's |F|, and the cell
   is split if min |F| < `DIP_FACTOR` (4) × dip. A bilinear F has no dip, so lines cost nothing
   beyond their own cells.
3. **Budget.** Evaluations are counted (200 000 by default; `options.budget` is capped at
   **1 000 000**), and F reads NaN past it (a hard cap). Refinement may use **80 %**: a level that
   would go over is not started, so an over-dense curve (`sin(xy) = 0` on [−50 ; 50]²) is drawn
   evenly at a coarser level, never frozen. The other 20 % checks crossings and double zeros.
4. **Marching squares** on the leaves, with linear interpolation; saddles decided by the sign of
   the centre, a centre exactly 0 joining all four crossings (the X of `x² = y²`).
5. **Poles.** A crossing is kept only if F tends to 0 there: up to **3 regula-falsi steps** on
   the edge, accepted as soon as **|F(p)| < min(|F(a)|, |F(b)|)**. Around a simple pole (1/u,
   tan) |F(p)| is never below the smaller end, so no vertical line crosses an asymptote; a jump
   without a zero fails the same way.
6. **Double zeros** (`(x − 1)² = 0`, `x² + y² = 0`): lattice corners without a sign change where
   |F| is a local minimum along x or y, the neighbours on that axis of the same sign, the slope
   putting the zero within half a step, and no axis neighbour of the opposite sign. Kept points
   are linked into one-point-wide lines; a cluster at most 2 steps wide is one point in `points`.
7. **Polylines** are stitched by the identity of their ends (not rounded coordinates), clipped
   to the frame (Liang–Barsky) and simplified by **Ramer–Douglas–Peucker at 0,08 px**, the
   tolerance of `function-plot.ts` (its greedy pass is quadratic on the long straight runs a grid
   produces).

Known limits: a zero lying only on the edge of the domain (`√(1 − x² − y²) = 0`) is not found;
a curve ending at the edge of its domain stops ≤ 1 px short; an isolated cone point
(`|x − a| + |y − b| = 0`) is not found; an F within a fraction of a pixel of 0 without a zero
(`(x² + y² − 4)² + 10⁻⁶`) is drawn, as by any sampling plotter; where the budget stops refinement
a curve may show a small gap at a T-junction; `tan(x) = 0` costs about 100 000 evaluations on
800 × 600 px.

**Merge order**: #427 (this ADR) before #429, which adds `implicite.ts` and its exports after the
language's in `index.ts`.

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

**Gate 5 of #421 (PR #439)** settled the following:

- **Numbers on screen** (`grapheur/nombres.ts`): French comma, U+2212, digits grouped by three
  with a narrow no-break space **from five digits on** (1234, 12 345), the same rule for results,
  graduations, sliders and KaTeX; never an exponent. A decimal result has two decimals, or three
  significant digits under 0,1. It is written "=" only when what is shown is the value itself:
  with the exact fraction, rounding is done on the fraction in BigInt, half up in absolute
  value (0,995 → ≈ 1); without it, a double is "=" only if it is exactly what is written and has
  fewer than 12 significant digits (the engine rounds decimal calculations to 12). No absolute
  threshold zeroes a small value: `10^(−13)` is 0,0000000000001.
- **A slider** writes its line with the shortest decimal that reads back as the same value,
  with no more decimals than its step and minimum (`a = 0,0000003`, never `3e-7`). Its bounds stay
  within ±10⁶, with 0 < step ≤ max − min, in the address as in the fields.
- **Language, calculator mode only**: digits grouped by three with a space (normal, no-break,
  narrow no-break, thin) are one number (`1 000`, `12 345 678,5`); the ADR 0038 figure language is
  unchanged. A negative base with a non-integer exponent in a calculation (`(−8)^(1/3)`) says
  "La puissance d’un nombre négatif n’est définie ici que pour un exposant entier." (curves are
  simply undefined there).
- **No freeze**: the implicit curves of a view share one budget of 200 000 evaluations. While
  the plane is dragged, pinched or wheeled, a trace that took more than 8 ms is not redone: the
  curves already traced are moved with an SVG transform and traced again once the gesture stops;
  at most one new window per frame. Each curve's geometry is cached by what it depends on (its
  text, the angle unit, the definitions and slider values it uses), so a colour, a stroke or
  another line never retraces it. A pixel that overflows (`exp(exp(x))`) is a gap in the path,
  never NaN; `sampleCurve` draws every finite point as before.
- **Identifiers** of the calculator code are French (`fenetre`, `modeleVue`, `ligne`), unlike the
  rest of the code base: they follow the engine of #418 and the screen's vocabulary. An accepted
  exception, limited to `grapheur/` and `components/calculatrice/`.

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

### 8. Typeset input, d/dx, instant slider suggestion (#417)

- **MathLive field.** A line is edited in typeset form in a MathLive `<math-field>` (npm
  `mathlive`, MIT): `/` stacks a fraction, `^` raises an exponent, `sqrt` draws a root; the KaTeX
  preview under the field is gone. No in-house WYSIWYG maths editor exists, and writing one is far
  beyond this need. MathLive is imported dynamically in an effect (a custom element cannot be
  rendered on the server), so it loads only on the calculator's routes; until it is loaded, or if
  it fails, the line is the plain text field. Its sounds and menu are off, inline shortcuts are
  limited to the engine's words (`pi`, `sqrt`, `sin`…, `<=`), `smartSuperscript` is off (10^12),
  the decimal separator is the comma, the locale French; its fonts are KaTeX's, already on the
  page. Its look comes from the tokens through its CSS custom properties and `::part()`; its
  virtual keyboard stands for the maths keypad: its own toggle on a touch screen, a « Clavier »
  button with a mouse.
- **LaTeX → text.** `latexVersTexte` (`grapheur/latex-vers-texte.ts`, pure) writes the field's
  LaTeX in the engine's text. The state and the address keep the **text**, so earlier links still
  open; a line is loaded into the field from the engine's LaTeX of it, or its raw text when it
  does not read. `\sqrt[n]` becomes `∛`, which the engine refuses with its message; an unknown
  command becomes `?`, never a silent change.
- **d/dx.** `d/dx(EXPR)` (in the field `\frac{d}{dx}\left(EXPR\right)`) is the symbolic derivative
  of any expression with respect to x, nested or not, next to the `f'` notation. The parser
  (calculator mode) recognises only that exact prefix — `d` stays an ordinary letter (`d = 2`,
  `dx` is d·x) — and replaces the node by `deriver(EXPR)` at once; the root keeps the operand
  (`ddx`) for the preview, which writes `\frac{d}{dx}\left(…\right)`. Other letters are constants,
  a call `f(u)` becomes `f'(u)·u'`, resolved as before.
- **Instant suggestion.** A line whose only error is an undefined letter shows « La lettre a n'est
  pas définie. » and « Ajouter un curseur a » while it is being typed; other errors still wait for
  the pause or the field to be left.

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
  exists, and `f`, `g`, `h` followed by a bracket are always calls (`g(x + 1)` is never g·(x + 1)).
- Bounds (500 characters, 150 levels, 50 000 steps and nodes, 1 000 levels once resolved) refuse
  a few lines a student could type on purpose; they keep a shared link from crashing the page.
- `√` takes the factor right after it (`√x²` is (√x)², as in ADR 0038): the preview shows it.
- The derivative is not displayed (only evaluated); its simplification is light.
- Exact fractions stop at whole powers and perfect squares; `√8 = 2√2` is shown as a decimal.
- Rounding to 12 significant digits hides the residues of doubles in a result, not inside a
  calculation: `1/(√2·√2 − 2)` shows a huge number instead of an error (§1.6).
- A calculation on a derivative that its formula cannot compute may show a limit (≈), not an
  exact value; a function with no limit there gets a message, not a number.

### Follow-ups

- #419 adds `grapheur/implicite.ts` (PR #429, merged after #427); #421–#424 build the page, the
  reading, the figure link and the course block on this engine; #420 the tokens.
- The CI mutation job does not cover `packages/content`, where this engine lives (#430, a human
  decision); mutation scores so far come from local runs.
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
