# 0014 — Design foundations: tokens, themes, typography, motion

- **Status**: Accepted
- **Date**: 2026-08-27
- **Deciders**: Pierce Broudin

## Context

`web/app/globals.css` contained a single `@import 'tailwindcss';`. Every
screen built so far was styled ad hoc — values chosen per-component with no
shared vocabulary. The visual direction was established in August 2026 as eight
frozen HTML mockups in `docs/design/visuels/`, embodying the "Arcade" language:
a deep-green dark theme, arcade controls with a 3D bottom edge, rounded display
type, and a non-punitive feedback register.

Without a token file those mockups were a reference with no operational path.
Each new screen re-derived values from memory or from the issue description,
producing drift across sessions and contributors. The direction existed only
as a set of files and intentions; it needed to become a machine-readable
contract before it could survive the first feature PR.

This ADR records the decisions made in establishing that contract.

## Decision

We establish `web/app/tokens.css` as the single source of truth for all
colours, fonts, sizes, radii, shadows, and durations. It is consumed by
Tailwind v4 `@theme` and is never edited in passing by a feature PR.

The system has two layers:

1. **Primitives** — raw palette values, in `:root`, not in `@theme`. No
   Tailwind utility is generated for them; a component has no class by which
   to reference a primitive. The lint gate (`scripts/check-tokens.sh`) enforces
   the boundary for arbitrary values, raw hex in CSS, and inline font families.
2. **Semantic tokens** — in `@theme`. The only layer components may use.
   Named by role, not by appearance: `accent`, not `green`; `feedback-incorrect`,
   not `amber`. This makes theming and future refactors possible without touching
   components.

## Consequences

### Positive

- Any new screen is composed from a fixed vocabulary; values are not
  re-decided each time.
- Theming is mechanical: adding a new theme means overriding CSS custom
  properties, not hunting for hardcoded values.
- CI fails on drift (arbitrary Tailwind values, raw hex, inline font-family)
  and on contrast regression, so the contract is self-enforcing.
- The `/design` route is a human check that the lint cannot replace: it
  shows all tokens in both themes and becomes the review surface for every
  future UI change.

### Negative / trade-offs

- `tokens.css` is a single point of contention. Its "own PR" rule reduces
  conflicts but means design changes cannot land silently inside feature PRs.
- The light-mode amber derivations (`warning`, `feedback-incorrect`, `xp`) are
  substantially darker than the dark-mode values. This is not inconsistency —
  it is the contrast requirement. Amber at full brightness does not clear
  3 : 1 on white; the darker golden tones (`#b87a00`, `#b88000`) are the
  accessible representatives of the same hue family on a light ground.
- Fonts ship with the app (two `.woff2` files, ~90 KB combined). This is
  intentional: the self-hosting constraint eliminates third-party font
  requests, which the product's privacy posture (minor students) requires.

### Follow-ups

- **D2**: components — build reusable UI from the token vocabulary.
- **D3**: restyle existing pages (`[niveau]`, root layout) to use semantic
  tokens instead of ad-hoc Tailwind classes.
- Add italic variants of Nunito Variable and Nunito Sans Variable if the
  prose or display type uses oblique emphasis.
- Extend `check-contrast.mjs` with new pairs as components are added.

## Corrections applied when deriving the tokens

Three deliberate departures from the mockup values are recorded here (the
same three listed in `docs/design/README.md`, with fuller rationale):

### 1. Typography

**Mockup**: `ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold"` followed
by a system-ui fallback.

**Problem**: that stack renders as `system-ui` on Windows, Android, and Linux
— roughly 70 % of the global device market. The rounded character that defines
the product's identity disappears for most users.

**Decision**: self-host Nunito Variable (display) and Nunito Sans Variable
(prose). Both are OFL-licensed, available from Google Fonts, and designed as
companion faces within the same type family.

**Why Nunito Sans for prose and not Inter**:
Inter was considered and ruled out on two grounds. First, it is one of the
four typefaces that have become the signature of AI-generated interfaces
(alongside Geist, Plus Jakarta Sans, and DM Sans). The Arcade direction
exists specifically to avoid that aesthetic; importing Inter would undercut
the identity at the root. Second, pairing a humanist rounded display face
(Nunito) with a neutral grotesque (Inter) reads as indecision — two
conflicting personalities. Nunito Sans is the non-rounded companion Nunito
was designed alongside. The two faces share proportions, weight optical sizes,
and design DNA; they sit together without explanation.

Nunito alone for prose was considered and rejected: rounded terminals reduce
character differentiation at small sizes over sustained reading. At 13–15 px
over a paragraph of lesson text, the `a/e/c` cluster is harder to parse than
with Nunito Sans.

