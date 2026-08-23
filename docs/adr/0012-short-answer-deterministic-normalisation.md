# 0012 — Short-answer grading: deterministic normalised exact match

- **Status**: Accepted
- **Date**: 2026-08-23
- **Deciders**: Pierce

## Context

The content schema (ADR 0004) defines a `short-answer` exercise type where students
type a word or short phrase. The exercise carries an `acceptedAnswers` array authored
by the teacher. We need a grading strategy that is correct, fast, cost-free, and
explainable to both teachers and students.

Three realistic strategies exist: exact string match (after normalisation), fuzzy
match (e.g. Levenshtein distance), and LLM-based semantic evaluation.

The main authoring challenge for short-answer is that the same correct answer has
many surface forms: "hypothénuse" / "Hypothénuse" / "hypothenuse" / "hypothénuse."
The grading strategy must collapse these to a single canonical form without
introducing false positives.

## Decision

We grade short-answer exercises with **deterministic normalised exact match**:

1. Apply the same normalisation pipeline to the submitted text *and* to every
   accepted answer before comparing.
2. Normalisation pipeline (in order):
   - Trim leading and trailing whitespace.
   - NFD Unicode normalisation + removal of all combining marks (accent removal).
   - Lowercase, **unless** `caseSensitive: true` (controls case-folding only;
     accent removal always applies).
   - Strip trailing `[\s.!?;]+` greedily (punctuation and trailing spaces are
     never semantically meaningful at the end of a short answer).
3. A blank or whitespace-only submission is rejected as an invalid answer
   (`InvalidAnswerException`), not scored as incorrect. A non-attempt is not
   an error and must not pollute progression data.
4. Teachers are responsible for enumerating accepted surface variants in
   `acceptedAnswers`. The `explanation` field is de facto required: it is the
   only feedback channel available to a student who answers incorrectly.
5. Accepted answers are never sent to clients.

## Consequences

### Positive
- Grading is free, instant, and fully deterministic — reproducible in unit tests
  without any external dependency.
- Explainable to students and teachers: "your answer is compared letter-for-letter
  after normalisation."
- No risk of hallucinated grading or inconsistent scores across identical
  submissions.
- `caseSensitive: true` enables meaningful distinctions (variable names, point
  labels) without requiring separate exercise types.

### Negative / trade-offs
- Teachers must enumerate variants explicitly (`hypothénuse`, `l'hypothénuse`,
  `les deux côtés de l'angle droit`, …). Authoring overhead is real.
- A misspelling that preserves the root (`hypothenus`) is marked incorrect even
  if the student clearly understood the concept. This is by design: the evaluator
  tests knowledge, not approximate recall.
- French synonyms or regional vocabulary (e.g. *cathètes* vs *côtés de l'angle
  droit*) must be explicit variants; the system will not infer equivalence.

### Follow-ups
- AUTHORING.md must document the variant-enumeration requirement and make
  `explanation` mandatory for short-answer exercises.
- A linting rule or schema constraint could enforce `explanation` presence on
  `short-answer` blocks at authoring time (future issue).

## Alternatives considered

- **Fuzzy matching (Levenshtein / edit distance)** — rejected. A threshold that
  accepts `hypothenus` (1 edit) also accepts `hypotènuse` (1 edit from the
  normalised form) — both wrong in different ways. Choosing the threshold is
  arbitrary, and any threshold that reduces false negatives also increases false
  positives. "Determinism" and "explainability" are impossible to maintain.

- **LLM semantic grading** — rejected for this type. Brio already uses
  LLM correction for `free-text` exercises (reference answer + rubric). For a
  short-answer — a single word or phrase with a correct answer the teacher knows —
  introducing an LLM adds latency, cost, and non-determinism for no benefit.
  A normalised exact match is the right tool when the answer space is finite and
  enumerable.
