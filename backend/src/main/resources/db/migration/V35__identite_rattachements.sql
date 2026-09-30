-- A teacher belongs to one or several établissements (a replacement teacher serves
-- more than one), chosen at signup and independent of the classes they run (ADR 0029).

CREATE TABLE identite.rattachements (
    compte_id        UUID NOT NULL,   -- identite.comptes ID (no FK per ADR 0007)
    etablissement_id UUID NOT NULL REFERENCES identite.etablissements,
    depuis           DATE NOT NULL,
    PRIMARY KEY (compte_id, etablissement_id)
);

-- Until now the link was only implied by the classes a teacher is the principal of.
INSERT INTO identite.rattachements (compte_id, etablissement_id, depuis)
SELECT DISTINCT enseignant_principal_id, etablissement_id, CURRENT_DATE
FROM identite.classes
WHERE enseignant_principal_id IS NOT NULL;
