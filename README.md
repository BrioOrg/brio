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
