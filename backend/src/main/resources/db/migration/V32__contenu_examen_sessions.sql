-- F7 (ADR 0027) — mode examen des annales. Une session d'examen est initiée par l'ÉLÈVE sur une
-- annale : le tuteur est coupé pendant la durée, la correction n'est visible qu'après la fin.
-- Réutilise le mécanisme du mode contrôle (ADR 0025). Aucune FK cross-schéma (ADR 0007).
CREATE TABLE contenu.examen_sessions (
    id                  UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id            UUID NOT NULL,                 -- identite.comptes (par id)
    annale_chapitre_id  VARCHAR(128) NOT NULL,         -- contenu.annales(chapitre_id)
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at             TIMESTAMPTZ NOT NULL,
    statut              VARCHAR(15) NOT NULL DEFAULT 'en_cours'
        CHECK (statut IN ('en_cours', 'termine')),
    termine_at          TIMESTAMPTZ
);

CREATE INDEX idx_examen_sessions_eleve ON contenu.examen_sessions (eleve_id, statut);
