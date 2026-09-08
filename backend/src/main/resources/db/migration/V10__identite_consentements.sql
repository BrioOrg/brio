CREATE TABLE identite.consentements (
    compte_id       UUID        NOT NULL,   -- identite.comptes ID
    type            VARCHAR(30) NOT NULL,
    donne_par_email TEXT        NOT NULL,
    donne_at        TIMESTAMPTZ NOT NULL,
    preuve          TEXT        NOT NULL,   -- opaque token from the validation email
    revoque_at      TIMESTAMPTZ,
    PRIMARY KEY (compte_id, type)
);
