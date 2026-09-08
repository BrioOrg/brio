# 0016 — Modèle scolaire et comptes mineurs

- **Status**: Accepted
- **Date**: 2026-09-08
- **Deciders**: Pierce Broudin

## Context

The `identite` module is empty. Every subsequent chantier (F0–F6) requires knowing
who the student is, which class they belong to, and who authorised their account.
Before writing any code, the structural decisions must be recorded — they cannot
be corrected after migrations are applied and data exists.

Brio handles personal data of minors (students aged 11–18 in collège/lycée). French
law (art. 45 loi Informatique et Libertés, transposing art. 8 GDPR) requires the
consent of the holder of parental authority for accounts of children under 15. The
core design constraint is minimisation: collect only what is strictly necessary,
and keep it in the narrowest scope possible.

## Decision

### 1. Schema

One Postgres schema `identite` (ADR 0007 — no cross-schema FK; inter-module
references are IDs only).

```
identite.etablissements (
  id           UUID PRIMARY KEY,
  nom          TEXT NOT NULL,
  uai          VARCHAR(8) UNIQUE,          -- code UAI, nullable until verified
  type         VARCHAR(10) NOT NULL        -- 'college' | 'lycee'
    CHECK (type IN ('college', 'lycee')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)

identite.comptes (
  id                    UUID PRIMARY KEY,
  role                  VARCHAR(20) NOT NULL
    CHECK (role IN ('eleve', 'enseignant', 'admin_etab', 'admin_brio')),
  identifiant_connexion VARCHAR(100) NOT NULL UNIQUE,  -- credential only, never displayed
  mot_de_passe_hash     TEXT NOT NULL,
  -- Adult roles (enseignant, admin_etab, admin_brio) only:
  nom                   TEXT,
  email                 TEXT,
  -- Élève accounts only:
  email_titulaire_legal TEXT,
  statut                VARCHAR(30) NOT NULL DEFAULT 'en_attente_consentement'
    CHECK (statut IN ('actif', 'en_attente_consentement', 'suspendu', 'clos')),
  etablissement_id      UUID NOT NULL REFERENCES identite.etablissements,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  dernier_acces_at      TIMESTAMPTZ,
  CONSTRAINT adulte_identifie
    CHECK (role = 'eleve' OR (nom IS NOT NULL AND email IS NOT NULL)),
  CONSTRAINT eleve_minimise
    CHECK (role != 'eleve' OR email_titulaire_legal IS NOT NULL)
)

identite.classes (
  id                     UUID PRIMARY KEY,
  etablissement_id       UUID NOT NULL REFERENCES identite.etablissements,
  niveau_code            VARCHAR(10) NOT NULL,    -- '4e', '3e', etc.
  libelle                TEXT NOT NULL,           -- '4e B'
  annee_scolaire         VARCHAR(9) NOT NULL,     -- '2026-2027'
  enseignant_principal_id UUID NOT NULL,          -- identite.comptes ID
  statut                 VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (statut IN ('active', 'archivee')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
)

identite.inscriptions (
  classe_id         UUID NOT NULL,          -- identite.classes ID
  compte_id         UUID NOT NULL,          -- identite.comptes ID
  nom_affiche       TEXT NOT NULL,          -- typed by teacher, class-scoped
  role_dans_classe  VARCHAR(20) NOT NULL DEFAULT 'eleve'
    CHECK (role_dans_classe IN ('eleve', 'enseignant')),
  depuis            DATE NOT NULL,
  jusqua            DATE,
  PRIMARY KEY (classe_id, compte_id)
)

identite.invitations (
  code        VARCHAR(12) PRIMARY KEY,
  classe_id   UUID NOT NULL,              -- identite.classes ID
  cree_par    UUID NOT NULL,              -- identite.comptes ID
  expire_at   TIMESTAMPTZ NOT NULL,
  usages_max  SMALLINT NOT NULL DEFAULT 40,
  usages      SMALLINT NOT NULL DEFAULT 0
)

identite.consentements (
  compte_id       UUID NOT NULL,          -- identite.comptes ID
  type            VARCHAR(30) NOT NULL,
  donne_par_email TEXT NOT NULL,
  donne_at        TIMESTAMPTZ NOT NULL,
  preuve          TEXT NOT NULL,          -- opaque token from the validation email
  revoque_at      TIMESTAMPTZ,
  PRIMARY KEY (compte_id, type)
)
```

No `identite.sessions` table in this ADR — session storage is decided in ADR 0017.

### 2. Minors carry no name

An élève account stores no name of any kind. The only identifying fields are
`identifiant_connexion` (a credential) and `email_titulaire_legal` (for the
consent workflow).

The display name is `identite.inscriptions.nom_affiche`, typed by the teacher when
they build their class list. It is:
- visible only within that class,
- set independently per class (a student in two classes has two independently-set
  display names, intentionally — no global identity to correlate),
- decided entirely by the teacher.

Adults are the deliberate exception: `enseignant`, `admin_etab`, and `admin_brio`
accounts carry a real name and email. Adults are identified; minors are
pseudonymised within a class scope.

