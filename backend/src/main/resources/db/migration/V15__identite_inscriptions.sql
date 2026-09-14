CREATE TABLE identite.inscriptions (
    classe_id        UUID        NOT NULL REFERENCES identite.classes,
    compte_id        UUID        NOT NULL,   -- identite.comptes ID (no FK per ADR 0007)
    nom_affiche      TEXT        NOT NULL,
    role_dans_classe VARCHAR(20) NOT NULL DEFAULT 'eleve'
        CHECK (role_dans_classe IN ('eleve', 'enseignant')),
    depuis           DATE        NOT NULL,
    jusqua           DATE,
    PRIMARY KEY (classe_id, compte_id)
);
