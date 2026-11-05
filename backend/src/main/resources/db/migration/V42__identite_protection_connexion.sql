-- Server-side login protection (ADR 0017 §7, amended by #305): progressive lockout per
-- identifiant and per-IP rate limiting, stored in Postgres — not Redis, which is absent from
-- the deployed stack (ADR 0034). Both are server-controlled: a client cannot reset them.

-- Progressive lockout: a row per identifiant that failed to log in. After enough failures
-- the row carries a lock until `verrou_jusqu_a`; a successful login deletes the row.
CREATE TABLE identite.echecs_connexion (
    identifiant        VARCHAR(320) PRIMARY KEY,   -- normalised (trimmed, lower-cased); may be an e-mail
    nb_echecs          INTEGER     NOT NULL DEFAULT 0,
    verrou_jusqu_a     TIMESTAMPTZ,                -- NULL while not locked
    derniere_tentative TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate limiting: a fixed one-minute window counter per truncated client IP (never a full IP —
-- that is personal data for a minor's connection, ADR 0017 §5).
CREATE TABLE identite.debit_connexion (
    ip_tronquee   VARCHAR(45) PRIMARY KEY,         -- last octet (IPv4) / last 64 bits (IPv6) removed
    fenetre_debut TIMESTAMPTZ NOT NULL DEFAULT now(),
    nb            INTEGER     NOT NULL DEFAULT 0
);
