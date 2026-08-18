# 0007 — One database schema per module, no cross-schema joins

- **Status**: Accepted
- **Date**: 2026-08-18
- **Deciders**: Pierce

## Context

Spring Modulith enforces module boundaries in the Java layer: modules may only
interact through published `api` packages or application events, never by
importing internal types. But nothing in the stack prevents a JPA repository
from joining across tables that belong to different modules. Such a join couples
the modules at the SQL level — bypassing the Java boundary entirely and creating
a dependency that is invisible to Modulith's verification test.

This matters now because `contenu` is the first module to own domain tables, and
the pattern set here will be followed by every module that follows.

## Decision

**Each domain module owns exactly one PostgreSQL schema, named after the module.
A module may only read another module's data through that module's Java public
API or through domain events — never via a SQL join across schemas.**

Rules:

1. Tables for module `foo` live in the `foo` PostgreSQL schema, not in `public`.
2. Repositories in module `foo` query only tables in the `foo` schema.
3. If module `bar` needs data owned by module `foo`, it calls `foo`'s published
   Java interface (in `fr.brio.foo.api`) or consumes a domain event. No SQL.
4. Foreign keys may reference tables within the same module's schema.
   Cross-schema foreign keys in DDL are not used — the relationship is enforced
   by the application layer (Java) rather than the database.

**Exception — `public` schema infrastructure tables:** The Spring Modulith JPA
event publication store (`event_publication`) lives in `public` and is not moved.
It is framework infrastructure, not domain data, and has no application-level
repositories reading it directly. This exception is limited to tables managed by
Spring Modulith itself.

## Applied to `contenu`

The first application of this rule: `contenu.chapitres` and `contenu.exercices`
are created in the `contenu` schema (migration `V2__contenu_schema.sql`). The
`exercices` module will reference exercise IDs across the boundary via
`fr.brio.contenu.api.ExerciceContentApi`, not via a direct table join.

## Consequences

### Positive
- Module boundaries are enforced at two independent layers (Java via Modulith,
  SQL via schema isolation), giving defence in depth.
- Cross-module data access is always visible in the Java call graph — a grep for
  a module's API interface shows all callers.
- If a module is ever extracted into a separate service, the SQL boundary already
  matches the service boundary; no cross-schema joins to untangle.

### Negative / trade-offs
- Cross-module reporting queries (e.g. "all submissions for a chapter") must go
  through the Java layer or be served by a dedicated read model — not a single SQL
  join. Acceptable at this scale; a CQRS read model is the right tool when needed.
- Developers must remember to qualify table names with the schema in all DDL and
  native queries.

## Alternatives considered

**Everything in `public`.** Common default, but eliminates the SQL-level boundary
and makes it easy to accidentally join across modules. Rejected because the
boundary violation would be invisible to Modulith and hard to detect in review.

**Separate database per module.** Maximally isolated, but operationally heavy
for a modular monolith at this stage. Deferred — the schema-per-module layout
is already compatible with eventual extraction if needed.
