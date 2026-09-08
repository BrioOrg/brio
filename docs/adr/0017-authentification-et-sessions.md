# 0017 — Authentification et sessions

- **Status**: Accepted
- **Date**: 2026-09-08
- **Deciders**: Pierce Broudin

## Context

ADR 0016 defines the account and class model. This ADR defines how those accounts
authenticate and how sessions are managed. The two decisions are intentionally
separate: the legal basis for consent, the account structure, and the class model
(ADR 0016) are what an établissement or regulator will ask to see; the session
mechanism is what an engineering review will ask to see. When ENT/GAR SSO arrives,
it replaces the session mechanism and touches nothing in ADR 0016.

Currently the application uses HTTP Basic Auth in all environments, protected only
by a profile guard. Basic Auth over HTTP/2 with no session persistence means
every request carries a credential, and the credential is re-validated on every
call. That is not acceptable for user-facing accounts.

## Decision

### 1. Session cookies with Spring Security

Sessions are managed by Spring Security's `HttpSession` mechanism. The backing
store is in-memory for all current deployments (single-instance VPS, F0 launch).
Redis-backed sessions (`spring-session-data-redis`) are introduced when the first
of these triggers is reached: a second application instance is added, or
zero-downtime deploys are required. The Redis infrastructure already exists for
the tutor's prompt cache; the swap is a single configuration change if the session
objects remain serializable.

