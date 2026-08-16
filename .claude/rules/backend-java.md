---
description: Conventions for backend Spring Boot / Java code
globs: "backend/**/*.java"
alwaysApply: false
---

# Backend conventions (Java 21, Spring Boot, Spring Modulith)

Base package: `fr.brio`. One package per domain module directly under it
(`fr.brio.catalog`, `fr.brio.tutoring`, …). `shared` holds cross-cutting value
types only — no domain logic, no dependencies on other modules.

## Module boundaries (Spring Modulith)

- A module exposes a published **`api`** sub-package (interfaces, DTOs, events).
  Everything else is internal and stays package-private.
- Modules interact **only** through another module's `api` or via application
  events (`ApplicationEventPublisher`). Never import an internal type of another
  module.
- Reference other modules by **ID**, not by entity/object.
- Keep a Modulith verification test that calls `ApplicationModules.verify()`;
  boundary violations must fail the build.

## Structure inside a module

Organise by role, package-private by default:
- `api` — published contracts (interfaces, request/response records, events).
- `domain` — entities, value objects, domain services.
- `infrastructure` — JPA repositories, external adapters (LLM, Redis, etc.).
- `web` — REST controllers (thin; delegate to application/domain services).

## Java style

- Prefer **records** for DTOs, events, and value objects; favour immutability.
- Use **sealed** types for closed hierarchies where it clarifies intent.
- Return `Optional<T>` from lookups; never return `null` from public APIs.
- **Constructor injection only** — no field/`@Autowired` injection, no setters.
- Validate inputs with Bean Validation (`@Valid`, constraint annotations).
- Centralise error handling in a `@RestControllerAdvice`; return structured
  problem responses, not stack traces.

## Persistence

- JPA + Flyway. Every schema change is a versioned migration under
  `src/main/resources/db/migration` — never edit an applied migration.
- Entities do not cross module boundaries. Map to `api` DTOs at the edge.
- pgvector is used for RAG embeddings in `tutoring`; keep vector concerns inside
  that module's `infrastructure`.

## AI / LLM code

- Default to the latest, most capable Claude models for new AI features.
- Keep prompts, model IDs, and provider clients inside the owning module's
  `infrastructure`; expose only a domain-level port through `api`.
- Ground tutor/correction responses in curriculum content (RAG) — no ungrounded
  free generation for student-facing answers.

## Testing

- JUnit 5. Use `@ApplicationModuleTest` for per-module slices; avoid booting the
  whole app (`@SpringBootTest`) for unit-level tests.
- **Testcontainers** for Postgres/Redis in integration tests (run in `verify`).
- Name tests `should…`/`given…when…then…`; assert behaviour, not implementation.
