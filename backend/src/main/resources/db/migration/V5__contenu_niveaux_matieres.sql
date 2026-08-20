-- Grade level and subject reference tables (ADR 0011).
-- Seeded here as static reference data; ingestion validates against them.
CREATE TABLE contenu.niveaux (
    code       VARCHAR(16)  NOT NULL PRIMARY KEY,
    libelle    TEXT         NOT NULL,
    ordre      SMALLINT     NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE contenu.matieres (
    code       VARCHAR(64)  NOT NULL PRIMARY KEY,
    libelle    TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO contenu.niveaux (code, libelle, ordre) VALUES
    ('6e', 'Sixième',   1),
    ('5e', 'Cinquième', 2),
    ('4e', 'Quatrième', 3),
    ('3e', 'Troisième', 4);

INSERT INTO contenu.matieres (code, libelle) VALUES
    ('mathematiques', 'Mathématiques');

-- Extend chapitres with navigation, presentation, and status columns.
-- Added nullable first so existing rows can be backfilled before the NOT NULL
-- constraint is applied.
ALTER TABLE contenu.chapitres
    ADD COLUMN niveau_code           VARCHAR(16),
    ADD COLUMN matiere_code          VARCHAR(64),
    ADD COLUMN ordre                 SMALLINT,
    ADD COLUMN statut                VARCHAR(32)  NOT NULL DEFAULT 'published',
    ADD COLUMN titre                 TEXT,
    ADD COLUMN duree_estimee_minutes SMALLINT;

UPDATE contenu.chapitres SET
    niveau_code           = content->>'level',
    matiere_code          = content->>'subject',
    ordre                 = 0,
    titre                 = content->>'title',
    duree_estimee_minutes = (content->>'estimatedDurationMinutes')::SMALLINT
WHERE niveau_code IS NULL;

ALTER TABLE contenu.chapitres
    ALTER COLUMN niveau_code           SET NOT NULL,
    ALTER COLUMN matiere_code          SET NOT NULL,
    ALTER COLUMN ordre                 SET NOT NULL,
    ALTER COLUMN titre                 SET NOT NULL,
    ALTER COLUMN duree_estimee_minutes SET NOT NULL;

ALTER TABLE contenu.chapitres
    ADD CONSTRAINT fk_chapitres_niveau  FOREIGN KEY (niveau_code)  REFERENCES contenu.niveaux(code),
    ADD CONSTRAINT fk_chapitres_matiere FOREIGN KEY (matiere_code) REFERENCES contenu.matieres(code);

CREATE UNIQUE INDEX uq_chapitres_triplet ON contenu.chapitres (niveau_code, matiere_code, id);
