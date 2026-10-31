-- #323 — « Reprendre » : la projection porte le titre du chapitre, pour que progression
-- réponde sans rappeler contenu (ADR 0022 §3). Le titre arrive ensuite par ChapitrePublie ;
-- le backfill couvre l'existant, car l'ingestion du catalogue n'est pas automatique.
-- Nullable : une ligne sans titre (chapitre absent de contenu) n'est simplement pas proposée.
ALTER TABLE progression.chapitres
    ADD COLUMN titre TEXT;

UPDATE progression.chapitres p
SET titre = c.titre
FROM contenu.chapitres c
WHERE c.id = p.chapitre_id;

-- Dernières lectures d'un élève, pour trouver le chapitre à reprendre.
CREATE INDEX idx_sections_lues_eleve_lu_at
    ON progression.sections_lues (eleve_id, lu_at DESC);
