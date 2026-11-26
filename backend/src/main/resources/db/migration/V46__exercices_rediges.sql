CREATE TABLE exercices.rediges_definitions (
    id              UUID PRIMARY KEY,
    cours_id        UUID NOT NULL,
    auteur_id       UUID NOT NULL,
    version         INT NOT NULL CHECK (version > 0),
    titre           VARCHAR(160) NOT NULL,
    enonce          TEXT NOT NULL,
    reponse_attendue VARCHAR(512) NOT NULL,
    corrige         TEXT NOT NULL,
    echeance        TIMESTAMPTZ,
    publie_at       TIMESTAMPTZ,
    cloture_at      TIMESTAMPTZ,
    modifie_at      TIMESTAMPTZ NOT NULL,
    CHECK (cloture_at IS NULL OR (publie_at IS NOT NULL AND echeance IS NOT NULL AND cloture_at <= echeance))
);

CREATE INDEX rediges_definitions_auteur ON exercices.rediges_definitions (auteur_id, modifie_at DESC);
CREATE INDEX rediges_definitions_cours ON exercices.rediges_definitions (cours_id) WHERE publie_at IS NOT NULL;

-- The definitions can come from content as code or a teacher lesson. Copies retain their exact
-- statement and solution even when another catalogue version is deployed.
CREATE TABLE exercices.rediges_soumissions (
    exercice_id     UUID NOT NULL,
    version         INT NOT NULL CHECK (version > 0),
    eleve_id        UUID NOT NULL,
    titre           VARCHAR(160) NOT NULL,
    enonce          TEXT NOT NULL,
    corrige         TEXT NOT NULL,
    reponse         VARCHAR(512) NOT NULL,
    correct         BOOLEAN NOT NULL,
    remis_at        TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (exercice_id, version, eleve_id)
);

CREATE INDEX rediges_soumissions_eleve ON exercices.rediges_soumissions (exercice_id, eleve_id, version DESC);
