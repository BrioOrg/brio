ALTER TABLE exercices.rediges_definitions
    ADD COLUMN mode_correction VARCHAR(20) NOT NULL DEFAULT 'automatique'
        CHECK (mode_correction IN ('automatique', 'enseignant')),
    ADD COLUMN photo_autorisee BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN copie_modele TEXT,
    ADD CHECK (mode_correction = 'enseignant' OR (NOT photo_autorisee AND copie_modele IS NULL));

ALTER TABLE exercices.rediges_soumissions
    ALTER COLUMN reponse TYPE VARCHAR(12000),
    ALTER COLUMN correct DROP NOT NULL,
    ADD COLUMN copie_modele TEXT,
    ADD COLUMN retour_commentaire TEXT,
    ADD COLUMN retour_publie_at TIMESTAMPTZ,
    ADD CHECK ((retour_commentaire IS NULL) = (retour_publie_at IS NULL));

CREATE TABLE exercices.rediges_photos (
    exercice_id UUID NOT NULL,
    version INT NOT NULL,
    eleve_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
    contenu BYTEA NOT NULL CHECK (octet_length(contenu) > 0),
    PRIMARY KEY (exercice_id, version, eleve_id),
    FOREIGN KEY (exercice_id, version, eleve_id)
        REFERENCES exercices.rediges_soumissions (exercice_id, version, eleve_id) ON DELETE CASCADE
);
