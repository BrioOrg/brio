-- F3 / ADR 0019 — Socle du contenu d'enseignant (éditeur par blocs).
-- Migration purement additive : les chapitres de catalogue, les soumissions et
-- les évaluateurs existants ne changent pas. Pas d'endpoint ni d'UI ici.
--
-- Références inter-modules par ID, sans FK (ADR 0007, comme identite.inscriptions
-- V15, progression V19/V22) : auteur_id, etablissement_id, classe_id, proprietaire_id
-- pointent identite.* par UUID. Conséquence assumée : rien en base n'empêche une
-- portée orpheline si une classe est supprimée — ce nettoyage est applicatif.
-- La seule FK vers identite jamais écrite reste exercices.soumissions → contenu
-- (V3), antérieure à la règle : l'exception, pas le motif.

-- Un cours d'enseignant. statut ∈ {brouillon, publie, archive} : suit ADR 0019.
-- Diverge volontairement de contenu.chapitres (published/draft, V6) ; le français
-- s'aligne sur identite (active/archivee) — c'est chapitres l'outlier, à ne pas
-- « harmoniser » par erreur. version_publiee nullable tant qu'aucune version n'est
-- publiée (FK ajoutée plus bas, une fois cours_versions créée).
CREATE TABLE contenu.cours (
    id               UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    auteur_id        UUID         NOT NULL,          -- identite.comptes ID (no FK per ADR 0007)
    etablissement_id UUID         NOT NULL,          -- identite.etablissements ID (no FK per ADR 0007)
    titre            TEXT         NOT NULL,
    niveau_code      VARCHAR(16)  NOT NULL REFERENCES contenu.niveaux(code),
    matiere_code     VARCHAR(64)  NOT NULL REFERENCES contenu.matieres(code),
    statut           VARCHAR(32)  NOT NULL DEFAULT 'brouillon'
        CHECK (statut IN ('brouillon', 'publie', 'archive')),
    version_publiee  INTEGER,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Versions immuables (ADR 0019 §3). Une version publiée fige le sujet : corriger
-- une coquille après avoir donné le devoir (F4) ne doit pas changer le sujet sous
-- les pieds des élèves — pendant exact de la préservation des UUID d'exercices
-- (ADR 0010). L'immutabilité est une garantie applicative ; la table ne fait que
-- clé-composite (cours_id, version).
CREATE TABLE contenu.cours_versions (
    cours_id  UUID        NOT NULL REFERENCES contenu.cours(id),
    version   INTEGER     NOT NULL,
    content   JSONB       NOT NULL,
    publie_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (cours_id, version)
);

-- Un cours ne peut pas revendiquer une version publiée qui n'existe pas.
-- FK intra-schéma, ajoutée après cours_versions. NULL ⇒ non vérifiée (brouillon).
ALTER TABLE contenu.cours
    ADD CONSTRAINT fk_cours_version_publiee
        FOREIGN KEY (id, version_publiee) REFERENCES contenu.cours_versions(cours_id, version);

-- Qui a accès à un cours. classe_id par ID (no FK, cf. en-tête).
CREATE TABLE contenu.cours_portees (
    cours_id  UUID NOT NULL REFERENCES contenu.cours(id),
    classe_id UUID NOT NULL,                          -- identite.classes ID (no FK per ADR 0007)
    PRIMARY KEY (cours_id, classe_id)
);

-- Fichiers téléversés par un enseignant (images de cours, etc.).
-- cle_stockage UNIQUE : deux lignes pointant le même objet stocké est un bug, pas
-- une dédup. sha256 indexé pour que la dédup applicative (tranche ultérieure) ne
-- soit pas un table scan ; la dédup elle-même reste applicative.
CREATE TABLE contenu.assets (
    id             UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    proprietaire_id UUID       NOT NULL,              -- identite.comptes ID (no FK per ADR 0007)
    mime           VARCHAR(128) NOT NULL,
    taille         BIGINT       NOT NULL,
    sha256         VARCHAR(64)  NOT NULL,
    cle_stockage   TEXT         NOT NULL UNIQUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_sha256 ON contenu.assets (sha256);

-- Exercices d'un cours d'enseignant : pas de seconde table (ADR 0019 §3). Un
-- exercice appartient soit à un chapitre de catalogue, soit à une version de cours
-- d'enseignant — exactement l'un des deux. Additif : soumissions et évaluateurs
-- continuent sans savoir d'où vient l'exercice.
--
-- Conséquence à traiter en F4 : les versions étant immuables, publier v2 crée de
-- NOUVELLES lignes d'exercices avec de NOUVEAUX UUID. La progression est indexée
-- sur exercice_id (progression.exercices_reussis uq (eleve_id, chapitre_id,
-- exercice_id) ; evenements_xp.source_ref) → un même exercice republié en v2 est
-- une source neuve et re-gagne de l'XP. Et exercices_reussis.chapitre_id étant
-- NOT NULL, un exercice de cours d'enseignant (chapitre_id NULL) ne peut y être
-- enregistré du tout. Acceptable pour une tranche data-model ; F4 devra le gérer.
ALTER TABLE contenu.exercices
    ALTER COLUMN chapitre_id DROP NOT NULL,
    ADD COLUMN cours_id      UUID,
    ADD COLUMN cours_version INTEGER;

ALTER TABLE contenu.exercices
    ADD CONSTRAINT fk_exercices_cours_version
        FOREIGN KEY (cours_id, cours_version) REFERENCES contenu.cours_versions(cours_id, version);

-- XOR complet : cours_id et cours_version sont tout-ou-rien, exclusifs de chapitre_id.
ALTER TABLE contenu.exercices
    ADD CONSTRAINT chk_exercices_origine CHECK (
        (chapitre_id IS NOT NULL AND cours_id IS NULL AND cours_version IS NULL)
        OR
        (chapitre_id IS NULL AND cours_id IS NOT NULL AND cours_version IS NOT NULL)
    );

-- uq_exercices_chapitre_slug (chapitre_id, slug) ne protège plus les exercices
-- d'enseignant : Postgres traite les NULL comme distincts, donc (NULL, 'foo') se
-- répète librement. Index unique partiel pour reprotéger le slug côté cours.
CREATE UNIQUE INDEX uq_exercices_cours_slug
    ON contenu.exercices (cours_id, cours_version, slug)
    WHERE cours_id IS NOT NULL;
