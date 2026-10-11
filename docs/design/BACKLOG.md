# Design Backlog

Elements of the Arcade direction that are deliberately not built yet.
Each entry names the dependency blocking it. This list exists to prevent
these elements from reappearing inside a feature or styling PR — if you
encounter one of them, check here before building.

Referenced by `docs/design/README.md`.

---

## Still blocked

### Mascot moods and reactions (caméléon Brio)

**What**: the chameleon reacting to correct and incorrect answers in the
lesson flow (interactive mode included, #240), and its idle, celebrate,
thinking and "on regarde ensemble" states.

**Exists**: the character itself (`web/components/ui/mascot.tsx`, #83) with
two simple moods, `calm` and `happy`, drawn from the mockup. It appears on the
atlas.

**Blocked by**: illustration assets. The other moods have not been drawn, and
their animation spec must be derived from the drawings, not the other way
round. Until then the mascot stays out of the exercise feedback, in reading
mode and in interactive mode (MOTION.md).

**Mockup reference**: `3-lecon-qcm.html` (reaction states),
`6-tuteur-ia.html` (avatar).

---

### Photo correction: transcription and AI

**What**: editable transcription of handwritten work with a maths keypad,
maths rendering preview, AI correction, self-assessment fallback after three
failed transcription attempts.

**Exists**: the student photographs or scans their work and attaches it to a
homework submission; the teacher grades it (F5, ADR 0028).

**Blocked by**: step 2 of F5 (OCR, transcription, server-side maths
normalisation), which ADR 0028 explicitly leaves out.

**Mockup reference**: `5-correction-photo.html`.

---

### Social and profile tabs

**What**: the "social" and "profil" tabs of the bottom navigation bar.

**Exists**: the bar itself, with parcours, devoirs and annales wired
(`web/components/bottom-nav.tsx`).

**Blocked by**: the social and profile modules. The two tabs are rendered
disabled rather than linking nowhere.

**Mockup reference**: `2-parcours-atlas.html`.

---

## Delivered (no longer blocked)

These entries were blocked by the `progression` module. It exists now
(ADR 0022), so they are unblocked, and they have shipped. The rule that
blocked them still holds: they show **only real values** from `progression`,
and nothing to a logged-out visitor or a teacher.

| Element | Where | Issue |
|---|---|---|
| Atlas path and chapter locks | `chapter-atlas.tsx` | #79 |
| XP display, level and the "+N XP" on a correct answer | `xp-badge.tsx`, exercise result | #80 |
| Streak flame | `streak-badge.tsx` | #81 |
| Completion percentage on chapter cards | subject page | #82 |
| Completion gauge at the top of a chapter | `chapter-progress.tsx` | #222 |

Interactive mode (#240) animates these values (XP flight, counters, end
slide); how they move is set by `MOTION.md`.
