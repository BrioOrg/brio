# Design Backlog

Elements of the Arcade direction that are deliberately not built yet.
Each entry names the dependency blocking it. This list exists to prevent
these elements from reappearing inside a feature or styling PR — if you
encounter one of them, check here before building.

Referenced by `docs/design/README.md`.

---

## Atlas path and chapter locks

**What**: the hexagonal node map showing completed, active, and locked
chapters with their progression state, banner, and the dashed route line.

**Blocked by**: the `progression` module. Locked chapters require knowing
which chapters a student has completed; the active node requires the
current chapter. Neither is available until `progression` ships and exposes
a published API to `contenu`.

**Mockup reference**: `2-parcours-atlas.html`.

---

## XP display and level badge

**What**: the XP counter in the top bar, the level badge on the student's
profile, and the "+15 XP" animation on correct answers.

**Blocked by**: the `progression` module (XP accumulation and level
thresholds). Showing a fabricated value is not acceptable: the product is
used by minors and falsifying progress data is a trust issue, not an
aesthetic one.

**Mockup reference**: `1-connexion-matiere-parcours.html` (top-bar stat),
`3-lecon-qcm.html` (XP win badge).

---

## Streak flame

**What**: the flame icon and day-count in the top bar (e.g. "7 jours").

**Blocked by**: the `progression` module (streak tracking). Until streak
data exists, the element must not appear — not even at zero.

**Mockup reference**: `1-connexion-matiere-parcours.html`,
`2-parcours-atlas.html`.

---

## Photo correction UI

**What**: camera capture of handwritten work, editable transcription panel
with maths keypad, maths rendering preview, self-assessment fallback after
three failed transcription attempts.

**Blocked by**: the photo-correction feature of the `exercices` module
(OCR + transcription pipeline, server-side maths normalisation). Also
blocked on camera permissions handling across iOS Safari, Android Chrome,
and desktop browsers.

**Mockup reference**: `5-correction-photo.html`.

---

## Mascot (caméléon Brio)

**What**: the animated chameleon that reacts to correct/incorrect answers
in the lesson flow, and appears as the tutor avatar.

**Blocked by**: illustration assets (the SVG character set has not been
commissioned). Also blocked on the animation spec (idle, celebrate, sad,
thinking states) which must be derived from the illustration before being
implemented.

The tutor avatar currently uses a placeholder icon; the lesson flow has no
mascot reactions.

**Mockup reference**: `2-parcours-atlas.html` (path mascot),
`3-lecon-qcm.html` (reaction states), `6-tuteur-ia.html` (avatar).

---

## Bottom navigation bar (app shell)

**What**: the four-tab bar (parcours, social, exercices, profil) at the
bottom of the phone shell.

**Blocked by**: the social and profil modules, which do not exist yet. A
navigation bar with disabled or fake tabs would misrepresent the product's
scope.

**Mockup reference**: `2-parcours-atlas.html`.

---

## Completion percentage on chapter cards

**What**: the "Chapitre 4 · 45%" sub-label on subject cards and chapter
rows.

**Blocked by**: the `progression` module. `contenu` knows which chapters
exist; it does not know how far a student has progressed through them.

**Mockup reference**: `1-connexion-matiere-parcours.html`.
