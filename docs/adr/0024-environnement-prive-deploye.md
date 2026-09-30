# 0024 — Environnement privé déployé

- **Status**: Accepted
- **Date**: 2026-09-28
- **Deciders**: Pierce Broudin, Gabrielle

## Context

CDC §3.3 puts deployment (F1) ahead of everything except identity: "Un module
d'authentification non déployé n'est pas un module d'authentification, c'est un
test d'intégration." We do not know whether the consent flow works, whether
session cookies survive a reverse proxy, or whether a student on a 4G phone can
create an account, until the application runs somewhere other than a laptop.

Today nothing is deployable: no Dockerfile, no production compose file, no
deployment configuration — only `ci.yml`. No e-mail is actually sent either:
`RecordingEmailSender` accumulates messages in memory, so the path-B student
signup (parental consent, ADR 0018) cannot complete outside tests.

CDC §6 describes a full public F1 (recette + production, deploy on merge,
monitoring, bounded log retention, truncated IPs, Anthropic DPA). On 2026-09-28
the scope was reframed (issue #154): the application is **not** going to be
published in the short term. F1 therefore delivers a **private environment** for
two people (Pierce, Gabrielle), with its own database that can be broken,
restored and reset — but built from **the same images and the same compose file
as a future production**, so that going public later is a configuration change,
not a rebuild. The public-launch items move to a separate F1b issue.

Two forces shape the decisions below:

- **Parity.** Every difference between this environment and a future production
  is a place where "it worked on the private instance" stops meaning anything.
  Differences must live in configuration (`.env`), never in images or code paths.
- **Minors.** Brio is used by collège students. The cheapest way to keep this
  environment out of the GDPR processing described in ADR 0018 is to guarantee it
  never holds a real student's data.

## Decision

### 1. Hosting: one OVH VPS in France, Docker Compose

We will run the environment on **a single OVH VPS** in a French datacenter, with
Docker Compose orchestrating every service. No Kubernetes, no managed platform.

The exact offer is chosen when the VPS is ordered (issue #154, tranche 4), against
these constraints:

- datacenter in France (EU data residency, as CDC §6 requires);
- **≥ 4 GB RAM** — the JVM backend, Next.js server, Postgres and Redis must fit
  with headroom;
- around **5 €/month**;
- a current Debian or Ubuntu LTS image;
- OVH's **automated backup** option available for the offer (see §7).

PostgreSQL runs in a container (`pgvector/pgvector`, the same image as local
development), not as a managed database.

### 2. Topology: one origin, Caddy in front

```
Internet ──443──▶ Caddy ──┬── /          ─▶ web      (Next.js server)
                          ├── /api/*     ─▶ backend  (Spring Boot)
                          └── /mailpit/* ─▶ mailpit  (web UI)

internal network only: postgres, redis, mailpit SMTP, backend:8080
```

- **Caddy** is the only container publishing ports (80, 443). It obtains and
  renews a Let's Encrypt certificate for the environment's domain automatically.
- **Same origin.** The web app is served on `/`, the API on `/api`. The browser
  sees a single origin, so `SameSite=Lax` session cookies and CSRF (ADR 0017 §1–2)
  work exactly as they will in production, and CORS is not involved at all.
- **Mailpit's UI** is served under `/mailpit` (Mailpit's `--webroot`), on the same
  origin and behind the same access control as the rest. One domain, one
  certificate.
- Postgres, Redis, the backend's own port and Mailpit's SMTP port are reachable
  only on the compose network.

A domain name is bought for this purpose (tranche 4); the environment lives on it
or on a subdomain of it.

### 3. Private access: HTTP password, SSH keys, firewall

The URL is public; access is not.

- Caddy's `basic_auth` protects **every** path, `/api` and `/mailpit` included.
  There is **one account per person** (Pierce, Gabrielle), so one can be revoked
  without rotating the other. Password hashes live in the server's `.env`.
- The password is asked **once per browser**: a correct one earns a cookie
  (`brio_gate`, 30 days, `Secure`, `HttpOnly`) whose value is a secret from the
  server's `.env`, and a request carrying it skips `basic_auth`. Added on
  2026-09-30 (#182) after the first real deployment: the API answers `401` to a
  visitor with no Brio session, the browser takes that as a rejection of the HTTP
  password it had remembered, and asks for it again on the next click. The cookie
  is shared by both accounts, so revoking a person means changing their hash
  **and** the secret.
- Caddy **strips the `Authorization` header** before proxying upstream. The
  environment password is an access-control credential for the edge, not an
  application credential; it has no reason to reach Spring. (Outside the `local`
  profile no filter reads it — ADR 0017 §3 — but it should not travel at all.)
- SSH accepts **key authentication only**; password login and root login are
  disabled.
- The host firewall allows inbound **22, 80, 443** only.

### 4. Parity with production: same images, configuration in `.env`

- The backend and web images are built from the repository's Dockerfiles; the
  environment runs `docker-compose.prod.yml`. A future production runs the same
  images and the same compose file.
- **Everything that differs between environments is an environment variable** in
  a `.env` file on the server: database credentials, Anthropic API key, SMTP
  host, domain, Caddy password hashes. The `.env` is never committed; the
  repository ships a `.env.example` listing every variable.
- The backend runs **without the `local` profile**. Consequences, all intended:
  - session cookies are `Secure` (ADR 0017 §1);
  - `BasicAuthGuard` is active, so a misconfigured instance refuses to start
    (ADR 0017 §3);
  - `LocalAccountSeeder` and `LocalContentSeeder` do not run, so the well-known
    dev credentials (`password`) never exist on a URL-reachable instance.
- The backend sets `server.forward-headers-strategy=framework` so that the scheme,
  host and client address it sees are Caddy's forwarded values, not the proxy's.
- Catalogue content is loaded by the existing `ingest` profile
  (`IngestCommand`), run as a one-off container against the same database.
  Accounts are created through the **real** flows — teacher signup, établissement
  and class creation, student signup — which is precisely what F1 exists to
  exercise.

### 5. The web image does not depend on its environment

`NEXT_PUBLIC_*` variables are inlined into the JavaScript bundle at build time.
Today the web app reads its API base URL from `NEXT_PUBLIC_API_URL` in
`web/lib/api.ts`, `session.ts`, `progression.ts` and `enrollment.ts`. That breaks
parity twice:

- the image would have to be rebuilt per environment;
- server-side rendering would call `https://<domain>/api`, go back out through
  Caddy, and be refused by the HTTP password.

We will therefore split the API base URL:

| Caller | Base URL | Source |
|---|---|---|
| Browser | `/api` (relative) | constant — same origin by construction |
| Next.js server (SSR, route handlers) | e.g. `http://backend:8080` | a server-only variable read **at runtime** |

`NEXT_PUBLIC_API_URL` is no longer used to reach the API at runtime. The
implementation, and the matching update to `.claude/rules/frontend.md` (which
currently documents `NEXT_PUBLIC_API_URL` as the runtime URL), belong to
tranche 2.

### 6. E-mail: SMTP to Mailpit

- A new SMTP-backed `EmailSender`, selected by configuration, becomes the
  implementation for every non-`local` profile.
- In the private environment its SMTP host is **Mailpit**: every message is
  captured and readable in the `/mailpit` UI; nothing leaves the server. This is
  what lets a path-B student signup complete end to end (consent e-mail read in
  Mailpit, link followed, account activated).
- At publication, only the SMTP host and credentials change — to an EU provider.
- `RecordingEmailSender` stays restricted to the `local` profile and tests: it
  grows in memory without bound and must never back a long-running instance.

### 7. Backups: OVH automated backup plus database-level scripts

Two mechanisms, because they answer different questions:

- **OVH's automated VPS backup option** is the off-server copy. It survives the
  loss of the VPS. It restores the **whole machine** to a past state — system,
  Docker volumes, `.env` — not the database alone.
- **`pg_dump`-based scripts** (`snapshot.sh`, `restore.sh`, `reset.sh`, tranche 4)
  act on the database only: take a named snapshot before a risky test, restore it,
  or reset to an empty schema (Flyway migrations + catalogue ingestion). These
  dumps live on the VPS itself; they are a convenience, not a disaster-recovery
  copy.

A backup is only proven by a restore. F1 is not done until one restore has
actually been performed and its date recorded (CDC §6 "restauration de
sauvegarde testée et datée").

### 8. Rule: no real student data on this instance

**No real student's personal data is entered on this environment before
publication.** Every account, class, établissement and message on it is fictional.

While this rule holds:

- the environment is outside the processing described in ADR 0018 — there is no
  legal basis to establish because there is no real data subject;
- the Anthropic DPA and the privacy-policy mention required by CDC §6 are deferred
  to F1b. Tutor questions still go to the Anthropic API, but they are written by
  the two of us about fictional students;
- a **monthly spending cap** is set in the Anthropic console, since the API key on
  this instance is real and the URL is reachable.

Breaking this rule — even "just one real class to try" — means doing F1b first.

### 9. From private to public: configuration only

| | Now (private) | Publication (F1b) |
|---|---|---|
| Access | Caddy `basic_auth` (+ gate cookie), one account per person | removed |
| SMTP | Mailpit | EU e-mail provider |
| Data | fictional, resettable | real; `reset.sh` disabled |
| Images, compose file | this ADR | unchanged |

### 10. Deploys follow `develop` automatically

*Added on 2026-09-30 (issue #186). Deploy on merge was first left to F1b; it is
brought forward for the private environment only.*

- A separate workflow, `deploy.yml`, runs when CI **succeeds** on a push to
  `develop` (or on demand). It opens an SSH connection to the VPS and nothing more.
- On the VPS, the key it uses is bound to `scripts/env/deploy.sh` by a forced
  command in `authorized_keys`: it gives no shell and cannot run anything else. A
  leaked key can, at worst, redeploy what is already on `develop`.
- The key, the host and the host's fingerprint are secrets of a GitHub environment
  restricted to `develop`.
- Images are still built on the server (§1): no registry, and no secret of the
  environment ever reaches GitHub.
- `deploy.sh` dumps the database before every deploy and stops if the dump fails,
  because the restart applies Flyway migrations unattended. `deploy.sh`,
  `restore.sh` and `reset.sh` share a lock, so an automatic deploy cannot overlap
  an operation run by hand.
- The repository is public, so the deploy logs are too. They show build output and
  commit hashes; the domain is masked. Accepted: nothing in them is a credential,
  and a failed deploy can be diagnosed without logging in to the server.
- Catalogue ingestion stays a manual step.

## Consequences

### Positive
- Session cookies, CSRF, the consent flow and the proxy chain are exercised in the
  exact configuration production will use (same origin, `Secure`, non-`local`).
- Going public is a set of `.env` and Caddyfile changes, not a new architecture.
- The environment costs roughly 5 €/month plus the backup option, and is available
  whenever it is needed (unlike a laptop).
- Mailpit makes every e-mail flow testable without any risk of mailing a real
  address.

### Negative / trade-offs
- One VPS is a single point of failure; acceptable for two users and fictional
  data, not for a school.
- We operate the machine ourselves: OS updates, Docker, disk space. There is no
  managed database.
- Restoring OVH's backup rolls back the whole server, so it is a last resort; the
  day-to-day path is the database scripts, whose dumps do not survive the loss of
  the VPS.
- The web app needs a change (§5) before it can be containerised properly — a
  small cost now that would otherwise surface as a per-environment rebuild.
- Everything outside CDC §6's private subset (monitoring, recette/production
  split, bounded log retention with truncated IPs, DPA) is explicitly not done
  yet. Deploy on merge was on this list until §10.
- Automatic deploys add an inbound credential held by GitHub, and public deploy
  logs (§10).

### Follow-ups
- **Tranche 2 — containers**: backend and web Dockerfiles, `docker-compose.prod.yml`,
  Caddyfile (same origin, `/mailpit`, `basic_auth`, `Authorization` stripped),
  `.env.example`; the §5 split of the API base URL and the update to
  `.claude/rules/frontend.md`.
- **Tranche 3 — e-mail**: SMTP `EmailSender` + Mailpit; `RecordingEmailSender`
  confined to `local` and tests.
- **Tranche 4 — deployment**: order the OVH VPS (+ automated backup), buy the
  domain, DNS, SSH/firewall hardening, `scripts/env/deploy.sh`, `snapshot.sh` /
  `restore.sh` / `reset.sh`, nightly snapshot, one dated restore, Anthropic
  spending cap.
- **F1b — public launch** (separate issue): recette/production, deploy on merge
  for those (the private environment has it, §10), dashboard (availability, 5xx, tutor failures, daily cost), bounded log retention
  with truncated IPs, Anthropic DPA + privacy policy, real SMTP provider, removal
  of the HTTP password.

## Alternatives considered

- **Hetzner** — EU datacenters and a comparable VPS offer; not named by CDC §6,
  and its main datacenters are outside France. OVH keeps the data in France.
- **Scaleway** — French and named by CDC §6, equally viable. OVH was chosen by the
  deciders; nothing in the architecture depends on that choice, since the compose
  file runs on any Linux VPS.
- **Mac + Tailscale** — free, but unavailable whenever the Mac is off or asleep, and
  nothing like production (no public domain, no certificate, no proxy).
- **Render** — the free plan sleeps services and deletes the database after
  ~30 days, which contradicts "a database we can break and restore".
- **Railway** — ~10–20 $/month, US-hosted, and a platform-specific architecture
  rather than our compose file; cookies across the platform's subdomains are
  awkward for a same-origin design.
- **Tailscale on the VPS instead of an HTTP password** — viable and arguably more
  private, but Caddy + domain + password is much closer to a real production
  deployment (public DNS, public certificate, edge proxy), which is the point of
  F1.
