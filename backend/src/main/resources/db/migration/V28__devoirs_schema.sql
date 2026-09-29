-- F4 — devoirs et rendus (ADR 0020). Un enseignant assigne des exercices (issus d'un cours ou d'un
-- chapitre) à sa classe ; le rendu d'un élève est DÉRIVÉ de ses soumissions (module exercices) — il
-- n'y a pas d'upload en v1. Les autres modules sont référencés par UUID, sans FK cross-schéma (ADR 0007).
CREATE SCHEMA IF NOT EXISTS devoirs;

CREATE TABLE devoirs.devoirs (
    id                     UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    classe_id              UUID NOT NULL,          -- identite.classes (par id)
    auteur_id              UUID NOT NULL,          -- identite.comptes (enseignant)
    titre                  TEXT NOT NULL,
    consigne               TEXT,
    type                   VARCHAR(20) NOT NULL DEFAULT 'devoir_maison'
        CHECK (type IN ('devoir_maison')),         -- enum ouvert : 'entrainement' | 'controle' plus tard
    source_type            VARCHAR(10) NOT NULL
        CHECK (source_type IN ('cours', 'chapitre')),
    source_ref             TEXT NOT NULL,          -- id du cours / slug du chapitre
    source_version         INT,                    -- version figée d'un cours enseignant
    ouvre_at               TIMESTAMPTZ NOT NULL,
    echeance_at            TIMESTAMPTZ NOT NULL,
    correction_visible_at  TIMESTAMPTZ NOT NULL,   -- = echeance_at en v1
    statut                 VARCHAR(15) NOT NULL DEFAULT 'publie'
        CHECK (statut IN ('brouillon', 'publie')),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devoirs_classe_id ON devoirs.devoirs (classe_id);

-- Les exercices retenus pour le devoir, ordonnés.
CREATE TABLE devoirs.devoir_exercices (
    devoir_id    UUID NOT NULL REFERENCES devoirs.devoirs (id) ON DELETE CASCADE,
    exercice_id  UUID NOT NULL,                    -- exercice (par id)
    ordre        INT NOT NULL,
    PRIMARY KEY (devoir_id, ordre)
);

-- Rendu d'un élève pour un devoir : statut et score DÉRIVÉS de ses soumissions (voir rendu_exercices).
CREATE TABLE devoirs.rendus (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    devoir_id   UUID NOT NULL REFERENCES devoirs.devoirs (id) ON DELETE CASCADE,
    eleve_id    UUID NOT NULL,                      -- identite.comptes (élève)
    statut      VARCHAR(15) NOT NULL DEFAULT 'non_commence'
        CHECK (statut IN ('non_commence', 'en_cours', 'rendu')),
    score       NUMERIC,                            -- moyenne des scores des exercices soumis
    rendu_at    TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (devoir_id, eleve_id)
);

CREATE INDEX idx_rendus_eleve_id ON devoirs.rendus (eleve_id);

-- Projection par exercice derrière le rendu : une ligne par exercice du devoir effectivement soumis.
CREATE TABLE devoirs.rendu_exercices (
    id            UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    rendu_id      UUID NOT NULL REFERENCES devoirs.rendus (id) ON DELETE CASCADE,
    exercice_id   UUID NOT NULL,
    correct       BOOLEAN NOT NULL,
    score         DOUBLE PRECISION NOT NULL,
    submitted_at  TIMESTAMPTZ NOT NULL,
    UNIQUE (rendu_id, exercice_id)
);
