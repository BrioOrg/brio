# 0003 — Single monorepo for all apps

- **Status**: Accepted
- **Date**: 2026-08-16
- **Deciders**: Pierce

## Context

brio has multiple deployables — Spring Boot API, Next.js web, and later an Expo
mobile app — that share contracts (API shapes, content schema) and should evolve
together. A small team benefits from atomic, cross-cutting changes and a single
place for docs, ADRs, and agent configuration.

## Decision

We will keep everything in **one Git repository** with a flat layout:
`backend/`, `web/`, `mobile/`, plus shared `docs/` and `.claude/`. The
JavaScript/TypeScript side is a **pnpm workspace orchestrated by Turborepo**; the
backend builds independently with Maven.

## Consequences

### Positive
- Atomic changes across API and clients in a single PR/commit.
- One source of truth for ADRs, conventions, and agent rules.
- Turborepo caching keeps JS builds/tests fast as the repo grows.

### Negative / trade-offs
- Mixed toolchains (Maven + pnpm/Turborepo) in one repo.
- CI must scope jobs by changed paths to avoid rebuilding everything.
- Repo grows larger; access is all-or-nothing per contributor.

### Follow-ups
- Configure path-filtered CI (backend vs web).
- Decide how shared contracts are published across the language boundary
  (see ADR 0002 follow-up).

## Alternatives considered

- **Polyrepo (one repo per app)** — rejected: cross-cutting changes require
  coordinated PRs and version bumps; higher overhead for a small team.
