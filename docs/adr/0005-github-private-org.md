# 0005 — Host in a private GitHub organization

- **Status**: Accepted
- **Date**: 2026-08-16
- **Deciders**: Pierce

## Context

brio handles curriculum content, product code, and will later process student
data — none of which should be public. We need a hosting home for the monorepo
that supports access control, PR-based review, and CI/CD, and that can grow to
hold team members and automation.

## Decision

We will host the monorepo in a **private GitHub organization**, with `main` as
the protected default branch, changes landed via **pull requests**, and CI/CD on
GitHub Actions.

## Consequences

### Positive
- Private by default; org-level access control and teams as we grow.
- PR-based workflow with branch protection and required checks.
- Native GitHub Actions CI/CD, path-filtered per the monorepo layout (ADR 0003).
- Room for org-level automation, secrets, and environments.

### Negative / trade-offs
- Vendor lock-in to the GitHub ecosystem.
- Org administration (teams, permissions, billing) to maintain.

### Follow-ups
- Enable branch protection on `main` (required reviews + status checks).
- Set up path-filtered CI workflows for `backend/` and `web/`.
- Manage secrets via GitHub Actions/Environments, never in the repo.

## Alternatives considered

- **Personal repo** — rejected: no team/access model, weaker separation of
  ownership.
- **GitLab / self-hosted** — rejected: no benefit over GitHub for this team and
  adds operational burden.