**This asymmetry must never be "harmonised" without a new ADR.**

### 3. Display-name deduplication is a form hint, not code

When a teacher sets a `nom_affiche` that already exists in that class, the UI
warns and suggests adding an initial ("Il y a déjà une Léa dans cette classe —
vous pourriez écrire « Léa B. »"). The teacher decides. No surname is stored, no
algorithm produces the suffix, no field holds more than what the teacher typed.

Trying to automate this would require storing the surname we just eliminated — and
would still produce "Léa B." twice for Bernard and Blanc.

### 4. `identifiant_connexion` is a credential, not a display name

`identifiant_connexion` is used exclusively for authentication. It must never
appear in a message thread, a class list, a notification, or any user-visible
surface. A naive implementation renders it as a fallback name; that single
rendering undoes the entire minimisation design.

This invariant is enforced by a test: no code path from `identite.api` returns
`identifiant_connexion` in a response type intended for display.

### 5. Consent is required for every élève account; no birthdate is stored

Every `compte élève` is created with `statut = 'en_attente_consentement'`.
The account becomes `actif` only after the titulaire légal validates the email
sent to `email_titulaire_legal`.

An account in `en_attente_consentement` may read the public catalogue and nothing
else. It cannot submit exercises, use the tutor, or appear in a class roster.

No date of birth is stored. The cost of a stored birthdate is a mid-year state
transition (the 15th birthday) and a field about a child; the benefit is sparing
some students older than 15 from a parental email. That trade is not worth making,
and a self-declared age from a student who wants in is not a compliance artifact.
This decision is revisited when lycée accounts are introduced, as a separate ADR.

Collective attestation by the teacher is explicitly rejected: a teacher's
attestation is not consent by the holder of parental authority, and it would make
the teacher personally load-bearing for someone else's legal obligation.

### 6. Legal basis is not settled by this ADR

This ADR records the consent mechanism. It does not declare the legal basis for
processing. Where Brio operates under a school's public-service mission, the
applicable basis may be that mission (not consent), with Brio acting as
sous-traitant. That determination requires legal consultation and changes the
contracts, the privacy notice, and the obligations. Write it down after the
consultation; do not infer it from this ADR.

### 7. Migration of `student_ref`

`exercices.soumissions.student_ref VARCHAR(256)` is replaced by
`eleve_id UUID NOT NULL`. No cross-schema FK (ADR 0007). Referential integrity
is applicative. Development rows are discarded, not migrated.

## Consequences

### Positive

- No surname ever stored for a minor → narrowest possible RGPD surface before any
  feature ships.
- Display name is class-scoped: a data leak from one class does not expose a
  student's identity in another class or to an outside party.
- The consent mechanism is explicit, auditable (the `identite.consentements` table
  is the paper trail), and independent of session implementation.
- The schema is additive: SSO ENT/GAR (if added later) replaces how
  `identifiant_connexion` is verified, not the account structure itself.

### Negative / trade-offs

- Teachers must type each student's display name. There is no import from a class
  list file. This is intentional (§2); a bulk import is a separate, scoped feature
  that must respect the same minimisation rules.
- The asymmetry between adult and minor accounts (name present vs. absent)
  requires careful handling at every layer that renders accounts. The invariant
  in §4 must be tested, not assumed.
- `en_attente_consentement` accounts can read the public catalogue — meaning an
  unapproved student can already see course content. This is acceptable: the
  catalogue is public. If it later becomes gated, the statut check already exists.

### Follow-ups

- **ADR 0017** — Authentication and sessions (cookie + Spring Security, CSRF,
  basic auth fail-fast, password policy).
- Ticket: Flyway migrations V8–V14 for the `identite` schema.
- Ticket: replace `exercices.soumissions.student_ref` (migration + application
  layer).
- Ticket: consent email sender (triggered on account creation, resendable).
- Ticket: class-list UI — teacher creates class, adds students, sets nom_affiche,
  with deduplication warning.
- **Legal consultation** before writing the privacy notice and the registre des
  traitements (§6).
- Registre des traitements entry for `identite` — to be written in the same
  sprint as the migrations, not after.

## Alternatives considered

- **Pseudonym chosen by the student** — rejected. A student-chosen pseudonym
  breaks the teacher's ability to recognise their class. The teacher's display
  name is more useful than student autonomy over a handle that serves no purpose
  at this stage.

- **Name on the account, pseudonym optional** — rejected. Storing a name on the
  account leaks it across class boundaries and survives class archival. Keeping
  it class-scoped by design costs nothing structurally and eliminates the leak.

- **Collective consent / teacher attestation** — rejected. See §5.

- **Date of birth stored for the 15-year threshold** — rejected. See §5.

- **Cross-schema FK from `exercices.soumissions` to `identite.comptes`** — rejected
  by ADR 0007. The reference is an ID; integrity is applicative.

- **SSO ENT/GAR from the start** — deferred. An ENT integration is a contractual
  and technical engagement of its own. The account structure chosen here does not
  preclude it; `identifiant_connexion` can be replaced by an external token
  without touching the rest of the schema.
