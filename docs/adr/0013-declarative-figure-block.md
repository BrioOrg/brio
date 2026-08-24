# 0013 — Declarative figure block rendered as SVG

- **Status**: Accepted
- **Date**: 2026-08-24
- **Deciders**: Pierce

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
left to individual callers.

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
