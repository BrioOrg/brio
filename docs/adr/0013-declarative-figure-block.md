# 0013 — Declarative figure block rendered as SVG

- **Status**: Accepted
- **Date**: 2026-08-24
- **Deciders**: Pierce
- **Amended**: 2026-10-08 (#214) — orthogonal repère (`axes`), hidden points, polylines,
  French number formatting; a repère gives each axis its own scale (see "Amendment (#214)")
- **Amended**: 2026-10-08 (#215) — dashed lines and solids in perspective cavalière (`solids`);
  the renderer, not the author, decides which edges are hidden (see "Amendment (#215)")
- **Amended**: 2026-10-08 (#226) — cube assemblages described by their plan coté, drawn as shaded
  visible faces (see "Amendment (#226)")

## Context

Eleven of the twenty-two planned 6e chapters (themes 2 and 3 — geometry,
perimeters, areas, volumes) cannot be written without a way to include
mathematical figures. The only existing block type that carries visual content
is `image`, which renders a bracketed asset path pointing at a file that does
not exist.

Generating figures as raster images is not viable: a model asked to draw a
right triangle produces approximate angles and visually inconsistent
proportions, and the error is invisible in content review. The alternative is a
**declarative specification**: the author (or the model) emits named points
with coordinates and geometric primitives; a single renderer turns that into
SVG. Correctness is then a property of the data, checkable by a script, not a
matter of trust.

The key insight is that logical math coordinates are also a prerequisite for
CI validation: verifying that a marked right angle genuinely measures 90° at
the given coordinates requires that the coordinates be mathematical facts, not
layout hints. A pixel-based format would make that check a tautology.

Number lines (needed by theme 1 — decimals, fractions) are also handled by
the same block, because they share the same rendering pipeline and the same
correctness requirements.

## Decision

Add a `figure` block to the content schema. A `figure` block carries:

- A required `alt` text (no figure without a textual equivalent).
- An optional `caption` (richText).
- A `spec` object with:
  - An optional `coordinateSpace` (`{ xMin, xMax, yMin, yMax }`). When
    absent, the renderer computes the bounding box from all point
    coordinates and adds a 15 % margin. Explicit `coordinateSpace` is for
    figures where the viewport must extend beyond the plotted points (e.g.
    a 0-to-10 number line with marks only at 3 and 7).
  - `points`: named points with `(x, y)` logical coordinates and an
    optional label placement hint.
  - `segments`, `polygons`, `circles`, `angleMarks`, `lengthMarks`,
    `labels`: the geometric primitives needed at collège level.
  - `numberLines`: a shorthand for a graduated axis with derived tick
    positions; avoids enumerating 101 points for a 0-to-10 number line
    by 0.1 steps.

A pure function in `packages/content` converts a `FigureSpec` into a
`DrawingModel` (resolved SVG coordinates, pre-computed decorators). The
React SVG component in `web` maps that model to SVG elements. Both are
deterministic: the same spec always yields the same drawing.

The renderer always preserves the aspect ratio of the coordinate space and
inverts the Y axis (math coordinates have Y increasing upward; SVG has Y
increasing downward). These invariants are enforced in the renderer, not
left to individual callers. *Amended by #214: a figure with `axes` gives
each axis its own scale; see below.*

## Amendment (#214) — orthogonal repère

**Context.** The 5e chapters on the 2026 cycle-4 programme read and place
points in a repère, read curves and draw proportionality graphs. The block
could not draw a graduated vertical axis, a grid or a curve, so chapters
faked them: a `numberLines` for the x axis, a `segment` for the y axis with
free `labels` for its numbers, and curves made of segments between
blank-named points (`" "`, `"  "`…) that still showed their dot. Number-line
labels came from `String(value)`: "-3" and "0.5" instead of "−3" and "0,5".

**Decision.** Additive schema changes, `schemaVersion` unchanged (ADR 0004):

1. **`spec.axes`** `{ x, y, grid? }`, each axis `{ from, to, step,
   labelEvery?, title? }`. The renderer draws two graduated axes crossing at
   the origin, with arrows and titles. Ticks fall on the multiples of `step`,
   so they are aligned on the origin. `0` must lie in `[from, to]` on both
   axes; cut or offset axes are out of scope.
2. **One scale per axis.** A repère is orthogonal, not necessarily
   orthonormal: x and y are scaled independently and the repère fills the
   frame (a price axis to 200 € next to a mass axis to 5 kg). This relaxes the
   aspect-ratio invariant above, for figures with `axes` only. The same margin
   is kept on all four sides, so **equal spans give equal scales**.
   Because CI measures right angles, equal lengths and circles in the data,
   `check-content` rejects `angleMarks`, `lengthMarks` and `circles` in a
   repère whose spans differ: the drawing would not show what CI checked.
3. **The axes define the visible area.** `coordinateSpace` and `numberLines`
   are rejected alongside `axes`.
4. **`grid: true`** draws a line at every `step` of each axis, in the muted
   line colour.
5. **A single "0"** is written below-left of the origin; neither axis
   repeats it. A point with a visible name at (0, 0), usually O, labels the
   origin instead of the "0".
6. **`dot: false` / `showName: false`** on a point hide its dot or its name,
   for points that only build something (axis ends, curve vertices, bar
   corners). Blank point names, the previous workaround, are rejected by
   `check-content`.
7. **`spec.polylines`** `[{ points: [...] }]` draws a broken line without
   declaring each segment.
8. **French formatting** of every number the renderer writes (number-line
   ticks and axis ticks): true minus sign, decimal comma. Author text (point
   names, labels, mark labels) is printed as written. On number lines, a
   mark's label now sits **above** the line, the numbers below it.

**Consequences.** Repères are authored, validated and rendered like other
figures. A repère whose spans differ cannot carry geometric marks; a figure
that needs both (symmetry in a repère, a right angle between two lines) uses
equal spans. Letting a student *place* a point in a repère is a different
exercise type and stays out of scope.

## Amendment (#215) — perspective cavalière

**Context.** The 5e chapter `solides-volumes` (cycle-4 programme of 2026) asks students to
read and draw a pavé, a cube, a prisme droit and a cylindre in perspective cavalière, and to
match a solid with its patron. Every line the block drew was solid, so a cube would have shown
twelve solid edges: the central rule of the convention, hidden edges dashed, would have been
taught wrong. The chapter had no drawing at all. Writing the receding edges by hand (angle,
reduction coefficient) is error-prone, and CI cannot tell which edges should be hidden.

**Decision.** Additive schema changes, `schemaVersion` unchanged (ADR 0004):

1. **`style: "dashed"`** on `segments`, `polylines` and `polygons` (default `"solid"`). A single
   dashed side of a polygon is drawn as a segment.
2. **`spec.solids`**, a high-level element the drawing model expands into edges:
   - `pave` (`width`, `height`, `depth`), `cube` (`edge`), `prisme` (`base`: a convex polygon,
     the front face in true size, plus `depth`), `cylindre` (`radius`, `height`);
   - placed by `x`, `y`: the front bottom-left vertex, the first vertex of a prism's base, or the
     centre of a cylinder's lower base;
   - `angle` (default 45°) and `reduction` (default 0.5) of the receding edges;
   - `names`: optional vertex names, front face first, then the back face in the same order
     (ABCD then EFGH for a pavé). They are written next to the vertices, hidden ones included.
     They are not `points`: other elements cannot reference them.
3. **The renderer decides what is hidden.** A point at depth z is drawn at
   `(x + z·k·cos α, y + z·k·sin α)`. A lateral face is visible when its outward normal points
   along the receding direction; the front face is always visible, the back face never. An edge
   is dashed when none of its faces is visible. The author gives dimensions, never a dashed edge
   of a solid, so a wrong convention cannot be written.
4. **The cylinder is drawn upright**, as in textbooks: two ellipses of horizontal semi-axis r and
   vertical semi-axis r·k·sin α, the two outer generators, and the back half of the lower base
   dashed. This is the conventional drawing, not the exact oblique projection of a horizontal
   circle (a slanted ellipse). No public ellipse element: no figure needs one outside a cylinder.
5. `check-content` rejects non-positive dimensions, a reduction outside ]0, 1], an angle outside
   ]0°, 180°[ or equal to 90°, a non-convex or degenerate prism base, and names in the wrong
   number, duplicated, blank or shared with a point. `solids` cannot sit in a repère or next to a
   number line, which use their own scales.

**Consequences.** Solids are authored as data, checked by CI and rendered the same way on web and
mobile. A patron is still drawn with polygons. Out of scope: arcs and half-disks, cube assemblages
(6e `espace-solides`), pyramids and cones (4e), length marks on a solid's edges. *Cube assemblages:
amended by #226.*

## Amendment (#226) — cube assemblages

**Context.** The 6e chapter `espace-solides` is about assemblages of unit cubes
(`c3.geo.espace.visualiser-assemblages`): reading a plan coté, counting cubes, finding the views
from above, the front and the side. It described each assemblage by a table and sentences; none
was drawn. `solids` draws one solid with its hidden edges dashed, but an assemblage follows another
convention: hidden cubes are not drawn at all, the cubes in front simply cover those behind.

**Decision.** Additive schema changes, `schemaVersion` unchanged (ADR 0004):

1. **`kind: "assemblage"`** in `solids`, described by **`heights`**, its plan coté: one row per
   row of cubes, back row first, cells from left to right, each the number of unit cubes stacked
   there. Cubes have side 1; `x`, `y` place the front bottom-left corner of the front row. `angle`
   and `reduction` work as for the other solids; there are no `names`.
2. **Visible faces only, painted back to front.** The drawing model keeps the faces the viewer can
   see (front, top, and the side the receding edges point to), drops a face pressed against a
   neighbouring cube, and orders the rest back row first, then bottom to top, then away from the
   visible side. Each face is filled, so it covers whatever lies behind it. In a cavalier
   projection this order is exact for unit cubes on a grid: two faces that overlap are always in
   it from far to near. Nothing is dashed.
3. **Shaded faces**, as in textbooks: one shade for the tops, the fronts and the sides, from three
   semantic tokens (`--color-cube-top`, `-front`, `-side`, added on their own beforehand). The fill
   does not depend on what lies behind the figure, and the volume reads at a glance. Edges stay in
   the ink colour; the shades change with the theme so they clear 3 : 1 against it.
4. **The views are not drawn.** Drawing the top, front or side view of an assemblage would answer
   the "what do you see from the front?" exercises the chapter is built on; an author who needs a
   view draws it with polygons.
5. `check-content` rejects a plan coté that is empty, not rectangular, has a height that is not a
   whole number ≥ 0, or holds no cube, and `names` on an assemblage. The rule that a solid cannot
   sit in a repère or next to a number line covers assemblages.

**Consequences.** Assemblages are authored as data, checked by CI and drawn the same way on web
and mobile, next to their plan coté. An assemblage in perspective shows most of its front view, so
authors keep it out of exercises that ask for that view (recipe in `content/AUTHORING.md`). Out of
scope: computed views, length marks on an assemblage, cubes that are not resting on a cell below
(every stack starts on the table).

## Consequences

### Positive

- Geometry figures can be authored, validated by CI, and rendered without
  any external dependency or asset pipeline.
- Correctness is verifiable: the CI script checks that declared right angles
  measure 90° and that equal-length markings refer to segments with equal
  Euclidean length.
- The same spec can be rendered by web and mobile via the same pure function;
  only the SVG output layer differs.
- Declarative figures are review-friendly: a diff in `theoreme-de-pythagore.json`
  shows exactly what changed in the geometry.

### Negative / trade-offs

- Authors must supply explicit coordinates. For complex figures this is
  non-trivial; the intended workflow is model-assisted authoring followed
  by human verification.
- SVG output is not interactive (no drag, no construction tools). This is
  intentional: JSXGraph was considered and deferred (see Alternatives).
- Circles can only be specified by center + named point or center + radius,
  not by equation. This covers all collège use cases.

### Out of scope for this ADR

- Arcs (compass-construction figures): deferred until médiatrice/bisectrice
  chapters are authored.
- Parallel-coding marks (arrows on parallel sides): deferred until the
  positions-relatives chapter.
- 3D solids and nets: chapter `espace-solides` remains blocked and is noted
  as such in the 6e README. *Amended by #215: prisms and cylinders are drawn by `solids`; cube
  assemblages remain out of scope.* *Amended by #226: cube assemblages are drawn too.*

## Alternatives considered

### JSXGraph (interactive figures)

JSXGraph is a mature browser library for interactive geometry. It was
rejected because:
- Interactivity (drag, construction) is not a requirement today. Designing
  for hypothetical future interaction at the cost of immediate complexity is
  premature.
- It introduces a runtime dependency, conflicts with the "no new runtime
  dependency" constraint for rendering.
- A JSXGraph figure cannot be validated by a CI script without a headless
  browser.
- The same library is not usable on Expo mobile without a WebView shim.

### Committed static SVG files

Authoring SVG files by hand and committing them was rejected because:
- A model asked to generate an SVG for a right triangle produces
  visually approximate angles. The error is invisible in a text diff.
- Static SVGs cannot be validated for mathematical correctness.
- SVG source is verbose and error-prone to review.
- Any change to style (stroke width, colour) requires editing every figure file.
