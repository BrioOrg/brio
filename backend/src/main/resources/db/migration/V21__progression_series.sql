-- F2 / ADR 0022 (#95) — Série de jours (streak).
-- Une ligne par élève, alimentée par l'activité (soumission ou section lue) via
-- événements applicatifs ; jamais d'appel sortant. Le « gel » hebdomadaire tolère
-- un jour manqué par semaine ISO : gels_restants refait le plein (1) à chaque
-- nouvelle semaine et se consomme pour combler un seul trou (décision #95).

CREATE TABLE progression.series (
    eleve_id           UUID PRIMARY KEY,              -- identite.comptes (par ID, ADR 0007)
    jours_consecutifs  SMALLINT    NOT NULL DEFAULT 0,
    dernier_jour_actif DATE,                          -- null tant qu'aucune activité
    gels_restants      SMALLINT    NOT NULL DEFAULT 1,
    maj_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
