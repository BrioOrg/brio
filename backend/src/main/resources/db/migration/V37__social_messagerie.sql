-- F6b — Messagerie de classe (salon de groupe). ADR 0033.
-- Un enseignant crée un salon pour sa classe ; les membres (élèves + prof) y écrivent,
-- tout est visible de la classe. Modération = socle de F6a : prévention + signalement +
-- prof modérateur ; les sanctions (social.sanctions) sont réutilisées telles quelles.
--
-- Références vers d'autres modules (classe_id, auteur_id…) = UUID nus, jamais de FK
-- cross-schéma (ADR 0007). FK uniquement à l'intérieur du schéma social.

-- Un salon de classe, créé par un enseignant.
CREATE TABLE social.salons (
    id         UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    classe_id  UUID NOT NULL,                 -- identite.classes (par id)
    titre      TEXT NOT NULL,
    cree_par   UUID NOT NULL,                 -- identite.comptes (par id) — l'enseignant
    statut     VARCHAR(10) NOT NULL DEFAULT 'ouvert'
        CHECK (statut IN ('ouvert', 'archive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_salons_classe ON social.salons (classe_id);

-- Un message dans un salon. statut 'masque'/'supprime' pour la modération ; le
-- classifieur IA différé (ADR 0033) s'appuiera sur ces mêmes statuts, sans migration.
CREATE TABLE social.salon_messages (
    id         UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id   UUID NOT NULL REFERENCES social.salons (id) ON DELETE CASCADE,
    auteur_id  UUID NOT NULL,                 -- identite.comptes (par id)
    corps      TEXT NOT NULL,
    statut     VARCHAR(15) NOT NULL DEFAULT 'publie'
        CHECK (statut IN ('publie', 'masque', 'supprime')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edite_at   TIMESTAMPTZ
);
CREATE INDEX idx_salon_messages_salon ON social.salon_messages (salon_id, created_at);
CREATE INDEX idx_salon_messages_auteur_jour ON social.salon_messages (auteur_id, created_at);

-- Signalement d'un message de salon (deux clics). Un compte ne signale qu'une fois
-- un message donné. Table séparée des signalements d'entraide (parent différent), cf ADR 0033.
CREATE TABLE social.salon_signalements (
    id          UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES social.salon_messages (id) ON DELETE CASCADE,
    signale_par UUID NOT NULL,                -- identite.comptes (par id)
    motif       TEXT,
    statut      VARCHAR(10) NOT NULL DEFAULT 'ouvert'
        CHECK (statut IN ('ouvert', 'traite')),
    traite_par  UUID,
    traite_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, signale_par)
);
CREATE INDEX idx_salon_signalements_statut ON social.salon_signalements (statut, created_at);