**Escape hatch**: if legibility testing with real students shows that Nunito
Sans underserves dyslexic readers, replacing it is a one-line change in
`tokens.css` (`--font-prose`). The token architecture is precisely what makes
that swap possible without touching components.

### 2. Two palettes reconciled

**Mockup**: screens 2–6 are dark; screen 1 is light. There is no explicit
"light theme" specification.

**Decision**: dark is the default and the reference; light is a complete
theme, not a degraded afterthought. A classroom in daylight is a real use
case: students on unmanaged devices with system-level light mode will arrive
at the light theme whether we design it or not.

The light theme is seeded from `1-connexion-matiere-parcours.html` and from
the `.phone.day` variants in `2-parcours-atlas.html`. Four semantic token
values differ substantially from their dark counterparts for contrast reasons
(see the "Negative" section above). This is documented in `check-contrast.mjs`
and verified in CI.

The three-state theme mechanism — explicit `data-theme="dark"`, explicit
`data-theme="light"`, and absent attribute (system preference via
`@media (prefers-color-scheme)`) — is stored in `localStorage` under
`brio-theme`, with `try/catch` for private-browsing contexts. An inline
script in `<head>` applies the stored preference before first paint to
eliminate flash of the wrong theme. `color-scheme` is set so browser chrome
(scrollbars, form controls) matches.

### 3. No fabricated state

**Mockup**: XP totals, levels, streaks, locked chapters, and completion
percentages appear on multiple screens.

**Decision**: none of these appear in the implementation until the modules
that own them (`progression`, `identite`) exist and expose real data. The
`docs/design/BACKLOG.md` lists each deferred element with its dependency.

This is not an aesthetic choice. The product is used by minors. Displaying
fabricated progress data — however good it looks — is a trust issue.

## New token: `feedback-incorrect`

The mockups use amber for the wrong-answer state (`--amber: #f0a83a`). The
issue specification lists `danger` and `warning` as semantic tokens, which
would invite mapping amber to one of them. Neither mapping is correct.

A wrong answer is not a danger (irreversible action) and not a warning
(reversible caution). It is a normal step in learning. Mapping it onto
`danger` or `warning` smuggles the punitive register back in through the
token layer and constrains every future component that uses those tokens.

`feedback-incorrect` is added as a distinct semantic token, amber-family,
with the constraint that it must not appear outside of exercise feedback
contexts. `danger` is reserved for irreversible actions (account deletion,
content deletion) and must never appear in a student's normal exercise flow.
This constraint is documented in the `/design` styleguide and enforced by
code review.

## New token: `danger` (red, not in the mockups)

The mockups have no red. Danger is introduced deliberately to cover
destructive actions that do not appear in the student-facing exercise flow.

The value (`#e86060` dark / `#c93535` light) is tuned to belong on the
respective ground colours rather than being a stock red. Both values pass
WCAG AA for body text (4.5 : 1) on their respective panel backgrounds.

## What was deliberately not adopted from the mockups

| Element | Reason |
|---|---|
| `ui-rounded` font stack | Renders as `system-ui` on 70 % of devices |
| `bg-gradient-*` page backgrounds | Banned from components; only declared in `tokens.css` composites if needed |
| Specific hex values in components | Replaced by semantic tokens; primitives are never component-accessible |
| XP, streak, level display | Requires `progression` module — see `BACKLOG.md` |
| Atlas path with hexagonal nodes and locks | Requires `progression` module — see `BACKLOG.md` |
| Mascot (caméléon Brio) | Requires illustration assets — see `BACKLOG.md` |
| Bottom navigation bar | Requires social and profil modules — see `BACKLOG.md` |
| Photo correction UI | Requires `exercices` photo pipeline — see `BACKLOG.md` |

## Alternatives considered

- **Design token formats (Style Dictionary, Theo)**: rejected. The token set
  is small, the Tailwind v4 `@theme` mechanism is direct, and adding a
  compilation step adds friction and a new dependency category for marginal
  benefit at this scale.

- **CSS-in-JS theming (Stitches, vanilla-extract)**: rejected. The stack is
  Tailwind-first; mixing paradigms would split the styling vocabulary across
  two systems.

- **ESLint plugin for drift enforcement**: rejected in favour of a bash/grep
  CI script. A custom ESLint plugin requires a build step and plugin
  maintenance. The bash script is transparent, requires no dependencies, and
  catches the same classes of violation. If ESLint coverage is later wanted
  at dev time (not just CI), adding it is additive, not a replacement.

- **`next/font` for self-hosting**: considered. `next/font/local` optimises
  and self-hosts fonts within Next.js. Rejected because it requires font
  declarations to live in a server component (layout.tsx), decoupling them
  from the token file where they belong. `@font-face` in `tokens.css` keeps
  the full type system in one file.
