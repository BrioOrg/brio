# Motion

The motion contract for the chapter's **interactive mode** (epic #240): what
moves, what never moves, how long it takes, and on which curve.

The numbers below were not specified, they were **tuned by eye** on a
throwaway prototype of the real chapter `3e/mathematiques/theoreme-de-pythagore`
(#241) and approved by Pierce on 2026-10-11:
<https://claude.ai/artifact/JctGCM4WCc2Qu5H37oyxsv> (private link, tuning panel on `D`).

They are now the motion tokens of `web/app/tokens.css` (#243): `--duration-<name>`,
`--ease-<name>` and `--motion-<distance>`, mirrored for JavaScript in
`web/lib/motion-tokens.ts`. Components read the tokens, never a number from this
file.

How the chapter is split into slides, the URL, the mode cookie and the choice of
`motion` as the animation library are recorded in
[ADR 0032](../adr/0032-mode-interactif-chapitre.md).

## The budget

Four rules hold for every animation in interactive mode. A proposal that breaks
one of them is rejected, however good it looks.

1. **One big moment at a time.** Moments are chained, never stacked. A correct
   answer is a sequence (sheet → check mark and particles → XP flight → counter),
   not four things landing together.
2. **Only `transform` and `opacity` animate.** Colour, border, shadow, width,
   height and position change instantly. Two consequences:
   - the progress track grows with `scaleX`, not `width`;
   - an arcade button is two layers: the **face** moves down by
     `--depth-arcade` when pressed, the **edge** below it stays put. The
     `box-shadow` edge is never animated.
3. **The student never waits more than 300 ms to act.** The controls of a new
   slide are fully visible within 300 ms: `max(slide-in, stagger × index of the
   answer beat + beat)`, so 280 ms on a lesson, 290 ms on an exercise. And
   nothing is ever *blocked*: controls work during an animation.
4. **Every animation can be skipped.** Any click, tap or key finishes all
   running animations at their end state before acting. No animation carries
   information on its own: its end state says everything.

## What moves

| Moment | What happens | Duration | Curve |
|---|---|---|---|
| Slide exit | fades out, slides 32 px against the direction of travel | `slide-out` 160 ms | `ease-in` |
| Slide entry | fades in, slides 32 px in the direction of travel; the track grows with it | `slide-in` 280 ms | `ease-in` |
| Staggered beats | each block of the slide (kicker, title, text, figure, formula, callout, answers) rises 12 px and fades in, one after the other | `beat` 240 ms, `stagger` 50 ms | `standard` |
| Button press | the face drops onto its edge | `press` 90 ms | `ease-out` |
| Option selection | the letter badge scales from 0.7 to 1; the colours switch instantly | `select` 160 ms | `out-quint` |
| Correct answer · sheet | the result sheet rises from below | `sheet` 290 ms | `ease-in` (slide curve) |
| Correct answer · check | the check mark scales in, at 60 % of the sheet | `check` 300 ms | `out-quint` |
| Correct answer · particles | 21 particles burst 55 px around the check mark, then fall and fade | `particles` 1030 ms | `out-quint` |
| XP gain | after the sheet and a pause, the real "+N XP" badge flies to the XP counter, which bumps and counts up | `xp-delay` 500 ms, `xp-flight` 470 ms, `count` 180 ms | `ease-in`, then `out-quint` |
| End slide | the stats appear as beats, then the session XP counts up from 0 and bursts (twice the particles, 1.6× the spread) | `finale` 900 ms | linear count, `out-quint` burst |
| Side strip label | the label naming a slide fades in 6 px from the left on hover or focus | `select` 160 ms | `standard` |

Timeline of a correct answer, from the click on « Vérifier »:

```
0 ms      sheet rises ───────────── 290
174 ms        check mark ─────────── 474
174 ms        particles ─────────────────────────────── 1204
790 ms                         XP flight ──────── 1260
1260 ms                                      counter bump + count ─ 1560
```

« Continuer » has focus from 0 ms. Pressing it ends the whole sequence at once.

## Named durations and curves (tokens since #243)

| Name | Value | Note |
|---|---|---|
| `slide-out` | 160 ms | |
| `slide-in` | 280 ms | |
| `stagger` | 50 ms | delay between two beats |
| `beat` | 240 ms | |
| `press` | 90 ms | its own token, not `--duration-fast` (100 ms): the interactive mode is retuned without touching the reading mode |
| `select` | 160 ms | |
| `sheet` | 290 ms | |
| `check` | 300 ms | its own token, though equal to `--duration-slow` today |
| `particles` | 1030 ms | |
| `xp-delay` | 500 ms | |
| `xp-flight` | 470 ms | |
| `count` | 180 ms | |
| `finale` | 900 ms | |

Distances and counts were tuned too. The distances are tokens:
`--motion-slide-shift` (32 px), `--motion-beat-rise` (12 px) and
`--motion-particle-spread` (55 px). The counts (21 particles, twice as many and
1.6× the spread on the end slide) are not design values: they are named
constants in `motion-tokens.ts`.

| Curve | Value | Used for |
|---|---|---|
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | slide entry and exit, result sheet, XP flight |
| `standard` | `cubic-bezier(0.2, 0, 0, 1)` | staggered beats, side strip label |
| `out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` | rewards: selection, check mark, particles, counter bump |
| `ease-out` (existing token) | `cubic-bezier(0, 0, 0.4, 1)` | button press |

**No overshoot.** The existing `--ease-spring` ("reserved for rewards") was tried
on the rewards and turned down: too bouncy. Interactive mode uses no curve that
overshoots. `ease-in` on slide **entry** is a deliberate choice from the tuning,
not a typo.

## What never moves

- **The reading mode.** It keeps today's micro-interactions (hover, press) and
  gains nothing from this file.
- **A wrong answer.** No shake, no buzzer, no flash, no pulse. The amber sheet is
  simply there, with a hint, « Revoir la diapo » and « Réessayer ». Moving on a
  mistake is a sanction, and PRINCIPLES.md rules out sanctions.
- **Text being read.** Beats appear once, when the slide enters, and never move
  again: no typewriter, no re-animation on scroll, no reflow after they land.
- **Anything idle.** No looping animation in interactive mode (no bobbing, no
  breathing button). Motion answers an action of the student, nothing else.
- **Layout properties.** See budget rule 2.

## Honest data and T0

- The "+N XP" that flies is the real `xpGain` returned by `progression`
  (ADR 0022: 10 at the first try, 6 after a mistake). Nothing flies when nothing
  was earned, and reading a slide earns no XP of its own.
- The end slide shows the XP earned **during the session**, the exercises solved
  and the streak. The streak does not animate unless it actually changed.
- **T0.** On a wrong answer, only the student's own pick is marked (amber, with
  an icon, not colour alone). The right option is never highlighted, the
  expected value is never echoed, and the author's explanation appears only
  after a correct answer, because explanations often contain the answer (#253).
  This is a deliberate departure from `visuels/3-lecon-qcm.html`, whose
  « À revoir » state shows the right answer.

## Shapes

- Particles are round confetti and four-point sparkles, in `accent`,
  `accent-hi` and `xp`. **No hexagons** in motion: they were tried and turned
  down. The A/B/C badges of the answer options keep the mockup's hexagon.
- The folded side strip shows one icon per kind of slide (opening, lesson,
  exercise, end) and a divider between sections. Hovering or focusing a marker
  names where it leads: kind, position, title, section, and whether the student
  has seen it or solved it. A solved exercise shows a check mark.
- The chameleon is absent from interactive mode until its moods exist
  (BACKLOG.md).

## Reduced motion

When `prefers-reduced-motion: reduce` is set, motion is **off**, not softened:

- every duration is 0: slides swap instantly, beats are there at once, the sheet
  is there at once;
- no particles and no XP flight; counters show their final value directly;
- focus still moves to the new slide's title, and every state change is still
  announced (`role="status"` on the result sheet).

`tokens.css` already resets CSS transitions and animations to 1 ms under this
query. That override does **not** reach animations started from JavaScript
(`element.animate()` or a library): their code must read the media query itself
(with `motion`, `useReducedMotion()`, ADR 0032) and skip the animation. A component that only relies on the CSS override is a
bug.
