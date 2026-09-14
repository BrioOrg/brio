-- One active code per class at a time; bearer credentials stored as SHA-256 hash (ADR 0018 §6)
CREATE TABLE identite.codes_classes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash   TEXT        NOT NULL UNIQUE,   -- SHA-256 hex of the raw 12-char code
    classe_id   UUID        NOT NULL REFERENCES identite.classes,
    cree_par    UUID        NOT NULL,           -- identite.comptes ID (no FK per ADR 0007)
    expire_at   TIMESTAMPTZ NOT NULL,
    usages_max  INTEGER     NOT NULL DEFAULT 40,
    usages      INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
