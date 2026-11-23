-- PL-6b / ADR 0050 (#400) — Progression des cours d'enseignant.
-- Additive : les tables des chapitres (V20) ne changent pas. Références par ID (ADR 0007).
-- Données de mineurs : inscrites au registre (docs/rgpd/registre-des-traitements.md),
-- conservation provisoire « vie du compte », règle à fixer par #435.

-- Projection structurelle de la version publiée courante d'un cours (non par élève).
-- Alimentée par CoursPublie ; la garde de version rend l'upsert convergent même si deux
-- publications (ou l'amorce et une publication) arrivent dans le désordre.
CREATE TABLE progression.cours (
    cours_id UUID        PRIMARY KEY,                    -- contenu.cours ID (pas de FK, ADR 0007)
    version  INTEGER     NOT NULL CHECK (version >= 1),
    maj_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Éléments comptés de la version courante : ids de section, clés d'exercice corrigeable.
-- Les clés sont les ids stables de l'éditeur, PAS les UUID d'exercice recréés à chaque
-- version (V26:77-84) : c'est ce qui tient C9 et ferme la boucle d'XP par republication.
CREATE TABLE progression.cours_elements (
    cours_id UUID         NOT NULL REFERENCES progression.cours (cours_id) ON DELETE CASCADE,
    nature   VARCHAR(10)  NOT NULL CHECK (nature IN ('section', 'exercice')),
    cle      VARCHAR(128) NOT NULL,
    PRIMARY KEY (cours_id, nature, cle)
);

-- Un suivi par (élève, cours) : verrou de sérialisation (SELECT … FOR UPDATE) de l'évaluation
-- de la complétion, et complétion collante.
CREATE TABLE progression.cours_suivis (
    eleve_id   UUID        NOT NULL,                     -- identite.comptes ID
    cours_id   UUID        NOT NULL,
    termine_at TIMESTAMPTZ,                              -- NULL tant que non terminé ; jamais remis à NULL
    PRIMARY KEY (eleve_id, cours_id)
);

-- Sections lues. L'unicité rend le signal idempotent (INSERT … ON CONFLICT DO NOTHING).
CREATE TABLE progression.cours_sections_lues (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id   UUID         NOT NULL,
    cours_id   UUID         NOT NULL,
    section_id VARCHAR(128) NOT NULL,
    lu_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_cours_sections_lues UNIQUE (eleve_id, cours_id, section_id)
);
CREATE INDEX idx_cours_sections_lues_eleve_lu
    ON progression.cours_sections_lues (eleve_id, lu_at DESC);

-- Exercices réussis, par clé stable : un même exercice réussi en v1 puis en v2 = une ligne.
CREATE TABLE progression.cours_exercices_reussis (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    eleve_id     UUID         NOT NULL,
    cours_id     UUID         NOT NULL,
    exercice_cle VARCHAR(128) NOT NULL,
    reussi_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_cours_exercices_reussis UNIQUE (eleve_id, cours_id, exercice_cle)
);
