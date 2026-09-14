CREATE TABLE identite.classes (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    etablissement_id        UUID        NOT NULL REFERENCES identite.etablissements,
    niveau_code             VARCHAR(10) NOT NULL,
    libelle                 TEXT        NOT NULL,
    annee_scolaire          VARCHAR(9)  NOT NULL,
    -- Nullable until teacher-class assignment flow ships (follow-up ticket)
    enseignant_principal_id UUID,
    statut                  VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (statut IN ('active', 'archivee')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