Session cookies are set with:
- `HttpOnly` — not accessible to JavaScript
- `Secure` — only sent over HTTPS (relaxed to `false` in the `local` profile only)
- `SameSite=Lax` — blocks cross-site POST-based CSRF while allowing top-level
  navigation (sufficient for Brio's same-origin frontend)

### 2. CSRF protection re-enabled

Spring Security's CSRF protection is re-enabled for all state-mutating endpoints.
The CSRF token is delivered via `CookieCsrfTokenRepository.withHttpOnlyFalse()`:
the `XSRF-TOKEN` cookie is readable by JavaScript, and the frontend must echo it
in the `X-XSRF-TOKEN` request header on every mutating request. This requires
`allowCredentials(true)` in `CorsConfig` and exact (not wildcard) origin matching.

### 3. Basic auth is forbidden outside the `local` profile

Basic Auth is retained **only** on the `local` Spring profile (local development
without a browser), as a separate `@Profile("local")` `SecurityFilterChain` bean.
On all other profiles, a `BasicAuthGuard` component (`@Profile("!local")`)
inspects the registered filter chains at startup and throws `IllegalStateException`
if any chain contains a `BasicAuthenticationFilter`. Fail-fast, not fail-silent:
a misconfigured production instance must not start, not start insecurely.

A dedicated integration test verifies that the context refuses to start when Basic
Auth is active without the `local` profile.

### 4. API endpoint paths

| Action | Method | Path |
|--------|--------|------|
| Log in | `POST` | `/api/sessions` |
| Log out | `DELETE` | `/api/sessions` |
| Current user | `GET` | `/api/moi` |

These paths follow the resource-shaped convention of the existing API
(`/api/catalogue`, `/api/chapitres/…`, `/api/exercices/{id}/soumissions`).

Spring Security's logout is configured with `logoutRequestMatcher` on
`DELETE /api/sessions` (the default is `POST /logout`). The login processing URL
is `/api/sessions`. Both success and failure handlers write JSON, never redirects.

### 5. Session audit table

```
identite.sessions (
  id              UUID PRIMARY KEY,
  compte_id       UUID NOT NULL,        -- identite.comptes ID
  cree_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expire_at       TIMESTAMPTZ NOT NULL,
  ip_tronquee     VARCHAR(32),          -- last octet removed for IPv4, last 64 bits for IPv6
  user_agent_hash VARCHAR(64)           -- SHA-256, not stored in clear
)
```

The table is append-only for audit purposes. It is not the session store (that is
in-memory HttpSession, or Redis when triggered by §1). On logout or expiry the
in-memory session is invalidated; the audit row is retained for the duration of
the data retention policy (to be defined in the registre des traitements). IP
truncation is required: a full IP from a minor's home connection is personal data.

### 6. Password hashing: BCrypt strength 12 via DelegatingPasswordEncoder

`DelegatingPasswordEncoder` is the encoder registered as the `PasswordEncoder`
bean. The default delegate is `BCryptPasswordEncoder` at strength 12. The
`{bcrypt}` prefix stored in `mot_de_passe_hash` makes the algorithm and parameters
explicit and makes future migration to a stronger algorithm (see §7) a
configuration change with on-login rehashing — no bulk migration required.

Strength 12 is intentionally slower than the Spring Security default (10) to
increase brute-force cost. Test configurations override to strength 4 to keep the
test suite fast.

### 7. Password policy for students

Collège students will choose weak passwords. The response is rate limiting and
progressive lockout, not complexity rules that push them to write the password on
their pencil case.

- **No minimum complexity rule** for student accounts. A passphrase of sufficient
  length is accepted without special characters.
- **Progressive lockout**: 5 failed attempts triggers a 15-minute lockout of that
  `identifiant_connexion`. The lockout is server-side (stored in Redis); it is
  not a client-side counter.
- **Rate limiting** on the login endpoint regardless of lockout: 20 attempts per
  minute per IP (truncated, not full).
- **No security question, no SMS reset** — both introduce more risk than they
  mitigate. Password reset is by email to `email_titulaire_legal` for students,
  to the account's own email for adults.

Teacher and admin accounts carry higher expectations and may be subject to stricter
policy in a future ADR; this ADR sets the floor for student accounts only.

### 8. JWT is explicitly rejected

JWT shifts session state from server to client. The benefit — stateless
horizontal scaling — does not apply at current scale, and the trigger for Redis
sessions (§1) arrives first. The cost of JWT for a student-facing product is a
token-rotation machinery (refresh tokens, expiry clocks, revocation lists) that
must be correct to prevent a stolen token from remaining valid after a reported
incident. Cookies + server-side sessions revoke instantly. ENT/GAR SSO, if it
arrives, uses SAML or OIDC — neither requires JWT for internal session management.

## Consequences

### Positive

- Sessions revoke instantly on logout or suspension — critical for accounts of
  minors.
- Progressive lockout is server-controlled; a client cannot reset it.
- Fail-fast Basic Auth guard makes misconfiguration a deployment error, not a
  silent security gap.
- The session mechanism is orthogonal to the account model: ENT/GAR SSO can
  replace authentication (how a `compte` is verified) without altering the class
  structure, the consent workflow, or the display-name design of ADR 0016.
- `DelegatingPasswordEncoder` makes password algorithm migration transparent:
  no bulk rehash, users are rehashed on next successful login.

### Negative / trade-offs

- In-memory session store means a restart logs out all active users. Acceptable
  for F0 (single VPS, pilot class); must be revisited before multi-instance
  deployment (see §1 trigger).
- CSRF token delivery requires the frontend to read the `XSRF-TOKEN` cookie and
  echo it on mutating requests. This is a standard pattern but must be wired
  explicitly in the Next.js API layer (separate ticket).
- Password reset by email to `email_titulaire_legal` means a locked-out student
  depends on a parent to unlock their account. Acceptable for the consent model
  of ADR 0016; revisit if a separate student-email policy is introduced.

### Follow-ups

- Frontend: `XSRF-TOKEN` cookie read and echo in `@brio/api-client`.
- Rate-limiting middleware (Spring's `HandlerInterceptor` or a dedicated filter).
- Password reset flow (email → tokenised link → new password).
- Redis session store when §1 trigger is reached.

## Alternatives considered

- **JWT (stateless tokens)** — rejected. See §8.

- **SameSite=Strict** — considered; rejected because it breaks OAuth callback
  redirects and any future top-level navigation from an external link (e.g. a
  teacher sharing a chapter URL by email). `Lax` is the correct default for a
  content site with a same-origin frontend.

- **Argon2 for password hashing** — Argon2id is the stronger algorithm and its
  memory-hardness matters for weak student passwords. However,
  `Argon2PasswordEncoder` in `spring-security-crypto` requires BouncyCastle
  (`bcprov-jdk18on`) on the runtime classpath — Spring Security does not bundle
  it. Adding a large security-sensitive dependency for zero users is not the
  right trade. `DelegatingPasswordEncoder` makes the switch cost-free when the
  time comes: add BouncyCastle, change the default delegate, existing `{bcrypt}`
  hashes continue to work and are rehashed on next login.

- **ENT/GAR SSO from the start** — deferred. See ADR 0016 §7.
