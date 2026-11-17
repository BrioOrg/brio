# 0040 — Probability tree block (`tree`)

- **Status**: Proposed
- **Date**: 2026-11-17
- **Deciders**: Pierce Broudin

## Context

Trees are how French collège and lycée students reason about multi-step random experiments. In 5e
an *arbre des possibles* lists the issues of two coin tosses (`c4.ogd.probabilites.utiliser-vocabulaire`,
`c4.ogd.probabilites.attribuer-equiprobabilite`); in 4e–3e a weighted tree carries a probability on
every branch and the brevet asks for the product along a path (`c4.ogd.probabilites.calculer`,
`c4.ogd.probabilites.proprietes`); in seconde and première the same tree holds $\overline{A}$ and
conditional probabilities. No block draws one. A `figure` (ADR 0013) would make the author place
every node and every label by hand, and it cannot write a fraction on a branch.

A tree's geometry follows from its structure. Asking for coordinates would put the layout in the
content, where labels collide, instead of in the renderer.

## Decision

Add a `tree` block, separate from `figure` and `chart`. Additive change, `schemaVersion`
unchanged (ADR 0004, ADR 0019 §2).

```json
{ "id": "arbre-urne", "type": "tree",
  "root": { "children": [
    { "label": "R", "probability": "3/5", "children": [
      { "label": "R", "probability": "2/4" }, { "label": "B", "probability": "2/4" } ] },
    { "label": "B", "probability": "2/5", "children": [
      { "label": "R", "probability": "3/4" }, { "label": "B", "probability": "1/4" } ] } ] },
  "outcomes": true, "products": true, "highlightPath": ["R", "B"],
  "alt": "Arbre de deux tirages sans remise dans une urne de 3 boules rouges et 2 bleues." }
```

1. **One block for both trees.** `probability` is optional on every branch: without it the block
   is an *arbre des possibles*, with it a weighted tree. `label` is rich text, so `$\overline{A}$`
   works. A leaf may override its issue with `outcome` (`$A \cap B$` in première).
2. **Probabilities are strings**, written the way a textbook does: `3/5`, `0,4`, `25 %`, an integer,
   `?` for a blank to fill, or LaTeX between `$` (`$p$`, `$1-p$`, `$\frac{3}{5}$`). The renderer
   draws `3/5` as a real fraction (`\dfrac`), keeps the author's form (`2/4` is not reduced: it is
   what a draw without replacement gives), and writes decimals with a comma. A number must be in
   [0 ; 1].
3. **Depth ≤ 3, at most 6 branches per node, at most 12 leaves.** The schema encodes the depth
   with three node levels; `check-content` counts the leaves. Beyond that a tree stops being
   readable on a phone, and the programmes never need it.
4. **Exact arithmetic.** Probabilities are parsed to rationals (BigInt). `check-content` and the
   teacher editor reject sibling branches whose probabilities are all numeric but do not sum to 1,
   or whose given values already exceed 1. Siblings where some branches have a probability and
   others have none are a *warning* (a tree to complete is legitimate, a forgotten one is not).
5. **Issues and products are opt-in.** `outcomes: true` writes the issue of each leaf in a column,
   `(R ; B)`; `products: true` writes its probability, `3/5 × 2/4 = 3/10`, reduced, as a decimal
   when every factor is decimal. Off by default, like `showValues` in ADR 0030: a written product
   gives away the exercise. `products` requires every probability on every path to be numeric.
6. **One emphasised path.** `highlightPath` lists the labels from the root to one leaf. Its
   branches, their probabilities and its leaf texts take the first maths tone (`--color-tone-1`,
   #382): the multiplication rule read on the figure and in the product, in the same colour.
   Colour is never the only cue: the path is also drawn thicker and its issue in bold.
7. **Layout in `@brio/content`.** A pure function places leaves at equal steps, each parent at
   the middle of its children, and each branch label at mid-branch on the side away from its
   siblings (the middle branch of an odd fan: above). Label sizes are estimated from KaTeX's
   metrics; the function widens the leaf step until no label box overlaps another box or a branch.
   Tests assert the absence of collisions on a battery of trees.
8. **Rendering.** The branches are SVG; labels are KaTeX HTML positioned over it at the model's
   pixel coordinates (no `foreignObject`, which Safari mislays when the SVG is scaled). The figure is
   never scaled: a fraction must stay legible.
9. **Responsive: horizontal, tightened on a phone.** A tree grows in breadth (leaves) far more than
   in depth (≤ 3), and on a phone the page scrolls vertically: breadth must go down the page. The
   default orientation is therefore horizontal. Below a 28rem container the renderer switches to
   a compact horizontal layout (shorter branches, the product under the issue), whatever the
   authored orientation; `orientation: "vertical"` is honoured only where the tree fits. A depth-3
   tree with products stays under 330 px wide in its compact form.
10. **Accessibility.** `alt` is required, checked at publication like `figure` and `chart`. The
    renderer also emits a visually hidden table, one row per path: the branches with their
    probabilities, and the issue and product when they are shown.

## Consequences

### Positive

- Trees are authored as structure, checked by CI (sums, depth, size) and laid out the same way
  everywhere; the author never places a label.
- A 5e student sees why two coins give four equiprobable issues; the 3e weighted tree and the
  seconde $\overline{A}$ tree need nothing more.

### Negative / trade-offs

- Label sizes are estimates, not measurements: an exotic LaTeX label may be wider than predicted.
  The margins absorb ordinary cases; the `/design` entry is the visual check.
- No tree of counting beyond 12 leaves, no unequal branch lengths, no tree inside an exercise
  prompt (an exercise follows the tree block, as with figures and charts).

## Alternatives considered

- **Extending `figure`.** Rejected for the reasons of ADR 0030: hand-placed coordinates, and no
  fraction on a branch.
- **SVG text with a home-made fraction typesetter.** Rejected: KaTeX already sets fractions,
  $\overline{A}$ and $P_A(B)$ correctly; a second typesetter would drift from the prose.
- **Scaling the whole figure down on a phone.** Rejected: a 2-level tree with fractions scaled to
  320 px gives 9 px digits.
- **A vertical layout on phones.** Rejected: 9 leaves side by side do not fit 328 px, while 9 rows
  fit any phone.
