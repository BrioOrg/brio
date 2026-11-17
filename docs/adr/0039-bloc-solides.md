# 0039 — Solid block the student can turn (`solid`)

- **Status**: Proposed
- **Date**: 2026-11-17
- **Deciders**: Pierce Broudin

## Context

Cycle 4 asks students to represent solids and to relate a drawing to the solid
(`c4.geo.espace.representer`, `c4.geo.espace.representer-perspective`), to compute the volume of
a pyramid, a cone and a ball (`c4.gm.volumes.pyramide-cone`, `c4.gm.volumes.boule`), to identify
plane sections (`c4.geo.espace.sections`) and to locate a point on a sphere by latitude and
longitude (`c4.geo.reperage.espace`). Content can only draw a frozen perspective cavalière
(`figure.solids`, ADR 0013, amendments #215 and #226): a pavé, a cube, a prism, a cylinder.
There is no pyramid, no cone, no ball, no section, no sphere with its parallels; and a hidden
edge never becomes visible, which is precisely what a student who cannot "see in space" needs
to watch happen.

## Decision

Add a `solid` block to the content schema, separate from `figure`. Additive change,
`schemaVersion` unchanged (ADR 0004, ADR 0019 §2).

```json
{ "id": "solide-cone", "type": "solid", "kind": "cone",
  "radius": 2, "height": 4.5, "names": ["O", "S"],
  "section": { "parallelTo": "base", "at": 1.5 },
  "alt": "Un cône de sommet S et de base le disque de centre O, coupé par un plan parallèle à sa base." }
```

1. **Seven kinds**, in the vocabulary of `figure.solids`: `pave`, `cube`, `prisme` (front face in
   true size, extruded in depth, as in #215), `cylindre`, and the new `pyramide` (a convex base
   seen from above, a height, an optional foot of the apex, default the base's centre), `cone`
   and `boule`. Dimensions are in the chapter's units; the renderer scales them to the frame.
2. **Names.** A polyhedron names its vertices in the order of `figure.solids` (front face, then
   the back face; a pyramid's base, then its apex). A cylinder names the centres of its bases, a
   cone its base centre then its apex, a ball its centre; a named centre gets a dot, and the axis
   of a named cylinder or cone is drawn, dashed, since it is inside. Each name sits in the widest
   free angle between the strokes at its point, recomputed for every view, so it never lies on an
   edge while the solid turns.
3. **Hidden lines, like the textbook.** Every solid is convex, so a stroke is seen when one of
   the faces it borders faces the viewer. Cylinders and cones are 64-sided meshes whose lateral
   edges are drawn only on the outline; a ball is a circle, and a curve on it is seen where its
   normal faces the viewer. Hidden strokes are dashed exactly like the cavalière solids
   (`5 4`). Faces turned to the viewer get a very light flat fill, one of the three
   `--color-cube-*` shades by orientation: no gradient, no lighting effect.
4. **Sections.** `section: { parallelTo, at }`: parallel to the base (all but the ball), to the
   front or left face (pavé, cube), or to the axis (cylinder, a plane facing the viewer at
   distance `at` from the axis). A ball's section is a plane parallel to the equator at distance
   `at` from the centre. The section is computed from the solid, never authored: each of its sides
   lies on a face and is seen when that face is. It is the one coloured object of the block
   (`accent`, faint fill), as colour must stay rare and meaningful.
5. **Sphere.** `equator`, `parallels` (latitudes), `meridians` (longitudes, pole to pole) and
   `points` by `latitude` and `longitude`, north and east positive, longitude 0 facing the
   viewer. A point on the far side keeps its name and gets a muted dot.
6. **Interaction, not animation.** Orthographic projection. The solid opens on the textbook view
   (from the front, a little from the right and above: fuyantes near 40° and halved, as in
   cavalière). It turns by dragging (mouse, pen, finger), with a short coast after a flick
   (time constant `--duration-slow`), never under `prefers-reduced-motion`, and by the arrow
   keys. « Revenir à la vue de départ » brings it back. No automatic rotation. Printing shows the
   starting view. On touch, a gesture that starts vertically scrolls the page; one that starts
   horizontally turns the solid in both directions. Moving the pointer never re-renders React:
   the model is built once per spec and each frame sets a fixed set of SVG attributes.
7. **Accessibility.** `alt` is required, as for `figure` and `chart`, and describes the starting
   view. The drawing is focusable; its controls and instructions are in French.
8. **Same pipeline as figures.** `packages/content/src/solid.ts` builds the 3D geometry and
   projects it to path data; `solid-rules.ts` holds the rules below, read by `check-content` and
   by the teacher editor, which words them in French. Mobile reuses both.
9. **CI and publication.** `check-content` rejects: a non-positive dimension; a prism or pyramid
   base that is not a convex polygon of 3 to 12 vertices; a wrong number of names, a blank or
   repeated name (sphere points included); `equator`, `parallels`, `meridians` or `points` on
   anything but a ball; a latitude outside [−90°, 90°] (]−90°, 90°[ for a parallel), a longitude
   outside [−180°, 180°], more than 12 parallels or meridians; a section plane the kind does not
   have, a ball section with `parallelTo`, or a section not strictly inside the solid. The
   publication validator requires `alt`.

## Consequences

### Positive

- Pyramids, cones, balls, sections and the terrestrial sphere can be shown at all, and drawn the
  same way on every device; the author never computes an ellipse or a hidden edge.
- A student can turn a solid until a hidden edge comes into view, then put it back where the
  book has it.
- No dependency: the drawing stays a thin-stroked SVG, themed by tokens, testable in Vitest.

### Negative / trade-offs

- The rotating view is orthographic, not cavalière: the front face is not in true size. The
  static `figure.solids` stays the way to teach the cavalière conventions; the chapter says so.
- Only convex solids: no assemblage of cubes, no hollow or composite solid, no truncated cone.
- A section is parallel to a face, the base or the axis; an oblique plane (through an edge's
  direction, e.g. a pavé cut along a diagonal) needs an amendment.
- Two names can overlap when their points coincide in a view (straight from above); the
  student turns the solid a little.
- A solid cannot sit inside an exercise prompt; an exercise about it follows the block.

## Alternatives considered

- **three.js (or react-three-fiber).** Rejected: a WebGL scene renders shaded surfaces, not the
  dashed hidden edges of a French textbook; hidden-line drawing would have to be rebuilt on top of
  it anyway. It adds about 150 kB to a chapter, needs a canvas (no SVG text, no tokens, a poor
  print), no deterministic output to check in CI, and a WebView on Expo.
- **Extending `figure.solids`.** Rejected: a figure is a static 2D drawing in logical coordinates
  that CI checks as geometry, shared with points, segments and marks that mean nothing once the
  solid turns. A rotating solid needs 3D coordinates and its own interactive component.
- **Oblique (cavalière) projection while turning.** Rejected: turning a solid under an oblique
  projection shears it (a ball becomes an ellipse); only the starting view would look right.
- **Pre-rendered views or a video.** Rejected: not authorable as data, heavy, and not
  accessible.
