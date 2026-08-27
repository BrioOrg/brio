# Design Principles

This document holds what `README.md` does not: the decisions behind the
direction rather than the derivation chain. Read them before building any
screen, writing any copy, or choosing any token.

## Identity in one sentence

brio looks like a game, speaks like a coach, and works like a textbook.

The "Arcade" direction is the visual contract of that sentence:
the rounded type and 3D controls signal play; the green and white signal
clarity; the dense information layout signals that nothing is dumbed down.

## Tone of voice

All user-facing copy is French. The register is **tutoiement** throughout —
no vous, no formal distance. The product addresses a teenager the way a good
older sibling would.

The mockups show this register directly. Extracts:

- *"Content de te revoir !"* — warm, personal, not corporate
- *"Connecte-toi : on retrouve ta classe et ta progression."* — second person, collaborative *on*
- *"Salut Léa"* — first name, not role
- *"On reprend où tu t'es arrêtée"* — resumes without ceremony
- *"Bien vu, tu gères !"* — celebratory, not condescending
- *"Je t'explique à partir du cours, avec les passages exacts."* — direct, honest about method
- *"Je ne donne pas les réponses des exercices — je t'aide à les trouver."* — firm but not punitive

### What the copy never does

- No cœurs, no vies, no sanctions. A wrong answer opens an explanation, not
  a penalty. The mockup states this explicitly: *"Pas de cœurs, pas de
  sanction : une erreur ouvre une explication, pas un échec."*
- No guilt on failure. The feedback tone stays coach: *"on regarde ensemble"*
  not *"tu t'es trompé(e)"*.
- No fabricated urgency. No countdown timers on core exercises.
- No dark patterns: no guilt-tripping on logout, no misleading progress bars,
  no manufactured streaks shown before the `progression` module exists.

### Writing a new string

Ask: would a good older sibling say this at 21:00 before an exam? If it
feels corporate, patronising, or punitive, rewrite it.

## Non-punitive feedback vocabulary

The wrong-answer state has its own semantic token (`feedback-incorrect`,
amber family) that is distinct from `danger` (irreversible system errors)
and from `warning` (reversible caution). This distinction is design
policy, not a naming accident.

Correct copy patterns:
- Correct: *"Bien vu !"*, *"Exactement !"*, *"Tu gères !"*
- Incorrect: *"Pas tout à fait — regarde cette partie du cours."*,
  *"On regarde ensemble."*, *"Presque — voilà pourquoi."*
- Never: *"Faux."*, *"Erreur."*, *"Mauvaise réponse."* as standalone feedback

## Visual identity rules (complement to README)

### What the direction is

- Dark deep-green ground (`#0a1310`) as the primary surface — a classroom
  at dusk, not a void.
- Signature green (`#17c26b`) as the accent and success signal. Correct and
  brand are the same colour intentionally.
- 3D arcade controls: a button has a bottom edge in `accent-edge`. The depth
  communicates affordance, not decoration.
- Rounded display type (Nunito Variable) for headings and interactive labels.
  Rounded terminals signal warmth; the tight letter-spacing at large sizes
  signals precision.
- Nunito Sans Variable for prose: same family lineage, non-rounded terminals,
  legible at 13–15 px over sustained reading.

### What the direction is not

- Not a dark-mode toggle on a generic SaaS interface.
- Not minimalism. The hexagonal path nodes, the 3D controls, the radiant
  gradient on the page background are all part of the identity.
- Not neumorphism. The 3D edge is a hard offset shadow, not a soft blur.
- Not gamification-first. XP and streaks are one layer of the experience,
  not the product. The content and the tutor exist without them.

## Accessibility commitments

1. **Contrast**: all semantic token pairs pass WCAG 2.1 AA. The contrast
   checker in `scripts/check-contrast.mjs` is wired into CI and is the
   authoritative record.
2. **Reduced motion**: `tokens.css` resets all durations to 1 ms when
   `prefers-reduced-motion: reduce` is set. No animation is load-bearing.
3. **Colour is not the only signal**: correct / incorrect states use shape
   (hexagonal badge, icon) and copy in addition to colour.
4. **Font legibility**: Nunito Sans was chosen in part because the escape
   hatch to Atkinson Hyperlegible (should legibility testing with real
   students require it) is a one-line token change.
5. **Semantic HTML**: every interactive element is a `<button>` or `<a>`;
   every form field has a `<label>`; ARIA roles are added only when native
   semantics fall short.
