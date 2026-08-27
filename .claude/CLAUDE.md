# brio

Educational web platform for French secondary-school students (collège/lycée):
courses, curriculum-grounded AI-tutor chatbots, exercises with AI correction,
XP/progression, teacher-authored content, and student chat rooms.

## Stack

- **backend/** — Spring Boot, Java 21, Maven. Modular monolith (Spring Modulith).
- **web/** — Next.js (App Router), TypeScript, Tailwind.
- **mobile/** — Expo (added later).
- **Data** — PostgreSQL + pgvector, Redis. Flyway migrations.

Monorepo, flat layout. JS side is a pnpm workspace orchestrated by Turborepo.

## Repo layout

```
backend/    Spring Boot API (Maven)
web/        Next.js web app
mobile/     Expo app (later)
docs/adr/   Architecture Decision Records
.claude/    Agent config: this file + path-scoped rules/
```

## Prerequisites

- JDK 21, Maven 3.9+
- Node 20+, pnpm 9+
- Docker (Postgres + Redis via compose)

## Commands

### Infra (from repo root)
- `docker compose up -d` — start Postgres (pgvector) + Redis
- `docker compose down` — stop infra

### Backend (from `backend/`)
- `./mvnw spring-boot:run` — run the API
- `./mvnw test` — unit + module tests
- `./mvnw verify` — full build incl. integration tests (Testcontainers)
- `./mvnw spotless:apply` — format Java
- Flyway migrations run on startup; add SQL under `src/main/resources/db/migration`.

### Web / mobile (from repo root)
- `pnpm install` — install workspace deps
- `pnpm dev` — run all dev servers (turbo)
- `pnpm --filter web dev` — web only
- `pnpm build` — build all
- `pnpm lint` — lint all
- `pnpm test` — unit tests (Vitest)
- `pnpm test:e2e` — Playwright e2e

## Backend architecture

Domain modules (not layers), enforced by Spring Modulith. Base package `fr.brio`:

| Module        | Responsibility                                  |
|---------------|-------------------------------------------------|
| `identite`    | accounts, authentication, roles                 |
| `contenu`     | courses, curriculum structure                   |
| `ia`          | AI-tutor chatbots (RAG over curriculum)         |
| `exercices`   | exercises + AI correction                       |
| `progression` | XP, levels, streaks                             |
| `social`      | student chat rooms                              |
| `system`      | cross-cutting infrastructure (health, CORS, security) |
| `shared`      | cross-cutting value types (no domain logic)     |

Rules: modules talk only through published `api` packages or application
events — never reach into another module's internals. Reference other modules
by ID, not by object. A Modulith `verify()` test guards these boundaries.

See `.claude/rules/` for the enforced backend and web conventions.

## Design

- **Visual direction**: `docs/design/visuels/` — the normative reference for the
  "Arcade" direction. **Frozen: never edit those files.** They are the original
  the implementation is compared against. Context and rationale:
  `docs/design/README.md`.
- **All** colours, fonts, sizes, radii, shadows and durations come from
  `web/app/tokens.css`. Components use **semantic** tokens only — never
  primitives, never raw values. (Until the design-foundations issue lands that
  file does not exist yet: do not style new UI ad hoc, ask first.)
- Never introduce a colour, font, size, radius, shadow or duration outside
  tokens. If one is genuinely missing, propose a `tokens.css` change in its
  **own PR** — never bundled with a feature.
- Compare any UI change against the `/design` styleguide before opening the PR.
- No pre-styled component kits (daisyUI, Flowbite, MUI, Tailwind templates).
  Headless primitives (Radix and the like) are fine with every default style
  removed.
- **Never display data the backend does not have.** XP, levels, streaks,
  completion percentages and chapter locks appear in the mockups but depend on
  modules that do not exist. No placeholder, no fabricated value — this product
  is used by minors.

## Conventions

- **Language**: user-facing copy is French; code, identifiers, comments English.
- **Git**: one feature branch per change, PR into `develop` (see Git workflow
  below). Keep PRs small and reviewable.
- **Secrets**: never commit. Use `.env` (gitignored); provide `.env.example`.
- **Decisions**: significant/architectural choices get an ADR in `docs/adr/`
  (copy `template.md`, next number, status `Proposed` → `Accepted`).

## Git workflow

- Branch from `develop`, **never `main`** (`main` is production).
- Names: `feature/<issue>-<slug>`, plus `fix/` and `chore/` (same shape).
- Start one with `scripts/start-feature.sh <issue> "<description>"`.
- Commits: Conventional Commits with a required issue ref —
  `<type>(<scope>): <description> (#<issue>)`; types `feat|fix|chore|docs|test|refactor`,
  scope optional (module name or `web`/`infra`/`ci`).
- Hooks in `.githooks/` enforce this (`scripts/setup.sh` to enable).
- **Never push without asking me first.**

## Don't

- Don't add cross-module dependencies that bypass a module's `api`.
- Don't put secrets or third-party copyrighted content (textbooks, commercial
  annales) in the repo. Official public curriculum data (BOEN programmes,
  attendus — Licence Ouverte) *belongs* in `content/` (ADR 0008).
- Don't edit `docs/design/visuels/`, or fabricate UI state (XP, streaks,
  progress) — see Design above.
- Don't introduce a new library without a short rationale (ADR or PR note).
- **No absolute paths in committed files** — hook scripts, settings, CI config, or anything else. Use `$CLAUDE_PROJECT_DIR` (with `$(git rev-parse --show-toplevel)` as fallback) for paths that must be absolute at runtime. An absolute path in a committed file silently breaks on every machine with a different home directory.
