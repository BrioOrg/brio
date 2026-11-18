# 0041 — Plane transformations, vectors and lines in the `figure` block

- **Status**: Proposed
- **Date**: 2026-11-17
- **Deciders**: Pierce Broudin

## Context

The cycle-4 programme builds a whole thread on plane transformations: symétrie centrale in 5e
(`c4.geo.transformations.symetrie-centrale`, `.construire-demi-tour`), then translation, rotation
and homothétie (`c4.geo.transformations.translation`, `.rotation`, `.homothetie`,
`.conservation`), which carry Thalès (`c4.geo.thales.*`), similar triangles
(`c4.geo.triangles.semblables`) and enlargements (`c4.gm.agrandissement.effets`). 6e opens it with
the symétrie axiale.

The `figure` block (ADR 0013) knows none of it. The 6e `symetrie-axiale` and 5e
`symetrie-centrale` chapters compute every image by hand (A', B', C' typed as points with an ASCII
apostrophe), draw the axis (d) as a segment between two hidden points, and show no construction:
no coded perpendicular, no coded midpoint. Nothing draws a translation, a rotation or a homothety,
a vector arrow, a line crossing the whole figure, or a ray. A hand-computed image is exactly the
error ADR 0013 set out to remove: wrong coordinates are invisible in review.

## Decision

Extend `figure.spec` with four arrays. Additive change, `schemaVersion` unchanged (ADR 0004,
ADR 0019 §2).

```json
"spec": {
  "points": [ … "A", "B", "C", "P", "Q" … ],
  "polygons": [{ "vertices": ["A", "B", "C"] }],
  "lines": [{ "through": ["P", "Q"], "label": "(d)" }],
  "transformations": [
    { "kind": "symetrie-axiale", "axis": ["P", "Q"], "source": ["A", "B", "C"],
      "show": { "construction": true } }
  ]
}
```

1. **Five transformations.** `symetrie-axiale` (`axis`: two points), `symetrie-centrale`
   (`center`), `translation` (`from`, `to`: the vector), `rotation` (`center`, `angle` in degrees,
   counter-clockwise when positive), `homothetie` (`center`, `ratio`, negative allowed). Each has a
   `source`: the points whose images are taken.
2. **The renderer computes the images and names them.** A → A′ with a true prime (U+2032), A′ →
   A″; `suffix` replaces the prime (A → A1). The image figure is every polygon, segment, polyline
   and circle whose points are all in the source. Image names are points: other elements may
   name them ([AA′], a vector to B′), and a later transformation may take them as its source
   (composition). A point that is its own image (on the axis, the centre) gets no second name.
3. **Construction marks are opt-in.** `show.construction: true` (or a list of source points) adds
   the textbook construction: the dashed perpendicular to the axis with its right angle and two
   equal halves coded; the dashed segment through the centre, both halves coded; for a rotation
   the dashed radii, the compass arc and the angle at the centre; for a homothety the dashed line
   through the centre, the point and its image; for a translation a dashed arrow parallel to the
   vector. Each point gets its own code (1, 2, 3 ticks), so equal halves pair up at a glance.
4. **Colour carries the correspondence.** Source in ink, image in `--color-tone-1` (the maths tone
   of ADR 0037: an image *is* the correspondence it shows), construction in `ink-muted`. Nothing
   else. In print the image is still told apart by its primes.
5. **Vectors** (`vectors: [{ from, to, label? }]`): a 1.5 px shaft that stops at a filled
   arrowhead about five strokes long, so the tip stays sharp. The name is TeX typeset by KaTeX
   (`\vec{u}`, `\overrightarrow{AB}`), as in the text, beside the arrow on the side away from the
   figure.
6. **Lines and rays.** `lines: [{ through: [A, B], label? }]` draws the droite (AB) across the
   whole canvas (the plot area in a repère), its name ("(d)") near the far end on its left.
   `rays: [{ from, through }]` draws [AB) from A to the edge. Both take `style: "dashed"`.
7. **Motion in the interactive mode only (ADR 0032).** A figure with transformations reveals as
   steps, like a `steps` block: the source alone, then each image on → / « Étape suivante ». A
   copy of the source moves onto the image — it slides, turns about the centre (a half-turn for
   the symétrie centrale), scales from the centre, or folds over the axis — then the names and
   construction marks fade in. The motion is an affine map interpolated from the identity,
   computed in `@brio/content` (`svgAffineAt`) and set on an SVG group; it lasts `--duration-finale`
   (900 ms) on the `standard` curve, and `terminer()` ends it. Reduced motion: the image appears
   at once; reading mode and the editor: everything is there.
8. **Rules, shared.** `checkFigureGeometry` (in `packages/content/src/transformations.ts`, read by
   `check-content` in English and the teacher editor in French, as `chart-rules.ts` is) rejects:
   an unknown point (images count as points); two points that define no direction (axis, line,
   ray, vector); an empty or repeated source; an identity (null vector, angle 0, ratio 1) or a
   ratio of 0; an angle outside ]−360°, 360°[; an image name already taken; construction points
   outside the source; a symmetry axis that is not drawn (as a line or a segment); construction
   marks in a repère whose axes have different scales (right angles and equal lengths would be
   false on screen). The JSON schema gives the shape per kind; the backend validates it with the
   schema (`ContentSchemaValidator`).
9. **One pipeline.** `buildDrawingModel` adds hidden image points to the figure (so the frame fits
   them), then builds each transformation as ordinary sub-specs drawn in the same frame: image,
   construction, and the ghost that moves. The web renders them with the same primitives.

## Consequences

### Positive

- Images and construction marks are computed, so they are right; the chapter author writes the
  source, the centre or the axis, as the lesson does.
- The 6e and 5e symmetry figures now show the construction the method describes, and the
  interactive mode shows the half-turn and the fold instead of asserting them.
- Translations, rotations, homothéties, vectors and Thalès configurations (triangle and butterfly,
  with lines and rays) can be drawn for the cycle-4 chapters still to write.

### Negative / trade-offs

- An element of the base figure that names an image (a segment [AA′]) is drawn from the first
  step in the interactive mode, before the image appears.
- Image names are placed automatically (away from the image figure, or from the centre or axis);
  there is no per-image placement override yet.
- The rotation's angle mark has no value written; the caption states the angle.
- The morph borrows `--duration-finale` (900 ms): no motion token says "a figure transforms". A
  dedicated `--duration-figure-morph` token belongs in its own PR if the timing needs tuning.
- Prose still writes A' with an ASCII apostrophe in places; figures now write A′.

## Alternatives considered

- **Hand-computed images (status quo).** Rejected: the error ADR 0013 exists to avoid, and no
  construction marks.
- **Expanding transformations at authoring time** (a script writing the points into the JSON).
  Rejected: the spec would lose what it means (the axis, the centre), the editor could not change
  the centre and see the image follow, and the motion would have nothing to interpolate.
- **A dynamic-geometry engine** (JSXGraph, GeoGebra applet). Rejected for the reasons of ADR 0013:
  a large runtime dependency, its own styling, no deterministic output to check in CI, no Expo
  reuse.
