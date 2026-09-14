-- Pending consent requests: holds the bearer token (hashed) until the parent confirms.
-- A row is deleted once consumed; only one pending request per (compte, type).
CREATE TABLE identite.demandes_consentement (
    compte_id   UUID        NOT NULL,
    type        VARCHAR(30) NOT NULL,
    token_hash  TEXT        NOT NULL,   -- SHA-256 hex of the bearer token sent by email
    expire_at   TIMESTAMPTZ NOT NULL,   -- 7 days from creation
    envoye_a    TEXT        NOT NULL,   -- parent e-mail address at send time
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (compte_id, type)
);

-- Revocation bearer token added to confirmed consent rows.
-- Distinct from the confirmation token: leaked revocation can only suspend, never activate.
ALTER TABLE identite.consentements
    ADD COLUMN revocation_token_hash TEXT,
    ADD COLUMN revocation_token_expire_at TIMESTAMPTZ;
