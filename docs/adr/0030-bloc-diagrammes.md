# 0030 — Statistical chart block (`chart`)

- **Status**: Accepted
- **Date**: 2026-10-08
- **Deciders**: Pierce Broudin

## Context

The 2026 cycle-4 programme asks 5e students to **read and produce** bar charts, pie charts and
line graphs (`c4.ogd.statistiques.lire-representations`, `c4.ogd.statistiques.representer-donnees`);
6e `donnees-tableaux` (`c3.ogd.donnees.*`) and the brevet annales need the same. No block draws
one. The 5e `statistiques` chapter fakes a bar chart with rectangular `polygons` in a `figure`
(ADR 0013): a dot on every bar corner, category names as free labels staggered on two heights, a
vertical axis with numbers but no graduations. A pie chart cannot be drawn at all, so the chapter
asks for the angle of a sector without ever showing one.

A chart's data are not geometric. Bars, sectors and axis graduations follow from a list of
categories and values; asking the author for coordinates would put the arithmetic in the content,
where it can be wrong, instead of in the renderer.

## Decision

Add a `chart` block to the content schema, separate from `figure`. Additive change,
`schemaVersion` unchanged (ADR 0004, ADR 0019 §2).

```json
{ "id": "chart-sports", "type": "chart", "kind": "bar",
  "title": "Sport préféré des élèves de 5e B",
  "xLabel": "Sport", "yLabel": "Effectif",
  "series": [{ "label": "Effectif",
               "data": [{ "label": "Football", "value": 8 }, { "label": "Basket", "value": 5 }] }],
  "alt": "Diagramme en barres : Football 8, Basket 5." }
```

1. **Three kinds.** `bar` and `line` place the categories along a horizontal axis and the values
   against a graduated vertical axis; `pie` turns each value into a sector proportional to it.
   `line` is for **categorical** abscissas (hours of a day, months). A function, a proportionality
   graph or any curve with a numerical abscissa stays in `figure` with `axes` (ADR 0013, #214).
2. **One series.** `series` keeps the array shape but holds exactly one entry for now. Several
   series need grouped bars and a legend; allowing them later is a pure relaxation.
3. **Data are objects** `{ label, value }`, not `[label, value]` pairs: self-describing in a diff,
   and named in the backend validator's error messages.
4. **The vertical axis starts at 0**, always (the chapter itself teaches why a truncated axis
   misleads). Its graduations are automatic — a 1, 2 or 5 × 10ⁿ step giving at most about six
   intervals — and the author may override them with `yMax` and `yStep`. A `line` with negative
   values extends its axis below 0 on the same step.
5. **No values written by default.** A value printed on a bar or sector would give away every
   reading exercise. `showValues: true` writes them (bar tops, line points). A pie sector carries
   only its category name, never a value or an angle.
6. **The renderer owns the colours.** Bars and the line use the accent colour; pie sectors take
   `--color-chart-1…6` in order (added in their own PR, #216), with at most six categories. A
   category is always named in text next to its sector, so colour is never the only way to read
   the chart.
7. **Accessibility.** `alt` is required, as for `figure` and `image`. The renderer also emits the
   data as a visually hidden table (category, value), so a screen reader can read the exact values.
   A visible "voir les données" toggle was rejected: it would show the answers.
8. **Same pipeline as figures.** A pure function in `packages/content` turns the block into a
   drawing model (graduations, bars, points, sector paths, label positions); the web component
   maps that model to SVG. Mobile reuses the function.
9. **CI and publication.** `check-content` rejects: a series count other than one; blank or
   duplicated category labels; fewer than 2 or more than 12 categories (6 for a pie); a non-finite
   value; a negative value in a `bar`; a value ≤ 0 in a `pie`; `yMax` below the largest value;
   a non-positive `yStep`; `xLabel`, `yLabel`, `yMax`, `yStep` or `showValues` on a pie. The
   publication validator requires `alt`, as for figures.

## Consequences

### Positive

- Charts are authored as data, checked by CI and drawn the same way everywhere; the author never
  computes a sector angle or a bar height.
- The bar chart of `statistiques` gets real graduations, and the chapter can finally show the pie
  chart it asks students to build.
- Reading exercises stay honest: nothing on the chart gives the answer unless the author asks.

### Negative / trade-offs

- A chart cannot sit inside an exercise (a prompt is text). An exercise about a chart follows the
  chart block, as exercises about figures already do.
- No grouped bars, stacked bars, histograms, box plots or broken axes. They need their own
  amendment when a chapter needs them.

### Follow-ups

- A `chart` form in the teacher editor (F3 palette); until then the block renders in the preview.

## Alternatives considered

- **Extending `figure`.** Rejected: a figure's elements are geometric and checked as geometry
  (right angles, equal lengths). Bars and sectors derived from values have nothing to check
  geometrically, and every chart would need hand-computed coordinates.
- **A charting library** (Recharts, Chart.js, Vega-Lite). Rejected for the reasons of ADR 0013:
  a runtime dependency, no deterministic output to check in CI, no reuse on Expo without a
  WebView, and its own styling to strip down to the tokens.
- **A table plus prose.** Status quo; does not teach reading a chart.
