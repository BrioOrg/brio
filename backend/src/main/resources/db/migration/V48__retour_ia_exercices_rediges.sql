ALTER TABLE exercices.rediges_definitions
    DROP CONSTRAINT rediges_definitions_mode_correction_check,
    ADD CHECK (mode_correction IN ('automatique', 'enseignant', 'ia')),
    ADD COLUMN cle_correction JSONB,
    ADD CHECK ((mode_correction = 'ia') = (cle_correction IS NOT NULL));

ALTER TABLE exercices.rediges_soumissions
    ADD COLUMN retour_ia JSONB;
