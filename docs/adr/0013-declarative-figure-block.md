# 0013 — Declarative figure block rendered as SVG

- **Status**: Accepted
- **Date**: 2026-08-24
- **Deciders**: Pierce
- **Amended**: 2026-10-08 (#214) — orthogonal repère (`axes`), hidden points, polylines,
  French number formatting; a repère gives each axis its own scale (see "Amendment (#214)")

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
  as such in the 6e README.

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
