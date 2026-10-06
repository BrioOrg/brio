-- F6a — Entraide (fils de discussion attachés au contenu). ADR 0023.
-- Un élève ouvre un fil attaché à un chapitre ou un exercice, visible de sa classe ;
-- un camarade répond ; l'auteur peut marquer une réponse comme utile (→ 15 XP, F2).
-- Socle de modération : signalements + sanctions, prof modérateur de sa classe.
--
-- Références vers d'autres modules (classe_id, auteur_id, exercice/chapitre) = UUID/slug
-- nus, jamais de FK cross-schéma (ADR 0007). FK uniquement à l'intérieur du schéma social.

CREATE SCHEMA IF NOT EXISTS social;

-- Un fil de question, attaché à un chapitre (slug) ou un exercice (UUID), dans une classe.
CREATE TABLE social.fils (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    portee      VARCHAR(10) NOT NULL
        CHECK (portee IN ('chapitre', 'exercice')),
    portee_ref  VARCHAR(200) NOT NULL,          -- chapitre = slug (String), exercice = UUID en texte
    classe_id   UUID NOT NULL,                  -- identite.classes (par id)
    titre       TEXT NOT NULL,
    auteur_id   UUID NOT NULL,                  -- identite.comptes (par id)
    statut      VARCHAR(10) NOT NULL DEFAULT 'ouvert'
        CHECK (statut IN ('ouvert', 'resolu', 'masque')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fils_cible ON social.fils (classe_id, portee, portee_ref);
CREATE INDEX idx_fils_auteur ON social.fils (auteur_id);

-- Un message dans un fil. statut porte déjà 'en_moderation' pour accueillir le
-- classifieur IA différé (ADR 0023) sans migration de rupture.
CREATE TABLE social.messages (
    id               UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    fil_id           UUID NOT NULL REFERENCES social.fils (id) ON DELETE CASCADE,
    auteur_id        UUID NOT NULL,             -- identite.comptes (par id)
    corps            TEXT NOT NULL,
    statut           VARCHAR(15) NOT NULL DEFAULT 'publie'
        CHECK (statut IN ('publie', 'en_moderation', 'masque', 'supprime')),
    marque_utile_at  TIMESTAMPTZ,               -- non null = marqué utile par l'auteur du fil
    marque_utile_par UUID,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    edite_at         TIMESTAMPTZ
);
CREATE INDEX idx_messages_fil ON social.messages (fil_id, created_at);
CREATE INDEX idx_messages_auteur_jour ON social.messages (auteur_id, created_at);

-- Signalement d'un message (deux clics depuis chaque message). Un compte ne signale
-- qu'une fois un message donné.
CREATE TABLE social.signalements (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES social.messages (id) ON DELETE CASCADE,
    signale_par UUID NOT NULL,                  -- identite.comptes (par id)
    motif       TEXT,
    statut      VARCHAR(10) NOT NULL DEFAULT 'ouvert'
        CHECK (statut IN ('ouvert', 'traite')),
    traite_par  UUID,
    traite_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, signale_par)
);
CREATE INDEX idx_signalements_statut ON social.signalements (statut, created_at);

-- Sanction appliquée à un compte par un modérateur (prof de la classe). 'lecture_seule'
-- empêche d'écrire jusqu'à `fin` (null = sans échéance).
CREATE TABLE social.sanctions (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    compte_id   UUID NOT NULL,                  -- identite.comptes (par id)
    type        VARCHAR(15) NOT NULL
        CHECK (type IN ('avertissement', 'lecture_seule')),
    motif       TEXT,
    decidee_par UUID NOT NULL,                  -- identite.comptes (par id) — le modérateur
    debut       TIMESTAMPTZ NOT NULL DEFAULT now(),
    fin         TIMESTAMPTZ
);
CREATE INDEX idx_sanctions_compte ON social.sanctions (compte_id, type);

-- Projection locale « cet élève a soumis cet exercice », alimentée en écoutant
-- l'événement SoumissionEnregistree d'exercices (ADR 0023, garde anti-triche).
-- Garde la frontière Modulith nette : pas d'appel synchrone transverse à chaud.
CREATE TABLE social.soumissions_vues (
    eleve_id    UUID NOT NULL,                  -- identite.comptes (par id)
    exercice_id UUID NOT NULL,                  -- exercices (par id)
    vue_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (eleve_id, exercice_id)
);
