---
description: Codegen, API client, env config, and Prettier-hook conventions established with the initial web setup
globs: "{web,packages}/**/*.{ts,tsx,js,jsx,json,css}"
alwaysApply: false
---

# Frontend conventions — codegen, api-client, env, formatting

## OpenAPI code generation

- Generator: `openapi-typescript` (pure types, no runtime) + `openapi-fetch` (typed fetch wrapper).
- Generated output: `packages/api-client/src/generated/schema.d.ts` — **gitignored, do not commit**.
- Regenerate: `pnpm generate:api` against a running backend (`API_BASE_URL` controls the source URL).
- The typed client factory (`createApiClient`) lives in `packages/api-client/src/client.ts` and wraps `openapi-fetch` with the generated `paths` type.

## Manual typed wrappers

Actuator endpoints (e.g. `/actuator/health`) are not captured by springdoc-openapi by default.
Until `springdoc.show-actuator=true` is added to the backend config, wrap them manually in
`packages/api-client/src/health.ts` with a Zod-validated response type.
Once they appear in the spec, replace the manual wrapper with a generated typed call via `createApiClient`.

## `@brio/api-client` package rules

- Ships TypeScript source; **no build step**. Next.js uses `transpilePackages`, Vitest uses a path alias.
- Must have **zero** Next.js, React, or any web/mobile framework imports. Expo will reuse it as-is.
- All external API responses must be validated with **Zod** at the boundary.

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `API_BASE_URL` | `pnpm generate:api` (Node script) | URL of the backend to fetch the OpenAPI spec from |
| `NEXT_PUBLIC_API_URL` | Next.js app at runtime | URL the browser/SSR calls for API requests |

Keep them separate. In CI, `API_BASE_URL` can point at a deployed instance while
`NEXT_PUBLIC_API_URL` stays at `http://localhost:8080` for the build.
Neither variable should be hardcoded anywhere in source — always read from `process.env`.

## Formatting vs linting

- **Prettier** is the formatter. It runs automatically via the PostToolUse hook in
  `.claude/settings.json` on every edit to `/web` and `/packages` files.
- **ESLint** handles code quality only. `eslint-config-prettier` is always the last entry in
  `eslint.config.mjs`, disabling all rules that conflict with Prettier's decisions.
- **Do not add `eslint-plugin-prettier`** — it duplicates the hook and causes fights.

## Testing

- Tests live alongside their subjects under `__tests__/` directories.
- Tests must not require a running backend. Mock `fetch` with `vi.stubGlobal`.
- Async Server Components can be called directly as functions: `render(await Page())`.
- Use `vi.resetModules()` in `beforeEach` so module-level env reads are re-evaluated per test.
