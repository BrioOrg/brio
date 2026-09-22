-- F2 / ADR 0022 — Fix schema-validation mismatch on soumissions_competences.score.
-- The entity SoumissionCompetence maps `score` as a Java `double` (float8), but V22 created
-- the column as NUMERIC(5,4). With ddl-auto=validate this fails on a real Flyway-migrated run
-- (Testcontainers tests let Hibernate generate the schema, so they never caught it). The
-- mastery recompute (NiveauMaitrise) works in double anyway, and this is a recalculable
-- projection, so align the column to double precision.
ALTER TABLE progression.soumissions_competences
    ALTER COLUMN score TYPE double precision;
