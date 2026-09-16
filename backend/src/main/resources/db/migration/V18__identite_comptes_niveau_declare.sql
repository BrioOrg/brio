-- Stores the student's self-declared school level at path B registration (ADR 0018).
-- Nullable: path A accounts don't go through this flow.
-- Values mirror contenu.niveaux.code — no cross-schema FK (ADR 0007).
ALTER TABLE identite.comptes
    ADD COLUMN niveau_declare VARCHAR(10)
        CHECK (niveau_declare IS NULL OR niveau_declare IN ('6e', '5e', '4e', '3e'));
