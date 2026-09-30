# 0029 — Libre-service enseignant : classes oui, établissements non

- **Status**: Accepted
- **Date**: 2026-09-30
- **Deciders**: Pierce Broudin

## Context

A teacher who has just signed up (#184) has no établissement and no class, so can
neither publish a course nor give a devoir. Creating an établissement, creating a
class, assigning its principal teacher and generating its code were all reserved
to `ADMIN_BRIO` (ADR 0018 §6), and nothing created an `admin_brio` account outside
the `local` profile: the runbook prescribed a manual `UPDATE` in `psql`, then API
calls with no interface. That contradicts the cahier des charges' definition of
done — "sans intervention manuelle en base".

Two forces pull against simply opening everything to teachers:

- **The convention gate** (ADR 0018 §3). A class code only enrols a student when
  the class's établissement has a signed convention. An établissement created by a
  teacher would have none, so its codes would be refused — or the teacher would
  have to declare a convention themselves, turning a legal gate into a form field.
- **Teacher signup has no e-mail verification** (#184, out of scope there). Anyone
  who reaches the signup page gets a teacher account.

The link between a teacher and an établissement was also not stored: it was
derived from the classes the teacher was principal of. That cannot express "belongs
to this établissement but has no class yet", nor a replacement teacher who serves
several établissements.

## Decision

### 1. A teacher never creates an établissement

Établissements are created by `ADMIN_BRIO` only, as before. A teacher **picks**
among those that exist. The pick-list is public (`GET /api/etablissements`), since
it is needed before any session exists, and exposes only `id`, `nom` and `type` —
never the UAI or the convention fields.

### 2. A teacher is attached to one or several établissements

A new table records the membership:

```
identite.rattachements (
  compte_id        UUID NOT NULL,   -- identite.comptes ID
  etablissement_id UUID NOT NULL REFERENCES identite.etablissements,
  depuis           DATE NOT NULL,
  PRIMARY KEY (compte_id, etablissement_id)
)
```

Signup requires one établissement. More are added afterwards from the teacher
space (`POST /api/prof/etablissements`). Assigning a principal teacher to a class
(by an administrator) attaches them to that class's établissement, so a principal
teacher always belongs to it. Existing data is backfilled from the classes.

### 3. A teacher creates their own classes and codes

Under `/api/prof/**` (role `ENSEIGNANT`), always for the caller, taken from the
session:

- `POST /api/prof/classes` — in an établissement the teacher is attached to (403
  otherwise). The caller becomes the principal teacher. The school year is computed
  by the server and switches on 1 August.
- `POST /api/prof/classes/{id}/code` — for a class the caller is the principal of,
  with the default lifetime and usage cap (14 days, 40).

**This amends ADR 0018 §6**: "only ADMIN_BRIO can generate new codes" becomes
"ADMIN_BRIO, or the class's principal teacher". The rest of §6 stands: the code is
stored hashed, returned once, and a new code invalidates the previous one.

The administrator endpoints are unchanged.

### 4. A course names its établissement when the teacher has several

A course's établissement was derived from the teacher's classes and creation
failed unless exactly one came out. It is now taken from the rattachements: the
only one when there is one — so a teacher can start a course before having a class
— or the one named in the request, checked against the teacher's own, when there
are several.

### 5. The private environment gets one fictional établissement

`brio.etablissement-pilote.nom` (`BRIO_ETABLISSEMENT_PILOTE_NOM`), when set, creates
one établissement at startup with the convention reference `PILOTE-FICTIF`. It is
what lets a teacher of the private environment (ADR 0024, fictional data only)
pick an établissement and hand a working code to a student after a `reset.sh`.

**The convention gate is not weakened.** `POST /api/classes/rejoindre` checks the
convention exactly as before. The setting is absent in production, where nothing is
seeded and an établissement only gets a convention from an administrator.

## Consequences

### Positive

- A teacher goes from signup to a student in their class and a published course
  with no `psql` and no `curl`; the SQL step leaves the runbook.
- No one but an administrator can make an établissement exist, so no one but an
  administrator can make path A (ADR 0018) available somewhere.
- A replacement teacher is modelled rather than worked around.

### Negative / trade-offs

- Until teacher e-mails are verified, anyone who can sign up can attach themselves
  to any listed établissement and create classes in it. On the private environment
  this is bounded by the Caddy gate. **It must not reach a public environment as
  is** (see follow-ups).
- The list of établissement names is public. Names of schools are public
  information; nothing else about them is exposed.
- A class level is checked for shape only on the server (`identite` cannot depend
  on `contenu`, which already depends on it); the interface offers the catalogue's
  levels.
- A course can be scoped to any of its author's classes, including one in another
  of their établissements than the course's own. Course visibility is decided by
  class, so nothing leaks; the course's établissement is only its attribution.

### Follow-ups

Preconditions for a public opening, each its own issue:

- Verify a teacher's e-mail before the account is active.
- Validate a rattachement (by the établissement or an administrator) before it
  grants anything, or restrict it by e-mail domain.
- Create the first `admin_brio` without SQL, and give administrators an interface
  for établissements and conventions.
- Remove `BRIO_ETABLISSEMENT_PILOTE_NOM` from the environment at publication.

Not planned here: renaming or archiving a class; choosing a code's lifetime or
usage cap; a class code leading to path B for an établissement without convention.

## Alternatives considered

- **Teachers create their établissement** — rejected. It either makes class codes
  useless (no convention) or lets a teacher self-declare a convention, which is the
  legal basis ADR 0018 exists to protect. It also multiplies duplicate rows for the
  same school.
- **Provisioning by an administrator** (établissements, classes, invitations) —
  rejected for now. It needs an administration interface, an invitation flow and a
  bootstrap for the first administrator before a single teacher can work, which is
  out of proportion with a pilot.
- **Relax the convention gate on the private environment** — rejected. A flag that
  switches a legal check off is one misconfiguration away from production. Seeding
  fictional data that satisfies the unchanged check keeps the code path identical
  everywhere.
- **Keep deriving the établissement from classes** — rejected. It cannot represent
  a teacher before their first class, which is exactly the state this issue fixes.
