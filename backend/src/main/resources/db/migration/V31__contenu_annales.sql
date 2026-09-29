-- F7 (ADR 0026) — annales. Une annale est un « chapitre spécialisé » : le sujet vit dans
-- content/annales/... et est ingéré comme un chapitre (contenu.chapitres). Cette table ne porte
-- QUE les métadonnées d'annale, reliées 1-1 au chapitre par son id (= slug). Aucun impact sur le
-- cœur d'ingestion (extracteur, CHECK des exercices).
CREATE TABLE contenu.annales (
    chapitre_id    VARCHAR(128) NOT NULL PRIMARY KEY REFERENCES contenu.chapitres (id) ON DELETE CASCADE,
    examen         TEXT NOT NULL,          -- ex. 'brevet'
    session        TEXT NOT NULL,          -- ex. 'juin'
    annee          INT NOT NULL,
    centre         TEXT,                   -- ex. 'Métropole' (nullable)
    matiere_code   VARCHAR(64) NOT NULL,   -- réf. contenu.matieres (par code)
    niveau_code    VARCHAR(8) NOT NULL,    -- réf. contenu.niveaux (par code)
    duree_minutes  INT,
    licence        TEXT,
    source_url     TEXT
);

CREATE INDEX idx_annales_niveau_matiere ON contenu.annales (niveau_code, matiere_code);
