CREATE TABLE identite.etablissements (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nom                  TEXT        NOT NULL,
    uai                  VARCHAR(8)  UNIQUE,          -- code UAI, nullable until verified
    type                 VARCHAR(10) NOT NULL
        CHECK (type IN ('college', 'lycee')),
    -- Both fields non-null enables path A enrollment (ADR 0018 §3)
    convention_signee_le DATE,
    convention_reference TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
