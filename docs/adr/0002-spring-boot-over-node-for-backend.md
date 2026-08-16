# 0002 — Spring Boot (Java 21) over Node for the backend

- **Status**: Accepted
- **Date**: 2026-08-16
- **Deciders**: Pierce

## Context

The backend carries the domain-heavy, long-lived core of brio: enforced module
boundaries, relational data with migrations, background AI workloads (RAG,
correction), and a need for strong typing and mature tooling. We evaluated
building it in Node/TypeScript (sharing the web language) versus a JVM stack.

## Decision

We will build the API in **Spring Boot on Java 21**, built with Maven. The web
and mobile apps remain TypeScript; the language boundary is accepted in exchange
for the JVM's strengths on the server.

## Consequences

### Positive
- **Spring Modulith** gives first-class, verifiable module boundaries (ADR 0001).
- Mature ecosystem: JPA/Flyway, Bean Validation, Testcontainers, Spring AI.
- Strong static typing, records, virtual threads, and excellent observability.
- Clear separation of concerns from the TS front-end.

### Negative / trade-offs
- Two languages in the monorepo (Java + TypeScript); no shared domain code.
- Heavier runtime and slower cold start than Node.
- Contributors need JVM familiarity.

### Follow-ups
- Share types across the boundary via a generated API contract (e.g. OpenAPI),
  not hand-written duplicates.

## Alternatives considered

- **Node.js / NestJS** — rejected: weaker enforced-modularity story and less
  mature data/testing tooling for a domain-heavy core, despite one-language
  appeal.
