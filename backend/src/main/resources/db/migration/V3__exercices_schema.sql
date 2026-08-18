CREATE SCHEMA IF NOT EXISTS exercices;

-- student_ref: Spring SecurityContext principal name for now (basic-auth username in dev).
-- Becomes a non-null FK to identite.users (UUID) when auth ships; type will change from VARCHAR to UUID.
CREATE TABLE exercices.soumissions (
    id              UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    exercice_id     UUID         NOT NULL REFERENCES contenu.exercices(id),
    student_ref     VARCHAR(256),
    answer          JSONB        NOT NULL,
    correct         BOOLEAN      NOT NULL,
    score           NUMERIC(5,4) NOT NULL,
    feedback        JSONB,
    competencies    TEXT[]       NOT NULL DEFAULT '{}',
    submitted_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_soumissions_exercice_id ON exercices.soumissions (exercice_id);
CREATE INDEX idx_soumissions_student_ref  ON exercices.soumissions (student_ref);
