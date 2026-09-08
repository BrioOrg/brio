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

Sessions are managed by Spring Security's `HttpSession` mechanism, backed by a
server-side session store (in-memory for development; Redis for production, using
the existing Redis dependency).

Session cookies are set with:
- `HttpOnly` — not accessible to JavaScript
- `Secure` — only sent over HTTPS
- `SameSite=Lax` — blocks cross-site POST-based CSRF while allowing top-level
  navigation (sufficient for Brio's same-origin frontend)

### 2. CSRF protection re-enabled

Spring Security's CSRF protection is re-enabled for all state-mutating endpoints.
The existing `SecurityConfig` already notes this intention. The CSRF token is
delivered via a cookie readable by the frontend (`XSRF-TOKEN`) and echoed in the
`X-XSRF-TOKEN` request header — the standard Spring Security / Next.js pattern
that requires no session for the token itself.

### 3. Basic auth is forbidden outside the `local` profile

Basic Auth is retained **only** on the `local` Spring profile (local development
without a browser). On all other profiles (`dev`, `staging`, `prod`), the
`SecurityConfig` bean fails fast at application startup if Basic Auth is
configured. Fail-fast, not fail-silent: a misconfigured production instance must
not start, not start insecurely.

A dedicated integration test verifies that the `prod` profile refuses startup when
Basic Auth is active.

### 4. Session audit table

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
Redis). On logout or expiry the session store entry is deleted; the audit row is
retained for the duration of the data retention policy (to be defined in the
registre des traitements). IP truncation is required: a full IP from a minor's
home connection is personal data.

### 5. Password policy for students

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

### 6. JWT is explicitly rejected

JWT shifts session state from server to client. The benefit — stateless
horizontal scaling — does not apply: Brio already has Redis for the tutor's
prompt cache and session state adds negligible load. The cost of JWT for a
student-facing product is a token-rotation machinery (refresh tokens, expiry
clocks, revocation lists) that must be correct to prevent a stolen token from
remaining valid after a reported incident. Cookies + server-side sessions revoke
instantly. ENT/GAR SSO, if it arrives, uses SAML or OIDC — neither requires JWT
for internal session management.

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

### Negative / trade-offs

- Redis is now a hard runtime dependency (it was already present for the tutor's
  prompt cache, so no new operational burden).
- CSRF token delivery requires the frontend to read the `XSRF-TOKEN` cookie and
  echo it on mutating requests. This is a standard pattern but must be wired
  explicitly in the Next.js API layer.
- Password reset by email to `email_titulaire_legal` means a locked-out student
  depends on a parent to unlock their account. Acceptable for the consent model
  of ADR 0016; revisit if a separate student-email policy is introduced.

### Follow-ups

- Flyway migration for `identite.sessions`.
- Redis session store configuration (`spring.session.store-type=redis`) for
  non-local profiles.
- `SecurityConfig` update: CSRF on, Basic Auth guard, session cookie flags.
- Integration test: `prod` profile fails to start with Basic Auth active.
- Frontend: `XSRF-TOKEN` cookie read and echo in `@brio/api-client`.
- Rate-limiting middleware (Spring's `HandlerInterceptor` or a dedicated filter).
- Password reset flow (email → tokenised link → new password).

## Alternatives considered

- **JWT (stateless tokens)** — rejected. See §6.

- **SameSite=Strict** — considered; rejected because it breaks OAuth callback
  redirects and any future top-level navigation from an external link (e.g. a
  teacher sharing a chapter URL by email). `Lax` is the correct default for a
  content site with a same-origin frontend.

- **Argon2 for password hashing** — preferred over bcrypt if the Spring Security
  version in use supports it without an additional dependency. Decision deferred
  to implementation; either is acceptable, the choice belongs in the `SecurityConfig`
  comment, not this ADR.

- **ENT/GAR SSO from the start** — deferred. See ADR 0016 §7.
