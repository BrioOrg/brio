-- Communauté v1 : questions et réponses entre élèves, sous pseudonyme. ADR 0035.
-- Tables séparées de social.fils/messages : un fil y appartient à une classe et ses
-- messages sont du texte brut, ici le corps est un tableau JSON de blocs de cours.
--
-- Références vers d'autres modules (auteur_id, compte_id) = UUID nus, jamais de FK
-- cross-schéma (ADR 0007). FK uniquement à l'intérieur du schéma social.

CREATE TABLE social.communaute_questions (
    id                 UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    auteur_id          UUID NOT NULL,               -- identite.comptes (par id)
    titre              TEXT NOT NULL,
    corps              JSONB NOT NULL,
    niveau             VARCHAR(10),                 -- niveau de l'auteur à la publication, pour le filtre
    matiere            VARCHAR(64) NOT NULL,        -- contenu.matieres (par code)
    -- 'en_moderation' et 'masque' ne servent pas encore : ils accueilleront la modération
    -- sans migration de rupture (ADR 0035 §11).
    statut             VARCHAR(15) NOT NULL DEFAULT 'publie'
        CHECK (statut IN ('publie', 'en_moderation', 'masque', 'supprime')),
    reponse_resolue_id UUID,                        -- FK ajoutée après communaute_reponses
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    edite_at           TIMESTAMPTZ                  -- non null = mention « modifié »
);
CREATE INDEX idx_communaute_questions_liste
    ON social.communaute_questions (statut, niveau, matiere, created_at DESC);

-- parent_id null = réponse à la question ; non null = commentaire sous une réponse.
-- Le service limite à un niveau de commentaires (ADR 0035 §4) ; le schéma n'y oblige pas.
CREATE TABLE social.communaute_reponses (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES social.communaute_questions (id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES social.communaute_reponses (id) ON DELETE CASCADE,
    auteur_id   UUID NOT NULL,                      -- identite.comptes (par id)
    corps       JSONB NOT NULL,
    statut      VARCHAR(15) NOT NULL DEFAULT 'publie'
        CHECK (statut IN ('publie', 'en_moderation', 'masque', 'supprime')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    edite_at    TIMESTAMPTZ
);
CREATE INDEX idx_communaute_reponses_question ON social.communaute_reponses (question_id, created_at);

ALTER TABLE social.communaute_questions
    ADD CONSTRAINT fk_communaute_questions_reponse_resolue
    FOREIGN KEY (reponse_resolue_id) REFERENCES social.communaute_reponses (id) ON DELETE SET NULL;

-- Vote « Utile » : un par élève, sur une question ou une réponse (jamais un commentaire,
-- règle portée par le service). Les NULL étant distincts, chaque UNIQUE ne contraint que
-- sa propre cible.
CREATE TABLE social.communaute_votes (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    compte_id   UUID NOT NULL,                      -- identite.comptes (par id)
    question_id UUID REFERENCES social.communaute_questions (id) ON DELETE CASCADE,
    reponse_id  UUID REFERENCES social.communaute_reponses (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(question_id, reponse_id) = 1),
    UNIQUE (compte_id, question_id),
    UNIQUE (compte_id, reponse_id)
);
CREATE INDEX idx_communaute_votes_question ON social.communaute_votes (question_id);
CREATE INDEX idx_communaute_votes_reponse ON social.communaute_votes (reponse_id);
