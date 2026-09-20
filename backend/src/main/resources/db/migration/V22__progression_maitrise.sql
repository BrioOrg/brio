-- F2 / ADR 0022 §6 (#96) — Maîtrise par compétence.
-- Projection recalculable : progression ne peut pas lire exercices.soumissions sans
-- l'appel sortant que §3 interdit (comme #94 pour la complétion). Elle tient donc sa
-- PROPRE copie des soumissions par compétence, alimentée par l'événement
-- SoumissionEnregistree, et en dérive la maîtrise. Rien n'arrive par appel : tout par événement.

-- Une ligne par (soumission, compétence). C'est la source de vérité recalculable :
-- la table maitrise ci-dessous se reconstruit intégralement depuis celle-ci.
-- L'unicité (soumission_id, competence_code) rend l'ingestion idempotente — une
-- redélivraison Modulith après crash ne fausse pas l'échantillon (ADR 0022 §6).
CREATE TABLE progression.soumissions_competences (
    id                 UUID PRIMARY KEY,
    eleve_id           UUID          NOT NULL,          -- identite.comptes (par ID, ADR 0007)
    soumission_id      UUID          NOT NULL,          -- exercices.soumissions (par ID)
    competence_code    VARCHAR(128)  NOT NULL,          -- référentiel contenu (ADR 0009)
    correct            BOOLEAN       NOT NULL,
    score              NUMERIC(5,4)  NOT NULL,          -- fraction [0,1] ; capturée, inutilisée en v1
    premiere_tentative BOOLEAN       NOT NULL,          -- v1 ne compte que les premières tentatives
    submitted_at       TIMESTAMPTZ   NOT NULL,
    CONSTRAINT uq_soumissions_competences UNIQUE (soumission_id, competence_code)
);

-- Fenêtre glissante « N dernières soumissions portant la compétence » par élève.
CREATE INDEX idx_soumissions_competences_fenetre
    ON progression.soumissions_competences (eleve_id, competence_code, submitted_at DESC);

-- Maîtrise matérialisée, dérivée de la projection ci-dessus (lecture rapide).
-- niveau NULL tant que l'échantillon est trop faible pour reporter une valeur honnête
-- (règle produit : ne pas afficher une donnée que le back n'a pas vraiment — ADR 0022 §6).
CREATE TABLE progression.maitrise (
    eleve_id        UUID         NOT NULL,
    competence_code VARCHAR(128) NOT NULL,
    niveau          SMALLINT,                           -- 0..4, NULL sous le seuil d'échantillon
    echantillon     INTEGER      NOT NULL,
    maj_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (eleve_id, competence_code)
);
