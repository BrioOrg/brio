-- Competency referential projection (ADR 0008/0009). Source of truth is
-- content/referentiel/ in Git; this table is upserted by code at startup.
-- No FK from contenu.exercices.competencies (TEXT[]) — existence of codes is
-- enforced at ingestion (application-level) and by CI, per the roadmap §3.2.
CREATE TABLE contenu.competences (
    code                 VARCHAR(128) NOT NULL PRIMARY KEY,
    intitule             TEXT         NOT NULL,
    cycle                SMALLINT     NOT NULL,
    niveaux              TEXT[]       NOT NULL,
    domaine              VARCHAR(64)  NOT NULL,
    reference_officielle TEXT         NOT NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
