CREATE SCHEMA IF NOT EXISTS identite;

CREATE TABLE identite.comptes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role                  VARCHAR(20)  NOT NULL
        CHECK (role IN ('eleve', 'enseignant', 'admin_etab', 'admin_brio')),
    identifiant_connexion VARCHAR(100) NOT NULL UNIQUE,
    mot_de_passe_hash     TEXT         NOT NULL,
    -- Adult roles (enseignant, admin_etab, admin_brio) only:
    nom                   TEXT,
    email                 TEXT,
    -- Élève accounts only:
    email_titulaire_legal TEXT,
    statut                VARCHAR(30)  NOT NULL DEFAULT 'en_attente_consentement'
        CHECK (statut IN ('actif', 'en_attente_consentement', 'suspendu', 'clos')),
    -- Nullable until établissements table is introduced (ADR 0016, follow-up ticket)
    etablissement_id      UUID,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    dernier_acces_at      TIMESTAMPTZ,
    -- Adults must be identified; minors must not carry a name (ADR 0016 §2 and §4)
    CONSTRAINT adulte_identifie
        CHECK (role = 'eleve' OR (nom IS NOT NULL AND email IS NOT NULL)),
    CONSTRAINT eleve_minimise
        CHECK (role != 'eleve' OR email_titulaire_legal IS NOT NULL)
);
