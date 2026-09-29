-- F5 (ADR 0028) — dépôt de copie (photo/scan) joint au rendu + correction par l'enseignant.
-- Le binaire vit hors base (port de stockage) ; ici on garde les métadonnées + la clé opaque.

ALTER TABLE devoirs.rendus
    ADD COLUMN note          NUMERIC,
    ADD COLUMN appreciation  TEXT,
    ADD COLUMN corrige_par   UUID,          -- identite.comptes (enseignant), par id
    ADD COLUMN corrige_at    TIMESTAMPTZ;

CREATE TABLE devoirs.rendu_pieces (
    id             UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    rendu_id       UUID NOT NULL REFERENCES devoirs.rendus(id) ON DELETE CASCADE,
    storage_key    TEXT NOT NULL,           -- clé opaque dans le port de stockage
    filename       TEXT,
    content_type   TEXT NOT NULL,
    taille_octets  BIGINT NOT NULL,
    ordre          INT NOT NULL,
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rendu_pieces_rendu_id ON devoirs.rendu_pieces (rendu_id);
