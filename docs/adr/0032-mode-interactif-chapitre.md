# 0032 — Interactive mode for a chapter: slides, URL, animation library

- **Status**: Accepted
- **Date**: 2026-10-11
- **Deciders**: Pierce Broudin
- **Amended**: 2026-10-11 (#245) — §1, §6, §7: both modes render **one tree**, so exercise state
  survives a switch without a store; `motion` drives the slides imperatively with `animate()`
  instead of `LazyMotion` + `m.*`

## Context

A chapter reads as one long page (`ChapterView`). Epic #240 adds an **interactive mode**: the
chapter becomes a sequence of slides, one thing at a time, with the animations and feedback tuned
in #241 (`docs/design/MOTION.md`). The current page stays as the **reading mode**, without any new
animation. A button switches between the two. The audience is the student at home; teacher
projection is out of scope.

Facts from the catalogue (45 chapters, 2026-10-11) that shape the decision:

- Two thirds of the blocks are exercises (654). Lessons are carried by **callouts** (211:
  97 `definition`, 47 `example`, 67 `tip`/`warning`/`note`) far more than by prose (79). Two prose
  blocks never follow each other.
- `objectives` is not a chapter field: it is the first block of the first section, in 40 chapters
  out of 45.
- Some blocks are too tall for one screen: `5e/mathematiques/statistiques` puts a table and three
  charts together.

The decisions must also hold for the Expo app (ADR 0003): what can be shared lives in
`packages/content`, without any web framework.

## Decision

We will derive the slides of a chapter automatically from its blocks with a pure function in
`packages/content`, address each slide by a stable id in the URL, remember the mode in a cookie,
and animate the interactive mode with `motion`, loaded only by that mode.

### 1. The model: `buildDeck`

```ts
type Diapo =
  | { id: 'debut'; kind: 'debut'; blockIds: string[] }          // title + objectives
  | { id: string; kind: 'lecon'; sectionId: string; blockIds: string[] }
  | { id: string; kind: 'exercice'; sectionId: string; blockIds: string[] }
  | { id: 'fin'; kind: 'fin'; blockIds: [] }                      // real summary (#249)

function buildDeck(chapitre: DeckInput): Diapo[]
```

- `DeckInput` is a **minimal structural type** declared in `packages/content`:
  `{ sections: { id, kind, blocks: { id, type, variant? }[] }[] }`. The web's `ChapitreResponse`
  satisfies it without any mapping; the function reads nothing else.
- A `Diapo` holds **block ids**, not copies of blocks. Nothing in the content JSON changes.
- **Both modes are one tree** (amended, #245). `ChapterView` renders the chapter once and wraps each
  slide's blocks in a `DiapoFrame`. In reading mode a frame is `display: contents`, so the page lays
  out as before; in interactive mode only the current slide's frames show, the others are `hidden`.
  A frame never changes element type or child order between modes, so switching remounts nothing.
- **Exercise state is shared by both modes** as a consequence: each `ExerciceWidget` keeps its
  local `useState` (selection, answer being typed, result), and it survives a switch because the
  widget stays mounted. No chapter-level store is needed for that. Nothing is persisted: on reload
  the student starts again, and `progression` stays the only source of truth for XP and mastery
  (ADR 0022).

### 2. Splitting rules

Each block has a **role**:

| Role | Blocks |
|---|---|
| lead | `prose`, callout `definition` and `example`, `steps`, `heading`, `objectives` (when not first), `reference` |
| support | `figure`, `formula`, `chart`, `code`, `table`, `image` |
| aside | callout `tip`, `warning`, `note` |
| exercise | `exercise` |

Rules, applied section by section:

1. **Opening.** The `debut` slide shows the chapter title, plus the `objectives` block when it is
   the first block of the first section. Otherwise the title alone.
2. **A lead opens a new slide.** Supports and asides that follow join it. So `definition →
   example` is two slides.
3. **Prose introduces.** A `prose` block **joins the lead that follows it** instead of being closed
   by it: "un texte reste avec l'encadré qu'il introduit" (#240). A prose followed by another prose
   or by an exercise stands alone.
4. **A support or aside with no open slide opens one** (after an exercise, at the start of a
   section).
5. **One exercise per slide**, full screen. It closes the open slide.
6. **The support placed right before an exercise** goes on the exercise slide **only when the lead
   before it already has a support**: it is then the exercise's data, not the lesson's
   illustration. `callout → figure → exercise` keeps the figure with the callout;
   `callout → figure → table → exercise` moves the table onto the exercise slide. 5 slides in the
   catalogue are affected. A slide opened by a support or an aside (rule 4) has no lead, so its
   supports stay with it: `exercise → table → chart → exercise` keeps the table and the chart
   together (#244).
7. **Never across a section.** The section title is the kicker of each of its slides. There is no
   divider slide: the side strip draws the divider.
8. **A slide is never cut.** When a slide is taller than the screen, its inside scrolls.
9. The `fin` slide closes the deck.

Example, `3e/mathematiques/theoreme-de-pythagore`:

```
debut                      title (the chapter has no objectives block)
intro-prose                prose + callout/definition + figure + formula
enonce-prose               prose
ex-reconnaitre-hypotenuse  exercise
methode-prose              prose + callout/example + formula
ex-longueur-cotes          exercise
ex-calcul-hypotenuse       exercise
ex-etapes-demonstration    exercise
ex-justifier-rectangle     exercise
fin
```

Over the whole catalogue, these rules give 10 to 35 slides per chapter (median 22, 996 in total).
Apart from the empty `fin` slides and the 5 `debut` slides without objectives, slides hold 1 block
(809), 2 (101), 3 (33), 4 (2) or 5 (1). The tallest is the `statistiques` table with its three
charts, which scrolls (rule 8).

Hand-written slide breaks are out of scope. They are worth considering only if the automatic split
is often wrong.

### 3. Slide ids

- A slide's id is the **id of its first block**, never its position, so a link stays valid when a
  block is added elsewhere in the chapter. Block ids are unique in every catalogue chapter today,
  but nothing enforces it: `check-content` must reject a duplicate block id in a chapter.
- `debut` and `fin` are **reserved**. `check-content` must reject them as block ids (none exists
  today).
- **Unknown id** (the content changed since the link was made): open the slide that *contains* that
  block id. Failing that, open `debut`.

### 4. URL and history

- The interactive mode lives on the **current chapter route** (ADR 0011):
  `/<niveau>/<matiere>/<slug>?diapo=<id>`. No new route.
- `?diapo` **implies the interactive mode**, whatever the cookie says. It does not write the
  cookie: following a shared link does not change the student's remembered mode.
- Each slide change **pushes** a history entry: the back button goes back one slide, and every
  slide has a direct link.
- Opening the interactive mode without `?diapo` shows `debut` and **replaces** the URL with
  `?diapo=debut`, without adding an entry. There is no "resume where I left off": nothing records
  it.

### 5. Remembering the mode

- A cookie `brio_mode_chapitre`, value `lecture` or `interactif`, read on the server by the chapter
  page (already `force-dynamic`). The server renders the right mode at first paint, with no flash.
- **No cookie means interactive**: the first visit opens the interactive mode.
- Only the switch button writes it. It is a device preference, not an account one; this is to be
  revisited only if someone asks for it.

### 6. Switching modes

- The switch happens **client-side**, without a navigation: it writes the cookie and updates the
  URL (`replaceState`: a switch is not a history entry). The tree is the same (§1), so an answered
  exercise stays answered.
- The reading-mode switch stays under the site header while the student scrolls, so switching
  mid-chapter is possible from anywhere.
- **Reading → interactive** opens the slide containing the block at the top of the viewport.
- **Interactive → reading** removes `?diapo` and scrolls to the first block of the current slide.
  From `debut` the page starts at the top. From `fin` it scrolls to the end of the chapter.

### 6 bis. Sections read (added by #252)

The chapter gauge counts sections read plus exercises solved (ADR 0022). Both modes send the same
signal, `POST /api/chapitres/{id}/sections/{sectionId}/lu`:

- **Interactive**: leaving a section's last slide **forward**.
- **Reading**: a marker closing each section (`data-fin-section`) **comes on screen**. No minimum
  time: it is a light signal, as fast as the arrows are in interactive mode.
- **Every section counts, exercises-only ones included**: `totalSections` counts them all, so a
  chapter could never be completed without them.
- **A logged-in student only, once per section per page**, whatever the mode switches. A failed
  signal is silent; the backend is idempotent anyway.
- **The gauge reloads** after a successful signal, with a short delay: `progression` records the
  read after commit, asynchronously. It shows only what `progression` returns, never a guess.

### 7. Animation library: `motion`

`motion` (motion.dev, formerly framer-motion) animates the interactive mode. It provides exit
animations (`AnimatePresence`, needed for the slide exit of `MOTION.md`), finger-following swipe
(`drag`), and `useReducedMotion`. Our own code would otherwise have to rebuild all three.

Measured on `motion` 14.1.0, bundled with esbuild (minified, React external), 2026-10-11:

| Import | min | gzip |
|---|---|---|
| `motion.div` (everything) | 130 kB | 43.4 kB |
| `LazyMotion` + `m` + `domMax` (animations, exit, drag, layout) | 131 kB | 43.5 kB |
| `LazyMotion` + `m` + `domAnimation` (no drag, no layout) | 82 kB | 29.5 kB |
| `motion/mini` `animate()` (Web Animations, no React) | 8.5 kB | 3.4 kB |
| `animate()` from `motion` (imperative; measured for #245) | 55 kB | 20.4 kB |

Rules (amended, #245):

- The slide frames stay mounted (§1), so they cannot be `m.*` components or children of
  `AnimatePresence`: swapping a wrapper's type remounts its blocks. Slides are animated
  **imperatively** with `animate()` on the frame elements. The leaving slide is taken out of the
  flow (absolutely positioned where it was) while the next one enters, so exit and entry run
  together and the next slide's controls are visible within the 300 ms budget.
- The swipe is a small pointer-event handler (touch only, `touch-action: pan-y`): the slide follows
  the finger, then `animate()` finishes the move or brings it back. No `drag` feature is needed.
- Components that need `motion` later (#247, #248) may still use `LazyMotion` + `m.*` for elements
  that are not slide frames.
- **Only the interactive mode loads `motion`**, through a dynamic `import('motion')` when it opens.
  The reading mode, which a student may have chosen precisely to avoid motion, pays 0 kB. Until the
  module is there, slides swap instantly.
- Every animation **skips itself under reduced motion**. The shell reads
  `prefers-reduced-motion` with `matchMedia`, not `useReducedMotion()`, which would pull `motion`
  into the reading mode's bundle. The CSS override in `tokens.css` does not reach JavaScript
  animations (`MOTION.md`, "Reduced motion").
- Durations and curves are read from the motion tokens (#243), never written as numbers in a
  component.
- Only `transform` and `opacity` are animated (`MOTION.md`, budget rule 2).

The Expo app does not reuse `motion`, which targets the DOM. It will use React Native Reanimated
with the same tokens and the same `buildDeck`.

## Consequences

### Positive

- No content to rewrite: the 45 catalogue chapters work in interactive mode as they are.
- `buildDeck` is pure and framework-free: unit-tested in `packages/content`, reused by Expo.
- One renderer for both modes: a block fixed in one mode is fixed in the other.
- Every slide has a URL, so the back button and direct links work.
- The reading mode keeps its weight and its calm.

### Negative / trade-offs

- An automatic split is sometimes wrong. A chapter that splits badly needs its blocks reordered, or
  later hand-written breaks.
- Pushing one history entry per slide makes "back to the course list" take many presses. The site
  navigation stays one tap away.
- In interactive mode every slide is in the DOM, hidden: the page weighs the same as the reading
  page, and a hidden exercise keeps running its mount effects.
- About 20 kB gzip more for the interactive mode, the first time it opens.
- A cookie is a device preference: a student who changes device starts again in interactive mode.

### Follow-ups

- #243: motion tokens, in their own PR (`MOTION.md` table as input).
- #244: `buildDeck` and `DeckInput` in `packages/content`. In `check-content`, reject `debut`/`fin`
  as block ids and duplicate block ids within a chapter.
- #245: shell, switch button, cookie, URL, keyboard, `motion` behind a dynamic import.
- #246: full-screen exercise. (No store to lift any more: §1, amended.)
- Teacher courses (`/cours/[coursId]`, F3) also render through `ChapterView`. They get the
  interactive mode in a later issue; this ADR covers catalogue chapters only.

## Alternatives considered

- **CSS transitions plus the View Transitions API.** 0 kB, and the browser does the work. Rejected
  for now: React's `<ViewTransition>` is only stable from React 19.3 and Brio runs 19.2. Next 15
  exposes it behind `experimental.viewTransition`. CSS has no exit animation for an element React
  removes, and no finger-following swipe. To be reconsidered once stable in React and Next, since
  the motion contract (`transform` and `opacity` only) would carry over.
- **`motion/mini` (3.4 kB).** Enough for imperative tweens, but no `AnimatePresence`, no drag and no
  `useReducedMotion`. We would rewrite most of what the full library provides.
- **Slide breaks written by the author** (a block type, or a flag on a block). Rejected: it means
  editing 45 chapters and teaching it to teachers, for a split the rules above already get right
  on the catalogue.
- **A slide id derived from its position** (`?diapo=4`). Rejected: inserting a block shifts every
  link after it.
- **A separate route** (`/…/<slug>/diapo/<id>`). Rejected: two URLs for one chapter, and a page
  change that would lose the exercise state when switching modes.
- **Mode stored in the account.** Rejected for now: it needs a backend change and a round trip on
  each chapter, for a preference nobody has asked to share between devices.
- **Prose as an ordinary lead** (the first version of rule 2). On the catalogue it left 35 one-line
  introductions alone on their slide, separated from the callout they introduce.
