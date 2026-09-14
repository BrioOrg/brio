-- Add base_legale column to record which legal basis was used (ADR 0018)
ALTER TABLE identite.comptes
    ADD COLUMN base_legale VARCHAR(30)
        CHECK (base_legale IN ('consentement', 'mission_etablissement'));

-- Backfill existing élève accounts: they were created under the consent path
UPDATE identite.comptes SET base_legale = 'consentement' WHERE role = 'eleve';

-- Élève accounts must now declare a legal basis
ALTER TABLE identite.comptes
    ADD CONSTRAINT eleve_base_legale
        CHECK (role != 'eleve' OR base_legale IS NOT NULL);

-- Relax eleve_minimise: parent email is required only for consent-path élèves
ALTER TABLE identite.comptes
    DROP CONSTRAINT eleve_minimise;

ALTER TABLE identite.comptes
    ADD CONSTRAINT eleve_minimise
        CHECK (role != 'eleve'
               OR base_legale = 'mission_etablissement'
               OR email_titulaire_legal IS NOT NULL);
