-- Console de modération de la Communauté (ADR 0035 §10, suivi #338). Jusqu'ici la
-- Communauté s'ouvrait sans modération derrière le réglage `brio.communaute.active` ;
-- cette migration pose la file de signalements, le journal des décisions et les
-- contestations que `admin_brio` traite avant une ouverture à de vrais élèves.
--
-- Le masquage/suppression d'un contenu réutilise la colonne `statut` déjà présente
-- sur communaute_questions / communaute_reponses (V41, valeurs 'masque'/'supprime') :
-- aucune migration de rupture sur ces tables.
--
-- Références vers d'autres modules (signale_par, decidee_par, auteur_id) = UUID nus,
-- jamais de FK cross-schéma (ADR 0007). La cible est polymorphe (question ou réponse),
-- donc pas de FK intra-schéma non plus : (cible_type, cible_id) est validé par le service.

-- Un membre signale une question ou une réponse (commentaire inclus : c'est une réponse
-- avec un parent). Un compte ne signale qu'une fois une cible donnée.
CREATE TABLE social.communaute_signalements (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    cible_type  VARCHAR(10) NOT NULL
        CHECK (cible_type IN ('question', 'reponse')),
    cible_id    UUID NOT NULL,
    signale_par UUID NOT NULL,                  -- identite.comptes (par id)
    motif       TEXT,
    statut      VARCHAR(10) NOT NULL DEFAULT 'ouvert'
        CHECK (statut IN ('ouvert', 'traite')),
    traite_par  UUID,                           -- admin_brio qui a tranché
    traite_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cible_type, cible_id, signale_par)
);
CREATE INDEX idx_communaute_signalements_statut
    ON social.communaute_signalements (statut, created_at);
CREATE INDEX idx_communaute_signalements_cible
    ON social.communaute_signalements (cible_type, cible_id);

-- Journal d'audit des décisions de modération. Chaque action de l'admin y laisse une trace,
-- restauration comprise : la contestation s'appuie dessus.
CREATE TABLE social.communaute_decisions (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    cible_type  VARCHAR(10) NOT NULL
        CHECK (cible_type IN ('question', 'reponse')),
    cible_id    UUID NOT NULL,
    -- 'revoquer_xp' retire l'XP « réponse utile » sans toucher à la visibilité du contenu ;
    -- 'rejeter' clôt les signalements en laissant le contenu en ligne ; 'restaurer' remet en
    -- ligne un contenu masqué (contestation acceptée).
    action      VARCHAR(12) NOT NULL
        CHECK (action IN ('masquer', 'supprimer', 'rejeter', 'restaurer', 'revoquer_xp')),
    motif       TEXT,
    decidee_par UUID NOT NULL,                  -- admin_brio (par id)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_communaute_decisions_cible
    ON social.communaute_decisions (cible_type, cible_id, created_at DESC);

-- Contestation d'une décision par l'auteur du contenu, avec intervention humaine.
-- L'auteur conteste une décision ('masquer'/'supprimer') ; un admin tranche (accepter →
-- le contenu est restauré, rejeter → la décision tient), en laissant une réponse.
CREATE TABLE social.communaute_contestations (
    id                 UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id        UUID NOT NULL REFERENCES social.communaute_decisions (id) ON DELETE CASCADE,
    cible_type         VARCHAR(10) NOT NULL
        CHECK (cible_type IN ('question', 'reponse')),
    cible_id           UUID NOT NULL,
    auteur_id          UUID NOT NULL,           -- l'auteur du contenu (par id)
    message            TEXT NOT NULL,
    statut             VARCHAR(10) NOT NULL DEFAULT 'ouverte'
        CHECK (statut IN ('ouverte', 'acceptee', 'rejetee')),
    reponse_moderateur TEXT,
    traite_par         UUID,                    -- admin_brio qui a tranché
    traite_at          TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Une seule contestation ouverte par décision : on ne rouvre pas le même débat.
    UNIQUE (decision_id)
);
CREATE INDEX idx_communaute_contestations_statut
    ON social.communaute_contestations (statut, created_at);
