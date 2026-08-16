---
description: Conventions for the Next.js + TypeScript web app
globs: "web/**/*.{ts,tsx}"
alwaysApply: false
---

# Web conventions (Next.js App Router, TypeScript, Tailwind)

## TypeScript

- `strict` is on. **No `any`** — use `unknown` + narrowing, or a real type.
- Validate every external boundary (API responses, form input, env) with **zod**;
  infer types from schemas rather than hand-writing duplicates.
- Prefer `type` aliases and discriminated unions; keep props explicitly typed.

## App Router & data

- **Server Components by default.** Add `'use client'` only when you need state,
  effects, or browser APIs — push it as far down the tree as possible.
- Fetch data in Server Components or Route Handlers. Never expose secrets or call
  the LLM directly from the client; go through the Spring API / route handlers.
- Use `loading.tsx` / `error.tsx` and Suspense for async UI states.
- Keep server-only code out of client bundles (`server-only` where useful).

## Styling

- **Tailwind only** — no CSS-in-JS. Compose classes with a `cn`/`clsx` helper.
- Use design tokens / theme values, not hard-coded colors and spacing.
- Semantic, accessible HTML: labels, roles, keyboard support, adequate contrast.

## UI copy & i18n

- All user-facing copy is **French**. Keep strings ready for i18n (no
  concatenation of translated fragments).

## Components & structure

- Functional components, PascalCase names, one main component per file.
- File names kebab-case; colocate a component with its styles/tests.
- Keep components small and focused; extract logic into typed hooks/utilities.
- Minimise client state; prefer deriving from server data over duplicating it.

## Testing

- **Vitest + Testing Library** for unit/component tests; test behaviour and
  accessibility (query by role/label), not internals.
- **Playwright** for critical end-to-end flows.
