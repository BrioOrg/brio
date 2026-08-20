-- content_hash enables skip-if-unchanged (ADR 0010).
-- Nullable because existing rows pre-date the hash column; the next ingest run will populate them.
ALTER TABLE contenu.chapitres
    ADD COLUMN content_hash VARCHAR(64);

-- Enforce the status values declared in course-content.schema.json (ADR 0011 follow-up).
ALTER TABLE contenu.chapitres
    ADD CONSTRAINT chk_chapitres_statut CHECK (statut IN ('published', 'draft'));

-- Soft-delete marker for exercises removed from a chapter file (ADR 0010).
-- NULL means the exercise is active; a timestamp means it was retired at that instant.
ALTER TABLE contenu.exercices
    ADD COLUMN retired_at TIMESTAMPTZ;

-- uq_chapitres_triplet is redundant: the id column is already the primary key,
-- so (niveau_code, matiere_code, id) uniqueness is already guaranteed.
DROP INDEX contenu.uq_chapitres_triplet;
