# brio

Educational web platform for French secondary-school students (collège/lycée):
courses, curriculum-grounded AI-tutor chatbots, exercises with AI correction,
XP/progression, teacher-authored content, and student chat rooms.

- **backend/** — Spring Boot, Java 21, Maven (modular monolith, Spring Modulith)
- **web/** — Next.js (App Router), TypeScript, Tailwind
- **mobile/** — Expo (added later)
- **Data** — PostgreSQL + pgvector, Redis; Flyway migrations

See `.claude/CLAUDE.md` for architecture and conventions.

## First-time setup

After cloning, enable the shared git hooks (Conventional Commits + push
protection). One command does it:

```sh
scripts/setup.sh
```

That runs `git config core.hooksPath .githooks`. Hooks live in `.githooks/`
and need no Node/pnpm — the backend team can commit without a JS toolchain.

## Git workflow

- **`main`** is production. **`develop`** is the integration branch (auto-deploys
  to staging). Branch off **`develop`**, never `main`; merge back into `develop`
  via PR.
- **Branch names:** `feature/<issue>-<slug>` (also `fix/` and `chore/`).
- **Start a branch:**

  ```sh
  scripts/start-feature.sh 42 "Curriculum import endpoint"
  # -> feature/42-curriculum-import-endpoint, off an up-to-date develop
  ```

- **Commit messages** — Conventional Commits with a mandatory issue reference:

  ```
  <type>(<scope>): <description> (#<issue>)
  ```

  Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`. Scope is optional
  (a backend module name, or `web`/`infra`/`ci`). Example:

  ```
  feat(catalog): add curriculum import endpoint (#42)
  ```

  The `commit-msg` hook rejects anything else; the `pre-push` hook blocks direct
  pushes to `main`/`develop`. Both can be bypassed with `--no-verify` when you
  genuinely need to.

## CI

Three parallel jobs run on every PR targeting `develop` and on every push to
`develop`. A superseded run for the same ref is cancelled automatically.

| Job | Command | What it checks |
|---|---|---|
| `backend` | `./mvnw -B verify` | Unit tests, Testcontainers integration tests, Modulith boundary verification, OpenAPI contract |
| `web` | `pnpm build && pnpm lint && pnpm test` | TypeScript compilation, Next.js build, ESLint, Vitest |
| `content` | `node scripts/check-competencies.mjs` | Competency codes referenced by chapters exist in the referential |

**Reproduce locally:**

```sh
# backend
cd backend && ./mvnw -B verify

# web (no backend required)
pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test

# content
node scripts/check-competencies.mjs
```

**API contract workflow** — run when you change a controller:

```sh
# 1. The test detects the drift and writes the updated spec:
cd backend && ./mvnw verify
# OpenApiContractTest fails; backend/target/openapi-actual.json has the new spec.

# 2. Accept the change (deliberate, visible in the diff):
cp backend/target/openapi-actual.json docs/api/openapi.json

# 3. Regenerate the TypeScript client and confirm the test passes:
pnpm build && cd backend && ./mvnw verify
```

Alternatively, if a backend is running locally:

```sh
pnpm api:refresh   # fetches live spec → writes docs/api/openapi.json
pnpm build         # regenerates packages/api-client/src/generated/schema.d.ts
```

**Branch protection** — configure after the first CI run (jobs only appear in
the required-checks list once they have run at least once):

1. Go to **Settings → Branches → Add branch protection rule** for `develop`.
2. Enable **Require status checks to pass** and add `backend`, `web`, `content`.
3. Keep **Allow administrators to bypass** enabled — as sole admin, a broken CI
   would otherwise prevent you from merging the fix for the CI itself.
