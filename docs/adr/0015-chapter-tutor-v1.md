# 0015 — Chapter tutor v1: full-chapter context, verified citations, no retrieval

- **Status**: Accepted
- **Date**: 2026-08-27
- **Deciders**: Pierce Broudin

## Context

Five chapters are live. The product needs a per-chapter AI tutor that students
can query while reading. The `ia` module was empty. This ADR records the
decisions made in building its first iteration.

The core structuring decision is **no retrieval in v1**. A chapter is
2 000–5 000 tokens and fits entirely in context. Introducing vector retrieval
over a document that can be passed whole would add the single largest source of
hallucination — a retrieval that misses the relevant passage — to solve a
problem that does not exist at this corpus size. pgvector enters in v2, when
the tutor must reach across prerequisite chapters. Anthropic's prompt caching
makes the repeated chapter prefix nearly free.

## Decision

We implement a blocking HTTP endpoint `POST /api/chapitres/{niveau}/{matiere}/{slug}/tuteur`
inside the `ia` module. On every request it:

1. Loads the full client-facing chapter document via `contenu.api.ChapitreContentApi`
   (published API — Modulith boundary respected).
2. Assembles a prompt where every block is prefixed with its address
   `[section:<id> block:<id>]` and wrapped in `<CHAPITRE>…</CHAPITRE>` delimiters.
   The chapter prefix is marked with `cache_control: ephemeral` for prompt caching.
3. Forces the model to respond through a single `repondre` tool:
   `{ repondable: boolean, reponse: string, citations: string[] }` where each
   citation is a `sectionId/blockId` path.
4. Applies four server-side gates before returning anything to the client:

   - **Gate 1** — `repondable: false`: return a fixed refusal string. Never the
     model's prose.
   - **Gate 2** — any citation that does not resolve to a block in this chapter:
     one regeneration with a hardened instruction, then refusal.
   - **Gate 3** — empty citation list: refusal (no regeneration).
   - **Gate 4** — exercise disclosure filter (active when `exerciceId` is set):
     parse the exercise's `evaluationJson` (obtained from `ExerciceContentApi`),
     check the response for the numeric expected answer within its per-exercise
     tolerance (floor: `1e-9`) or for the text of the correct choice. On a hit:
     one regeneration with a hardened instruction, then a generic hint.

5. Persists nothing. Student questions are personal data of minors; not storing
   them is the simplest correct answer until the RGPD work of the accounts
   chantier.

### HTTP client

`RestClient` (Spring 6 Web — already a dependency). Blocking, no added dependency.

**Streaming trade-off noted but deferred.** The Anthropic Messages API streams
over SSE. `RestClient` does not handle SSE idiomatically; `WebClient` (WebFlux)
does. If streaming becomes a near-term requirement for chat UX latency, the
client layer should be replaced before it is built around. Shipping blocking now
and revisiting is the correct call while the feature is unproven.

### Authentication

The endpoint requires authentication, unlike the read-only `/chapitres` siblings.
The distinction is not "another chapter endpoint" but that every request calls a
paid third-party API. An unauthenticated surface is a scriptable cost-and-abuse
vector in a way that serving already-public curriculum JSON never is.

### System prompt

Stored in `src/main/resources/ia/system-prompt-v1.txt`. Not inlined in Java — it
is content, its changes must be reviewable in a diff.

### Default model

`claude-haiku-4-5-20251001`, configurable via `brio.ia.model`. The model and base
URL are the only tunable parameters; the API key is injected from the environment
(`BRIO_IA_API_KEY`, gitignored).

## The honest limit

For a maths exercise the answer is often deducible from the lesson. No server-side
filter makes indirect disclosure impossible — a student can ask "give me an example
with 6 and 8 as the two shorter sides." Gates 1–4 make **direct** disclosure
impossible and indirect disclosure expensive. That is the achievable goal. The ADR
records it rather than promising more.

## Consequences

### Positive

- Grounded, citation-verified answers with no retrieval complexity.
- Four independent anti-disclosure layers; each can be strengthened independently.
- No data persisted → no RGPD surface on student questions.
- Prompt caching keeps repeated chapter prefixes nearly free.
- System prompt is versionable via normal code review.

### Negative / trade-offs

- Whole-chapter context means the model sees every block on every request, even
  when the question touches only one section. Acceptable at 2 000–5 000 tokens;
  revisit when chapters grow or when cross-chapter recall is needed.
- Blocking HTTP call. Latency is the mean Anthropic response time (~2 s for Haiku).
  Acceptable for v1; streaming requires `WebClient`.
- The disclosure filter is heuristic. It covers numeric and multiple-choice
  exercises; short-answer exercises have no filter (the answer is a phrase and
  phrase-matching is unreliable). Structural fix: the system prompt instruction not
  to reveal answers is layer 1; the filter is a backstop.

### Follow-ups

- **T2** — evaluation harness and eval set.
- **T3** — frontend chat UI.
- **v2** — pgvector cross-chapter retrieval when the corpus grows beyond one chapter.
- Streaming if latency becomes a UX issue (replace `RestClient` with `WebClient`).
- Short-answer disclosure filter if needed.

## Alternatives considered

- **Spring AI / LangChain4j** — rejected. The Messages API is a small HTTP
  contract, and for a tutor every token must be visible. A framework abstracts
  exactly the layer that must be understood and controlled here.

- **Vector retrieval (pgvector)** — deferred to v2. The full chapter fits in
  context. Retrieval introduces a new failure mode (retrieval miss) without solving
  a real problem at this corpus size.

- **Streaming (SSE)** — deferred. Latency is acceptable for v1; the blocking
  implementation is simpler and avoids a WebFlux dependency. Noted for v2.

- **Conversation history** — out of scope. Adds persistence, which is blocked on
  the RGPD work of the accounts chantier.
