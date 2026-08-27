# Design

This directory holds the **normative visual reference** for brio and the documents
derived from it.

## `visuels/` — the reference (frozen)

Eight HTML mockups produced in August 2026, establishing the "Arcade" direction:
a deep green dark theme, arcade controls with a 3D bottom edge, rounded display
type, hexagonal path nodes, and a non-punitive feedback language.

| File | What it establishes |
|---|---|
| `index.html` | Contents page for the set. |
| `1-connexion-matiere-parcours.html` | Login → subject choice → course path. **Light "Arcade" palette** (`#eaf7ef` ground, `#10241a` ink, `#12b76a` accent, coral and yellow secondaries) — the seed of the light theme. Also fixes the subject grid, which holds six subjects without redesign. |
| `2-parcours-atlas.html` | The course path as an atlas: hexagonal nodes with lock states, banner, mascot, bottom navigation. Carries `.phone.day` variants — the light theme was already anticipated here. |
| `3-lecon-qcm.html` | Lesson reading, multiple-choice flow, selected / correct / wrong option states, and the result sheet that rises after validation. |
| `4-types-exercices.html` | Four further exercise types: numeric with keypad, short answer, fill-in-the-blank, and "on paper" self-assessed work. |
| `5-correction-photo.html` | Photo capture of handwritten work, editable transcription with a maths keypad, and the fallback to self-assessment after three attempts. |
| `6-tuteur-ia.html` | The tutor: student and assistant bubbles, **refusal bubble**, citation chips, chapter links, suggested questions, typing indicator. |
| `doc-backend-pierce.html` | A back-end specification **derived** from the screens. See the caution below. |
| `doc-carnet-idees.html` | Running idea notebook (streaks, tiers, further subjects). |

### These files are frozen

They are the original against which the implementation is compared. **Nobody
edits them** — not to fix a colour, not to update a screen, not to reflect what
was built. If the direction changes, the change is recorded in `tokens.css` and
in an ADR, and a new dated mockup is added alongside rather than overwriting one.

A reference that is edited to match the code stops being a reference.

## How the direction reaches the product

```
docs/design/visuels/   reference, frozen, read by humans and agents
        │  derived once, deliberately
        ▼
web/app/tokens.css     the operational source: every colour, font, size,
        │              radius, shadow and duration
        ▼
components             consume SEMANTIC tokens only — never primitives,
                       never raw values
```

Once `tokens.css` exists, **no colour is ever typed into a prompt, a component or
an issue again.** A component that needs the signature green references
`--accent`. This is what makes the identity survive across sessions and
contributors: it is a file, not a memory.

Enforcement is mechanical:

- a CI lint fails on any hex, rgb, font family or arbitrary size outside
  `tokens.css`;
- a contrast check covers the semantic pairs in both themes;
- `CLAUDE.md` carries the rule for every agent session;
- `tokens.css` changes land in their **own PR** — never bundled with a feature.
  The lint stops accidental drift; this rule stops deliberate drift.

The `/design` route is the human half of the check. The lint cannot tell that
`danger` was used where `warning` belonged. Compare a few screens to the
styleguide after every UI change.

## Corrections applied when deriving the tokens

The mockups are a design reference, not production code. Three things were
changed on the way in, and the reasons are recorded in the design ADR:

1. **Typography.** The mockups use `ui-rounded, "SF Pro Rounded",
   "Arial Rounded MT Bold"`. That stack resolves to `system-ui` on Windows,
   Android and Linux, erasing the rounded character for most users. Replaced by a
   self-hosted rounded variable family. No CDN, no third-party font host.
2. **Two palettes reconciled.** Screens 2–6 are dark, screen 1 is light. Both are
   kept: dark is the default and the reference, light is a complete theme seeded
   from screen 1 and from the `.phone.day` variants — not a degraded afterthought.
   A classroom in daylight is a real use case.
3. **No fabricated state.** The screens display XP totals, levels, streaks,
   completion percentages and locked chapters. Those require the `progression`
   and `identite` modules, which do not exist. The implementation shows only what
   the catalogue actually knows. Inventing progress data in a product used by
   minors is not acceptable, however good it looks.

## Caution on `doc-backend-pierce.html`

That document is a **proposal derived from the screens**, not a decision. It
assumes token-based auth with refresh, institutional SSO, and server-side
gamification. Each of those is an architectural choice that belongs in an ADR,
weighed against alternatives. Do not treat it as settled because it is written
down here.

## Deferred by dependency

Elements of the direction that are deliberately not built yet are listed in
`BACKLOG.md`, each with the dependency blocking it — the atlas path and its
locks, XP and levels, the streak flame, photo correction, the mascot. Keeping
that list explicit is what prevents them from reappearing inside a styling PR.
