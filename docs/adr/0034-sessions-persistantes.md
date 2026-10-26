# 0034 — Sessions persistantes (Spring Session JDBC)

- **Status**: Proposed
- **Date**: 2026-10-26
- **Deciders**: Pierce Broudin

## Context

ADR 0017 §1 kept sessions in the backend's memory and deferred a shared store until a
second instance or zero-downtime deploys were needed. Since ADR 0024 §10, every merge
into `develop` with a green CI is deployed automatically, and a deploy restarts the
backend: every student and teacher is logged out, whatever the session length (12 h
sliding since #279). On 2026-10-26, ten merges meant ten general logouts (#300). The
trigger of ADR 0017 §1 is reached in substance: deploys must no longer cost users
their session.

ADR 0017 §1 assumed Redis: it is in the development `docker-compose.yml` and was meant
for the tutor's prompt cache and the login lockout. In fact nothing in the backend uses
Redis today (no client on the classpath), and the deployed stack
(`docker-compose.prod.yml`) has no Redis service. Postgres, on the other hand, runs
everywhere: deployed, in local development, and in every integration test
(Testcontainers).

## Decision

We will store HTTP sessions in **Postgres, with Spring Session JDBC**
(`spring-session-jdbc`, version managed by Spring Boot).

1. **Tables** `identite.spring_session` and `identite.spring_session_attributes`,
   created by Flyway (`V38__identite_session_store.sql`, Spring Session's PostgreSQL
   schema in the `identite` schema, ADR 0007). Spring Session's own schema
   initialisation is off. They are the session *store*; `identite.sessions` remains
   the append-only audit log of ADR 0017 §5.
2. **Behaviour unchanged.** Idle timeout 12 h, sliding (every request carrying the
   session renews it), still from `server.servlet.session.timeout`. The cookie keeps
   the name `JSESSIONID` and the attributes of ADR 0017 §1 (`HttpOnly`, `Secure`
   except in `local`, `SameSite=Lax`, session-scoped). The web middleware, the logout
   handler and the e2e fake backend are untouched. Expired rows are deleted by Spring
   Session's cleanup job (every minute).
3. **Serialisation: JDK serialisation** (Spring Session's default). The only
   attribute is Spring Security's `SecurityContext` (principal = compte ID, no
   password: credentials are erased after authentication). A deploy that changes a
   serialised class — a Spring Security upgrade, typically — leaves rows the new code
   cannot read. Such an attribute is read as **absent** (logged at WARN), so the user
   is logged out and takes the "session expirée" path of #279, never a 500.
4. **Concurrent-session control** (`maximumSessions(5)`) counts sessions in the store
   (`SpringSessionBackedSessionRegistry`), not in an in-memory map emptied by each
   restart.
5. **Snapshots exclude session rows** (`pg_dump --exclude-table-data`): a session ID
   in a dump would let its reader act as that user. Restoring a snapshot therefore
   logs everyone out, which is the expected state after a rollback.

Nothing changes on the deployed environment beyond the image: the migration runs at
startup, no service or variable is added.

## Consequences

### Positive

- A deploy or a restart logs nobody out; the 12 h sliding session of #279 means what
  it says.
- No new service to run, back up or monitor: the store is the database already there.
  Local development (`local` profile, `docker compose` Postgres) and the test suite use
  the same store as the deployed environment.
- Logout and revocation stay instant (ADR 0017 §8): logout deletes the row, and
  `StatutCheckFilter` still re-checks the account on every request.
- A second backend instance would share sessions as is.

### Negative / trade-offs

- Every authenticated request writes the session's last-access time (one indexed
  `UPDATE`). Negligible at the current scale; Redis would be cheaper per request if
  traffic grows by orders of magnitude.
- JDK serialisation ties stored sessions to class versions. A breaking change logs
  the affected users out once (by design, §3) instead of failing.
- The test `application.properties` shadows the main one on the test classpath, so
  the session settings are repeated there; `SessionPersistanceIntegrationTest` loads
  the main file to check the deployed values.

### Follow-ups

- If Redis is introduced later (login lockout, ADR 0017 §7), moving sessions there is
  a dependency swap; it is not a reason on its own.

## Alternatives considered

- **Spring Session Data Redis** (ADR 0017 §1's assumption) — rejected for now. Redis
  is absent from the deployed stack: it would mean a new service, with persistence
  configured (AOF and a volume) or sessions would die with the Redis container, plus a
  new client library, health checks and memory on a 4 GB VPS. Its advantage, cheaper
  writes, does not matter at this scale.
- **JSON serialisation (Jackson + Spring Security modules)** — rejected: survives
  class changes better, but needs mix-ins for every principal type and is a known
  source of allow-list errors. With one attribute and graceful logout on failure
  (§3), JDK serialisation is enough.
- **Blue-green or rolling deploys keeping the old instance alive** — does not solve
  it: sessions in memory still die with the instance that holds them.
- **"Remember me" persistent token** — rejected in #279: a long-lived login cookie on
  a shared school computer is the risk the session-scoped cookie avoids.
