# 0001 — Modular monolith over microservices

- **Status**: Accepted
- **Date**: 2026-08-16
- **Deciders**: Pierce

## Context

brio spans several distinct capabilities (accounts, catalog, authoring, AI
tutoring, exercises + correction, progression, chat). These need clear
boundaries, but the product is early-stage and built by a very small team.
Microservices would impose network calls, distributed transactions, independent
deployments, and operational overhead before we have the scale or team to
justify them. We still want the boundaries to be real and enforced, not just a
convention.

## Decision

We will build the backend as a **modular monolith**: a single Spring Boot
deployable, organised into domain modules (not technical layers), with module
boundaries enforced at build time by **Spring Modulith**. Modules communicate
only through published `api` packages or application events.

## Consequences

### Positive
- One build, one deployment, one database connection to operate.
- In-process calls: no network latency or distributed-transaction complexity.
- Enforced boundaries keep the domain decoupled and refactorable.
- Clear seams make later extraction of a module into a service low-cost if ever
  needed.

### Negative / trade-offs
- The whole app scales and deploys as a unit.
- Discipline required so modules don't leak internals; relies on Modulith
  verification staying green.

### Follow-ups
- Add a Modulith `ApplicationModules.verify()` test to the build.
- Document module boundaries (see `.claude/CLAUDE.md` and backend rules).

## Alternatives considered

- **Microservices** — rejected for now: operational and cognitive cost far
  exceeds current team size and scale.
- **Traditional layered monolith** — rejected: layers don't encode domain
  boundaries and tend toward a big ball of mud.
