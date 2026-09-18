-- F2 / ADR 0022 — Progression : XP et niveau.
-- Schéma dédié (ADR 0007). Alimenté par événements applicatifs ; jamais d'appel sortant.

CREATE SCHEMA IF NOT EXISTS progression;

-- Journal d'attribution d'XP. La contrainte d'unicité EST le dispositif anti-abus
-- (ADR 0022 §2) : refaire la même source pour le même motif n'insère qu'une ligne.
CREATE TABLE progression.evenements_xp (
    id          UUID PRIMARY KEY,
    eleve_id    UUID        NOT NULL,          -- identite.comptes (par ID, ADR 0007)
    source_type VARCHAR(30) NOT NULL,          -- 'exercice' | 'section' | 'chapitre' | ...
    source_ref  VARCHAR(100) NOT NULL,         -- ID de l'objet source
    motif       VARCHAR(40) NOT NULL,          -- 'reussi_1er_coup' | 'reussi_apres_erreur' | ...
    points      SMALLINT    NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_evenements_xp_source UNIQUE (eleve_id, source_type, source_ref, motif)
);

-- Solde courant, dérivable des événements (projection matérialisée pour lecture rapide).
CREATE TABLE progression.soldes (
    eleve_id   UUID PRIMARY KEY,
    xp_total   INTEGER  NOT NULL DEFAULT 0,
    niveau     SMALLINT NOT NULL DEFAULT 0,
    calcule_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Somme quotidienne d'XP par élève (pour le plafond 200/j) sans recalcul lourd.
CREATE INDEX idx_evenements_xp_eleve_jour
    ON progression.evenements_xp (eleve_id, created_at);
