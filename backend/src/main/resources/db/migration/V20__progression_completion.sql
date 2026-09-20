-- F2 / ADR 0022 (#94) — Complétion et états de parcours.
-- progression projette la structure des chapitres (événement ChapitrePublie) et
-- enregistre la complétion par élève dans ses propres tables, distinctes du
-- journal d'XP : un exercice réussi au-delà du plafond quotidien ne laisse aucune
-- ligne dans evenements_xp, mais doit compter pour la porte des 80 %.

-- Les réfs de section valent 'chapitreId/sectionId' et dépassent l'ancien VARCHAR(100).
ALTER TABLE progression.evenements_xp
    ALTER COLUMN source_ref TYPE VARCHAR(200);

-- Projection de la structure du catalogue publié (non par-élève). Réémise à chaque
-- ingestion ; l'upsert par clé primaire la rend convergente et idempotente.
CREATE TABLE progression.chapitres (
    chapitre_id     VARCHAR(128) PRIMARY KEY,
    niveau_code     VARCHAR(16)  NOT NULL,
    matiere_code    VARCHAR(64)  NOT NULL,
    ordre           INTEGER      NOT NULL,
    statut          VARCHAR(20)  NOT NULL,
    total_sections  INTEGER      NOT NULL,
    total_exercices INTEGER      NOT NULL,
    maj_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Parcours d'un niveau/matière, dans l'ordre : sert l'énumération de l'atlas.
CREATE INDEX idx_progression_chapitres_parcours
    ON progression.chapitres (niveau_code, matiere_code, ordre);

-- Sections lues par élève. L'unicité rend le signal « section lue » idempotent.
CREATE TABLE progression.sections_lues (
    id          UUID PRIMARY KEY,
    eleve_id    UUID         NOT NULL,
    chapitre_id VARCHAR(128) NOT NULL,
    section_id  VARCHAR(128) NOT NULL,
    lu_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_sections_lues UNIQUE (eleve_id, chapitre_id, section_id)
);

CREATE INDEX idx_sections_lues_eleve_chapitre
    ON progression.sections_lues (eleve_id, chapitre_id);

-- Exercices réussis par élève. Source de vérité de la complétion, indépendante du
-- plafond d'XP. L'unicité (eleve, chapitre, exercice) garantit un comptage distinct.
CREATE TABLE progression.exercices_reussis (
    id          UUID PRIMARY KEY,
    eleve_id    UUID         NOT NULL,
    chapitre_id VARCHAR(128) NOT NULL,
    exercice_id UUID         NOT NULL,
    reussi_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_exercices_reussis UNIQUE (eleve_id, chapitre_id, exercice_id)
);

CREATE INDEX idx_exercices_reussis_eleve_chapitre
    ON progression.exercices_reussis (eleve_id, chapitre_id);
