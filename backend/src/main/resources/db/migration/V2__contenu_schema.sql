CREATE SCHEMA IF NOT EXISTS contenu;

CREATE TABLE contenu.chapitres (
    id         VARCHAR(128) NOT NULL PRIMARY KEY,
    content    JSONB        NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE contenu.exercices (
    id          UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    chapitre_id VARCHAR(128) NOT NULL REFERENCES contenu.chapitres(id),
    slug        VARCHAR(128) NOT NULL,
    type        VARCHAR(64)  NOT NULL,
    evaluation  JSONB        NOT NULL,
    competencies TEXT[]      NOT NULL DEFAULT '{}',
    CONSTRAINT uq_exercices_chapitre_slug UNIQUE (chapitre_id, slug)
);

CREATE INDEX idx_exercices_chapitre_id ON contenu.exercices (chapitre_id);
